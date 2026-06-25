// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  useAiConfig,
  useStartStatementParse,
  pollStatementProgress,
  type ParsedStatement,
} from '../../api/hooks/useAi';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileUp, Brain, Check, X, Loader2, Download, AlertTriangle } from 'lucide-react';
import { AiBannerForTask } from '../../components/ui/AiBannerForTask';
import { OcrQualityNotice } from '../../components/ui/OcrQualityNotice';
import { AccountSelector } from '../../components/forms/AccountSelector';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: string;
  type: 'debit' | 'credit';
  balance?: string;
  selected: boolean;
  duplicate: boolean;
}

// A valid RFC-4122 v4 UUID that works in non-secure contexts (HTTP/LAN), where
// crypto.randomUUID is undefined but crypto.getRandomValues is available.
function genUuidV4(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

export function StatementUploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  interface StatementMetadata {
    accountNumber?: string | null;
    period?: { start?: string; end?: string } | string | null;
    openingBalance?: string | null;
    closingBalance?: string | null;
    confidence?: number | null;
    qualityWarnings: string[];
    extractionSource?: string;
    reconciliation?: {
      status: 'verified' | 'discrepancy' | 'skipped';
      deltaCents: number;
      repaired: boolean;
      fixDescription?: string;
    };
  }
  const [metadata, setMetadata] = useState<StatementMetadata | null>(null);
  // Indices flagged by the running-balance check (findSuspectRows), shown as
  // per-row "off by $X" badges.
  const [suspectByIndex, setSuspectByIndex] = useState<Record<number, number>>({});
  const [imported, setImported] = useState<{ imported: number; skipped?: number; duplicates?: number } | null>(null);
  // The GL bank account the statement belongs to; the import find-or-creates a
  // manual connection for it server-side. Required before importing.
  const [accountId, setAccountId] = useState('');
  // Live processing stage from the SSE progress stream.
  const [stage, setStage] = useState<string | null>(null);
  const progressCtrl = useRef<AbortController | null>(null);

  const { data: aiConfig, isLoading: aiConfigLoading } = useAiConfig();
  const aiEnabled = aiConfig?.isEnabled === true;
  const startParse = useStartStatementParse();

  // Human label per stage (matches the converter's progress display).
  const STAGE_LABELS: Record<string, string> = {
    queued: 'Queued…',
    detecting: 'Detecting statement format…',
    ocr: 'Running OCR on statement pages…',
    extracting: 'Extracting transactions…',
    reconciling: 'Reconciling balances…',
    done: 'Finishing up…',
  };

  // Map a terminal parse result into the review table + metadata.
  const applyResult = (result: ParsedStatement) => {
    setTransactions((result.transactions ?? []).map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type === 'credit' ? 'credit' : 'debit',
      selected: true,
      duplicate: false,
    })));
    setMetadata({
      accountNumber: result.accountNumberMasked,
      period: result.statementPeriod,
      openingBalance: result.openingBalance,
      closingBalance: result.closingBalance,
      confidence: result.confidence,
      qualityWarnings: Array.isArray(result.qualityWarnings) ? result.qualityWarnings : [],
      extractionSource: result.extractionSource,
      reconciliation: result.reconciliation,
    });
    setSuspectByIndex(
      Object.fromEntries((result.suspectRows ?? []).map((s) => [s.index, s.deltaCents])),
    );
  };

  // Abort any in-flight progress stream on unmount.
  useEffect(() => () => progressCtrl.current?.abort(), []);

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('attachableType', 'bank_statement');
      // attachable_id is a UUID column server-side. crypto.randomUUID is only
      // available in SECURE contexts (an appliance on plain HTTP / a LAN IP is
      // not one), but crypto.getRandomValues IS — so build a valid v4 UUID
      // from it (falling back to Math.random only if even that is missing).
      formData.append('attachableId', genUuidV4());
      const res = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) {
        // Surface the server's real reason (file type/magic-byte rejection,
        // size limit, auth, validation) instead of a blanket "Upload failed".
        let msg = `Upload failed (HTTP ${res.status})`;
        try {
          const body = await res.json();
          msg = body?.error?.message || body?.message || msg;
        } catch { /* non-JSON error body — keep the status line */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: async (data: { id?: string; attachment?: { id: string } }) => {
      const aid = data.id || data.attachment?.id;
      if (!aid) return;
      setAttachmentId(aid);

      // Kick off the async parse and follow its SSE progress stream. The page
      // shows the live stage while the pipeline runs in the background, then
      // renders the review table from the terminal `complete` snapshot.
      setParsing(true);
      setParseError('');
      setStage('queued');
      try {
        const { jobId } = await startParse.mutateAsync(aid);
        const ctrl = new AbortController();
        progressCtrl.current?.abort();
        progressCtrl.current = ctrl;
        let failure: string | null = null;
        let gotResult = false;
        await pollStatementProgress(jobId, (snap) => {
          if (snap.stage) setStage(snap.stage);
          if (snap.status === 'complete') {
            if (snap.result) { applyResult(snap.result); gotResult = true; }
            else failure = 'Parsing finished but returned no transactions.';
          } else if (snap.status === 'failed') {
            failure = snap.error || 'Failed to parse statement.';
          }
        }, ctrl.signal);
        // Never leave the screen blank: if we didn't get a result or an error,
        // surface a soft message instead of silently rendering nothing.
        if (!gotResult && !failure && !ctrl.signal.aborted) {
          failure = 'Parsing did not return a result. Please try again.';
        }
        if (failure) setParseError(failure);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return; // superseded
        setParseError(err instanceof Error ? err.message : 'Failed to parse statement. Try a different file format.');
      } finally {
        setParsing(false);
        setStage(null);
      }
    },
    onError: (err: unknown) => {
      setParsing(false);
      setStage(null);
      setParseError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    },
  });

  interface StatementImportResult {
    imported: number;
    duplicates?: number;
    errors?: string[];
  }
  const importMutation = useMutation({
    mutationFn: async () => {
      const selected = transactions.filter((t) => t.selected && !t.duplicate);
      const res = await apiClient<StatementImportResult>('/ai/parse/statement/import', {
        method: 'POST',
        body: JSON.stringify({
          // The server find-or-creates the manual bank connection for this
          // account, so the statement rows land under the chosen GL account.
          accountId,
          transactions: selected.map((t) => ({ date: t.date, description: t.description, amount: t.amount, type: t.type })),
        }),
      });
      return res;
    },
    onSuccess: (data) => setImported(data),
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    progressCtrl.current?.abort();
    setFile(f);
    setTransactions([]);
    setSuspectByIndex({});
    setImported(null);
    setParseError('');
    setStage(null);
    uploadMutation.mutate(f);
  };

  const toggleAll = (checked: boolean) => {
    setTransactions((txns) => txns.map((t) => ({ ...t, selected: t.duplicate ? false : checked })));
  };

  const toggleRow = (idx: number) => {
    setTransactions((txns) => txns.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const selectedCount = transactions.filter((t) => t.selected && !t.duplicate).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Bank Statement</h1>
        <AiBannerForTask task="statement_parsing" />
      </div>

      {/* AI not enabled alert */}
      {!aiConfigLoading && !aiEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">AI Processing is not enabled</p>
            <p className="text-xs text-amber-700 mt-1">Bank statement import requires AI to extract transactions from PDF or image files. Please ask your administrator to enable AI processing in Admin &gt; AI Processing.</p>
          </div>
        </div>
      )}

      {/* Upload Area — shown whenever we're idle with no results (initial load
          OR after an error), so the user can always (re)pick a file. */}
      {aiEnabled && !parsing && !uploadMutation.isPending && transactions.length === 0 && !imported && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center cursor-pointer hover:border-primary-400"
          onClick={() => document.getElementById('statement-input')?.click()}>
          <input id="statement-input" type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
          <FileUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">{file ? 'Upload a different statement' : 'Upload a bank statement (PDF or image)'}</p>
          <p className="text-xs text-gray-400 mt-1">AI will extract all transactions automatically</p>
        </div>
      )}

      {/* Processing */}
      {(uploadMutation.isPending || parsing) && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            {uploadMutation.isPending
              ? 'Uploading...'
              : (stage && STAGE_LABELS[stage]) || 'AI parsing statement...'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stage === 'ocr'
              ? 'Scanned pages are read one at a time — this can take a minute per page.'
              : 'This may take a moment for multi-page documents'}
          </p>
        </div>
      )}

      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{parseError}</div>
      )}

      {/* Results */}
      {transactions.length > 0 && !parsing && (
        <div className="space-y-4">
          {/* Destination account — which GL/bank account these transactions
              belong to. Required before import; the server find-or-creates the
              manual bank connection for it. */}
          <div className="bg-white rounded-lg border p-4">
            <div className="max-w-md">
              <AccountSelector
                label="Import into bank account"
                value={accountId}
                onChange={setAccountId}
                accountTypeFilter={['asset', 'liability']}
                required
              />
            </div>
            {!accountId && (
              <p className="text-xs text-amber-600 mt-1">Choose the account this statement belongs to before importing.</p>
            )}
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="bg-white rounded-lg border p-4 flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Account:</span>{' '}
                <span className="font-medium">{metadata.accountNumber || 'Unknown'}</span>
              </div>
              {metadata.period && (
                <div>
                  <span className="text-gray-500">Period:</span>{' '}
                  <span className="font-medium">
                    {typeof metadata.period === 'string'
                      ? metadata.period
                      : `${metadata.period.start ?? ''} — ${metadata.period.end ?? ''}`}
                  </span>
                </div>
              )}
              {metadata.confidence && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${metadata.confidence >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  <Brain className="h-3 w-3 inline mr-0.5" />{Math.round(metadata.confidence * 100)}% confidence
                </span>
              )}
              {(metadata.openingBalance != null || metadata.closingBalance != null) && (
                <div className="text-gray-500">
                  <span>Balances:</span>{' '}
                  <span className="font-medium">
                    {metadata.openingBalance != null ? `$${parseFloat(metadata.openingBalance).toFixed(2)}` : '—'}
                    {' → '}
                    {metadata.closingBalance != null ? `$${parseFloat(metadata.closingBalance).toFixed(2)}` : '—'}
                  </span>
                </div>
              )}
              {metadata.extractionSource && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                  {metadata.extractionSource.replace(/_/g, ' ')}
                </span>
              )}
              <span className="text-gray-500">{transactions.length} transactions found</span>
            </div>
          )}

          {/* Reconciliation (Golden Rule: opening + Σ = closing) */}
          {metadata?.reconciliation && metadata.reconciliation.status !== 'skipped' && (
            <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
              metadata.reconciliation.status === 'verified'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {metadata.reconciliation.status === 'verified'
                ? <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              <div>
                {metadata.reconciliation.status === 'verified' ? (
                  <p>Statement reconciles: opening balance + transactions = closing balance.{metadata.reconciliation.repaired ? ` (auto-fixed: ${metadata.reconciliation.fixDescription})` : ''}</p>
                ) : (
                  <p>
                    Statement does <strong>not</strong> reconcile — off by ${Math.abs(metadata.reconciliation.deltaCents / 100).toFixed(2)}.
                    A transaction may be missing, duplicated, or mis-signed. Review before importing.
                  </p>
                )}
              </div>
            </div>
          )}

          {metadata && (metadata.qualityWarnings?.length ?? 0) > 0 && (
            <div className="mb-4">
              <OcrQualityNotice warnings={metadata.qualityWarnings} />
            </div>
          )}

          {/* Transaction Table */}
          <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selectedCount === transactions.filter((t) => !t.duplicate).length}
                      onChange={(e) => toggleAll(e.target.checked)} className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((txn, idx) => (
                  <tr key={idx} className={`${txn.duplicate ? 'opacity-50 bg-gray-50' : txn.selected ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={txn.selected} onChange={() => toggleRow(idx)}
                        disabled={txn.duplicate} className="rounded" />
                    </td>
                    <td className="px-4 py-2 text-gray-900">{txn.date}</td>
                    <td className="px-4 py-2 text-gray-900">
                      {txn.description}
                      {txn.duplicate && <span className="text-xs text-amber-600 ml-2">(duplicate)</span>}
                      {suspectByIndex[idx] !== undefined && (
                        <span className="text-xs text-amber-600 ml-2" title="Running balance disagrees with prior balance + amount">
                          ⚠ off by ${Math.abs(suspectByIndex[idx]! / 100).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'credit' ? '+' : '-'}${parseFloat(txn.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-gray-500 capitalize">{txn.type}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{txn.balance ? `$${parseFloat(txn.balance).toFixed(2)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import Actions */}
          {!imported ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{selectedCount} of {transactions.length} transactions selected</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setFile(null); setTransactions([]); setMetadata(null); }}>
                  Upload Different File
                </Button>
                <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending} disabled={selectedCount === 0 || !accountId}>
                  <Download className="h-4 w-4 mr-1" /> Import {selectedCount} Transactions
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-3">
              <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">Imported {imported.imported} transactions</p>
              {(imported.skipped ?? 0) > 0 && <p className="text-xs text-green-600">{imported.skipped} duplicates skipped</p>}
              <Button onClick={() => navigate('/banking/feed')}>Review in Bank Feed</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
