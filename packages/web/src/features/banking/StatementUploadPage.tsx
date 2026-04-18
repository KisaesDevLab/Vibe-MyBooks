// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAiConfig, useAiParseStatement } from '../../api/hooks/useAi';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileUp, Brain, Check, X, Loader2, Download, AlertTriangle } from 'lucide-react';
import { AiBannerForTask } from '../../components/ui/AiBannerForTask';
import { OcrQualityNotice } from '../../components/ui/OcrQualityNotice';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: string;
  type: 'debit' | 'credit';
  balance?: string;
  selected: boolean;
  duplicate: boolean;
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
  }
  const [metadata, setMetadata] = useState<StatementMetadata | null>(null);
  const [imported, setImported] = useState<{ imported: number; skipped?: number; duplicates?: number } | null>(null);
  const [bankConnectionId, setBankConnectionId] = useState('');

  const { data: aiConfig, isLoading: aiConfigLoading } = useAiConfig();
  const aiEnabled = aiConfig?.isEnabled === true;
  const parseStatement = useAiParseStatement();

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('attachableType', 'bank_statement');
      formData.append('attachableId', crypto.randomUUID());
      const res = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: async (data: { id?: string; attachment?: { id: string } }) => {
      const aid = data.id || data.attachment?.id;
      if (!aid) return;
      setAttachmentId(aid);

      // Auto-parse with AI
      setParsing(true);
      setParseError('');
      try {
        const result = await parseStatement.mutateAsync(aid);
        setTransactions((result.transactions || []).map((t) => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: (t.type === 'credit' ? 'credit' : 'debit'),
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
        });
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse statement. Try a different file format.');
      } finally {
        setParsing(false);
      }
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
          bankConnectionId: bankConnectionId || '00000000-0000-0000-0000-000000000000',
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
    setFile(f);
    setTransactions([]);
    setImported(null);
    setParseError('');
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

      {/* Upload Area */}
      {!file && aiEnabled && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center cursor-pointer hover:border-primary-400"
          onClick={() => document.getElementById('statement-input')?.click()}>
          <input id="statement-input" type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
          <FileUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Upload a bank statement (PDF or image)</p>
          <p className="text-xs text-gray-400 mt-1">AI will extract all transactions automatically</p>
        </div>
      )}

      {/* Processing */}
      {(uploadMutation.isPending || parsing) && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">{uploadMutation.isPending ? 'Uploading...' : 'AI parsing statement...'}</p>
          <p className="text-xs text-gray-400 mt-1">This may take a moment for multi-page documents</p>
        </div>
      )}

      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{parseError}</div>
      )}

      {/* Results */}
      {transactions.length > 0 && !parsing && (
        <div className="space-y-4">
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
              <span className="text-gray-500">{transactions.length} transactions found</span>
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
                <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending} disabled={selectedCount === 0}>
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
