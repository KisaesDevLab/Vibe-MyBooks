// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  useAiStatus,
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
  // STATEMENT_CHECK_PAYEE_V2 — the row's check number (from the parse result
  // or recovered from the description) and the user-editable payee, seeded
  // from the job result's check-image reads. Carried into the import body.
  checkNumber?: string;
  checkPayee: string;
}

// A payee read off a check image in the parse result (correlated to its row
// by check number). Mirrors the server's StatementCheckImage shape.
interface StatementCheck {
  checkNumber: string;
  payee: string;
  amount?: string;
}

// Same regex family the server uses to spot check rows in descriptions:
// "CHECK 1234", "CHK #1234", "CK NO. 1234", "DRAFT 1234" — or a bare "#1234".
// Deliberately NO bare "#NNN" fallback here: descriptions like
// "DEPOSIT REF #1234" or "INVOICE #1234" are not checks, and tagging them
// lets a deposit's row data override the real check 1234's image-read
// payee on import. Only explicit check prefixes qualify in the preview.
const CHECK_NUMBER_RE = /\b(?:CHECK|CHK|CK|DRAFT)\s*(?:NO\.?|#)?\s*(\d{1,7})\b/i;

// Prefer check data already carried on the parse-result row; otherwise
// recover the number from the description text.
function deriveCheckNumber(row: { [key: string]: unknown }, description: string): string | undefined {
  const carried = row['checkNumber'];
  if (typeof carried === 'string' && /^\d{1,7}$/.test(carried.trim())) {
    return carried.trim();
  }
  if (typeof carried === 'number' && Number.isFinite(carried) && carried > 0) {
    return String(carried);
  }
  const m = CHECK_NUMBER_RE.exec(description);
  return m?.[1];
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
  const [searchParams] = useSearchParams();
  const resumeJobId = searchParams.get('resume');
  const [file, setFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  // Set when the review was resumed from a saved parse job, so import marks that
  // job imported in the Statement Imports history.
  const [resumedJobId, setResumedJobId] = useState<string | null>(null);
  // The parse job behind a fresh upload. Sent with the import so the server
  // can capture the bank_statements record (statement-driven reconciliation)
  // and mark the job imported in the Statement Imports history.
  const [parseJobId, setParseJobId] = useState<string | null>(null);
  // Account auto-suggest: set when the account was pre-selected from a prior
  // statement with the same masked account number (user can still override).
  const [accountSuggested, setAccountSuggested] = useState(false);
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
  // Opt-in AI category/cleansed-name previews (dry-run, nothing imported yet),
  // keyed by row index. Populated by the "Preview categories" action.
  interface PreviewCell { cleanedName: string | null; suggestedAccountId: string | null; suggestedAccountName: string | null; tagId: string | null; confidence: number | null }
  const [previewByIndex, setPreviewByIndex] = useState<Record<number, PreviewCell>>({});
  const [previewError, setPreviewError] = useState('');
  const [imported, setImported] = useState<{
    imported: number; skipped?: number; duplicates?: number; duplicateWarning?: string;
    reconcileOnly?: boolean; lineCount?: number;
    cleansing?: { processed: number; aiCleansed: number; aiFailed: number; disabled: number; firstError?: string };
  } | null>(null);
  // Batch upload: a queue of selected files processed one at a time through the
  // same review/import UI. queueIndex is the file currently in review; batchDone
  // accumulates each file's outcome for the end-of-run summary.
  const [queue, setQueue] = useState<File[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  interface BatchOutcome { name: string; imported?: number; skipped?: boolean; failed?: string }
  const [batchDone, setBatchDone] = useState<BatchOutcome[]>([]);
  // The GL bank account the statement belongs to; the import find-or-creates a
  // manual connection for it server-side. Required before importing.
  const [accountId, setAccountId] = useState('');
  // Statement Match Engine wave 1 — import destination:
  //   'bank_feed'      import rows as bank feed items (current behavior)
  //   'reconcile_only' books already entered (manual / live bank feed):
  //                    store the statement + its lines for reconciliation
  //                    matching, import nothing into the feed.
  const [importMode, setImportMode] = useState<'bank_feed' | 'reconcile_only'>('bank_feed');
  // "Force OCR": skip the PDF's embedded-text fast path and OCR every page.
  // Useful when a statement's text layer is missing or garbled.
  const [forceOcr, setForceOcr] = useState(false);
  // Live processing stage from the SSE progress stream.
  const [stage, setStage] = useState<string | null>(null);
  const progressCtrl = useRef<AbortController | null>(null);

  // Gate on the NON-admin feature endpoint (/ai/status). The previous
  // useAiConfig hit /ai/admin/config, which is super-admin-only and 403s for
  // every normal user — so the dropzone never rendered and the page looked
  // permanently "AI not enabled" even when statement parsing was configured.
  const { data: aiStatus, isLoading: aiConfigLoading } = useAiStatus();
  const aiEnabled = aiStatus?.hasStatementParser === true;
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
    // Payees read off check images in the parse result, keyed by the
    // numeric check number (leading zeros normalized away on both sides).
    const checks = (result as ParsedStatement & { checks?: StatementCheck[] }).checks ?? [];
    const payeeByCheckNumber = new Map<string, string>();
    for (const c of checks) {
      const n = Number(c.checkNumber);
      if (Number.isFinite(n) && n > 0 && c.payee) payeeByCheckNumber.set(String(n), c.payee);
    }
    setTransactions((result.transactions ?? []).map((t) => {
      const checkNumber = deriveCheckNumber(t, t.description);
      return {
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type === 'credit' ? 'credit' : 'debit',
        selected: true,
        duplicate: false,
        checkNumber,
        checkPayee: checkNumber ? (payeeByCheckNumber.get(String(Number(checkNumber))) ?? '') : '',
      } satisfies ParsedTransaction;
    }));
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
    setPreviewByIndex({});
    setPreviewError('');
  };

  // Abort any in-flight progress stream on unmount.
  useEffect(() => () => progressCtrl.current?.abort(), []);

  // Resume a saved statement parse (from the Statement Imports list): load the
  // persisted extraction straight into the review table — no re-upload/re-parse.
  useEffect(() => {
    if (!resumeJobId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient<{ result: ParsedStatement | null; attachmentId: string | null }>(
          `/ai/parse/statement/jobs/${resumeJobId}`,
        );
        if (cancelled) return;
        if (data.result && (data.result.transactions?.length ?? 0) > 0) {
          applyResult(data.result);
          setAttachmentId(data.attachmentId);
          setResumedJobId(resumeJobId);
          setQueue([]); // resume is a single statement, not a batch
          setImported(null);
          setParseError('');
        } else {
          setParseError('This statement has no saved transactions to resume. Re-upload it to parse again.');
        }
      } catch (err) {
        if (!cancelled) setParseError(err instanceof Error ? err.message : 'Could not load the saved statement.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeJobId]);

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
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/attachments`, {
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
        const { jobId } = await startParse.mutateAsync({ attachmentId: aid, forceOcr });
        setParseJobId(jobId);
        const ctrl = new AbortController();
        progressCtrl.current?.abort();
        progressCtrl.current = ctrl;
        let failure: string | null = null;
        let gotResult = false;
        await pollStatementProgress(jobId, (snap) => {
          if (snap.stage) setStage(snap.stage);
          if (snap.status === 'complete') {
            if (snap.result) {
              applyResult(snap.result);
              gotResult = true;
              // A successful parse that found NOTHING must not render a blank
              // page — surface why (notes / quality warnings) so the user can
              // act (clearer scan, or a CSV/OFX export).
              if ((snap.result.transactions ?? []).length === 0) {
                const why = snap.result.notes
                  || (Array.isArray(snap.result.qualityWarnings) && snap.result.qualityWarnings.length
                    ? snap.result.qualityWarnings.join('; ')
                    : '');
                failure = `No transactions were found in this statement.${why ? ` (${why})` : ''} Try a clearer scan, or import a CSV/OFX export instead.`;
              }
            } else failure = 'Parsing finished but returned no transactions.';
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
    // Statement-driven reconciliation: the captured bank_statements record +
    // a warning when a statement for an overlapping period already exists.
    statementId?: string;
    duplicateWarning?: string;
    // Reconciliation-only mode: no feed items imported; lineCount statement
    // lines were stored for the match engine.
    reconcileOnly?: boolean;
    lineCount?: number;
    // Additive cleansing-outcome payload (bank-feed CleansingAggregate) —
    // aiFailed > 0 means the AI description cleanup degraded to regex-only.
    cleansing?: { processed: number; aiCleansed: number; aiFailed: number; disabled: number; firstError?: string };
  }
  const importMutation = useMutation({
    mutationFn: async () => {
      // Keep the original row index so we can attach each row's preview
      // (cleaned name + category/tag) — carried into the feed at import.
      const selected = transactions
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.selected && !t.duplicate);
      const res = await apiClient<StatementImportResult>('/ai/parse/statement/import', {
        method: 'POST',
        body: JSON.stringify({
          // The server find-or-creates the manual bank connection for this
          // account, so the statement rows land under the chosen GL account.
          accountId,
          // The parse job behind this review (resume OR fresh upload) — the
          // server marks it imported and captures the bank_statements record
          // from its persisted parse result.
          jobId: resumedJobId ?? parseJobId ?? undefined,
          // 'bank_feed' (default) or 'reconcile_only' (statement + lines only,
          // no feed items — books already entered).
          importMode,
          transactions: selected.map(({ t, i }) => {
            const p = previewByIndex[i];
            return {
              date: t.date, description: t.description, amount: t.amount, type: t.type,
              // Carry the reviewed cleaned name + category/tag so the bank feed
              // shows exactly what was reviewed.
              cleanedName: p?.cleanedName ?? undefined,
              suggestedAccountId: p?.suggestedAccountId ?? undefined,
              tagId: p?.tagId ?? undefined,
              // STATEMENT_CHECK_PAYEE_V2 — the row's check number + the
              // (possibly edited) payee; blank payees are omitted.
              checkNumber: t.checkNumber ?? undefined,
              checkPayee: t.checkNumber && t.checkPayee.trim() ? t.checkPayee.trim() : undefined,
            };
          }),
        }),
      });
      return res;
    },
    onSuccess: (data) => setImported(data),
  });

  // Opt-in dry-run categorization for the parsed rows: shows the suggested
  // account + cleaned name BEFORE import, without writing to the feed. The real
  // categorization still runs server-side at import time.
  interface PreviewRow { index: number; cleanedName: string | null; suggestedAccountId: string | null; suggestedAccountName: string | null; tagId: string | null; confidence: number | null; error?: string }
  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient<{ rows: PreviewRow[] }>('/ai/categorize/preview', {
        method: 'POST',
        body: JSON.stringify({ transactions: transactions.slice(0, 300).map((t) => ({ description: t.description, amount: t.amount })) }),
      });
      return res.rows;
    },
    onSuccess: (rows) => {
      const map: Record<number, PreviewCell> = {};
      for (const r of rows) map[r.index] = { cleanedName: r.cleanedName, suggestedAccountId: r.suggestedAccountId, suggestedAccountName: r.suggestedAccountName, tagId: r.tagId, confidence: r.confidence };
      setPreviewByIndex(map);
      setPreviewError('');
    },
    onError: (err: unknown) => setPreviewError(err instanceof Error ? err.message : 'Categorization preview failed'),
  });

  // Account auto-suggest: when the parse read a masked account number, look
  // up the most recent statement on file with the same masked number and
  // pre-select its GL account (the user can override).
  useEffect(() => {
    const masked = metadata?.accountNumber;
    if (!masked || accountId || transactions.length === 0 || imported) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient<{ suggestion: { accountId: string; accountName: string } | null }>(
          `/banking/statements/suggest-account?masked=${encodeURIComponent(masked)}`,
        );
        if (!cancelled && res.suggestion) {
          setAccountId(res.suggestion.accountId);
          setAccountSuggested(true);
        }
      } catch { /* suggestion is best-effort */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata?.accountNumber, transactions.length]);

  // Auto-run the cleaned-name + category preview once transactions load, so the
  // review shows them without a click (and they carry into the feed on import).
  useEffect(() => {
    if (aiEnabled && transactions.length > 0 && Object.keys(previewByIndex).length === 0
      && !imported && !previewMutation.isPending && !previewError) {
      previewMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length, imported, aiEnabled]);

  // Reset all per-file state and begin uploading + parsing a single file.
  const startFile = (f: File) => {
    progressCtrl.current?.abort();
    setResumedJobId(null); // a fresh upload is not a resume
    setParseJobId(null);
    setAccountSuggested(false);
    setFile(f);
    setTransactions([]);
    setSuspectByIndex({});
    setPreviewByIndex({});
    setPreviewError('');
    setImported(null);
    setParseError('');
    setStage(null);
    setAccountId(''); // each statement may belong to a different account
    setImportMode('bank_feed');
    uploadMutation.mutate(f);
  };

  const [bgUploading, setBgUploading] = useState<{ done: number; total: number } | null>(null);

  // Upload one file and enqueue its parse WITHOUT waiting for extraction — the
  // job runs in the background (worker/watchdog). Returns true on success.
  const uploadAndEnqueue = async (f: File): Promise<boolean> => {
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('attachableType', 'bank_statement');
      fd.append('attachableId', genUuidV4());
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: fd,
      });
      if (!res.ok) return false;
      const data = await res.json();
      const aid = data.id || data.attachment?.id;
      if (!aid) return false;
      await startParse.mutateAsync({ attachmentId: aid, forceOcr }); // enqueue only (202) — extraction runs in background
      return true;
    } catch { return false; }
  };

  // Begin upload — shared by the file picker and drag-drop. A single file gets
  // the immediate foreground review; multiple files upload + enqueue in the
  // BACKGROUND and land in Statement Processing to review as each finishes.
  const beginBatch = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) {
      setQueue(files); setQueueIndex(0); setBatchDone([]);
      startFile(files[0]!);
      return;
    }
    setBgUploading({ done: 0, total: files.length });
    let ok = 0;
    for (let i = 0; i < files.length; i += 1) {
      if (await uploadAndEnqueue(files[i]!)) ok += 1;
      setBgUploading({ done: i + 1, total: files.length });
    }
    setBgUploading(null);
    navigate(`/banking/statement-imports?uploaded=${ok}`);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void beginBatch(Array.from(e.target.files ?? []));
    e.target.value = ''; // allow re-selecting the same file(s) later
  };

  const [isDragging, setIsDragging] = useState(false);
  const isAcceptedFile = (f: File) =>
    f.type === 'application/pdf' || f.type.startsWith('image/') || /\.(pdf|png|jpe?g|gif|webp|tiff?)$/i.test(f.name);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
    if (files.length === 0) {
      setParseError('Only PDF or image statement files can be dropped here.');
      return;
    }
    void beginBatch(files);
  };

  // Record the current file's outcome and advance to the next queued file, or
  // end the batch (clear the active file so the summary renders).
  const advanceQueue = (outcome: BatchOutcome) => {
    setBatchDone((d) => [...d, outcome]);
    const next = queueIndex + 1;
    setQueueIndex(next);
    if (next < queue.length) {
      startFile(queue[next]!);
    } else {
      progressCtrl.current?.abort();
      setFile(null);
      setTransactions([]);
      setImported(null);
      setParseError('');
      setStage(null);
    }
  };

  const skipFile = () => {
    progressCtrl.current?.abort();
    const name = file?.name ?? `File ${queueIndex + 1}`;
    advanceQueue(parseError ? { name, failed: parseError } : { name, skipped: true });
  };

  const moreFilesQueued = queueIndex + 1 < queue.length;
  const isBatch = queue.length > 1;

  const toggleAll = (checked: boolean) => {
    setTransactions((txns) => txns.map((t) => ({ ...t, selected: t.duplicate ? false : checked })));
  };

  const toggleRow = (idx: number) => {
    setTransactions((txns) => txns.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  // Edit the payee carried with a check row (seeded from the check-image read,
  // blank when the parse couldn't read one).
  const setCheckPayee = (idx: number, value: string) => {
    setTransactions((txns) => txns.map((t, i) => (i === idx ? { ...t, checkPayee: value } : t)));
  };

  const selectedCount = transactions.filter((t) => t.selected && !t.duplicate).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Bank Statement</h1>
        <AiBannerForTask task="statement_parsing" />
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={() => navigate('/banking/statement-imports')}>
            Statement Processing
          </Button>
        </div>
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

      {/* Batch queue progress — which file of the batch is in review now. */}
      {isBatch && file && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-center justify-between gap-3">
          <span>
            Processing file <span className="font-medium">{queueIndex + 1}</span> of {queue.length}:{' '}
            <span className="font-medium">{file.name}</span>
            {batchDone.length > 0 && <span className="text-blue-600"> · {batchDone.length} done</span>}
          </span>
          <Button size="sm" variant="secondary" onClick={skipFile}>Skip this file</Button>
        </div>
      )}

      {/* Batch summary — shown once the last queued file is handled. */}
      {batchDone.length > 0 && queueIndex >= queue.length && (
        <div className="bg-white rounded-lg border p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-2">Batch complete — {batchDone.length} file{batchDone.length === 1 ? '' : 's'}</p>
          <ul className="text-sm space-y-1">
            {batchDone.map((b, i) => (
              <li key={i} className="flex items-center gap-2">
                {b.failed ? <X className="h-4 w-4 text-red-500 flex-shrink-0" /> : b.skipped ? <X className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                <span className="text-gray-700">{b.name}</span>
                <span className="text-gray-500">— {b.failed ? `failed: ${b.failed}` : b.skipped ? 'skipped' : `imported ${b.imported ?? 0}`}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button size="sm" onClick={() => navigate('/banking/feed')}>Review in Bank Feed</Button>
          </div>
        </div>
      )}

      {/* Upload Area — shown whenever we're idle with no results (initial load
          OR after an error), so the user can always (re)pick a file. */}
      {aiEnabled && !parsing && !uploadMutation.isPending && !bgUploading && transactions.length === 0 && !imported && !(isBatch && file) && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700 w-fit">
            <input
              type="checkbox"
              checked={forceOcr}
              onChange={(e) => setForceOcr(e.target.checked)}
              className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
            />
            <span>
              Force OCR
              <span className="block text-xs text-gray-400">
                Re-scan every page instead of reading the PDF’s embedded text. Slower, but use it when extraction misses rows or the statement’s text layer is wrong.
              </span>
            </span>
          </label>
          <div
            className={`bg-white rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'}`}
            onClick={() => document.getElementById('statement-input')?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!isDragging) setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}>
            <input id="statement-input" type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileChange} />
            <FileUp className={`h-12 w-12 mx-auto mb-3 ${isDragging ? 'text-primary-500' : 'text-gray-300'}`} />
            <p className="text-sm text-gray-600">{isDragging ? 'Drop to upload' : (file ? 'Upload a different statement' : 'Drag & drop bank statements here, or click to browse')}</p>
            <p className="text-xs text-gray-400 mt-1">PDF or image · AI extracts all transactions automatically · drop multiple files to import a batch{forceOcr ? ' · Force OCR on' : ''}</p>
          </div>
        </div>
      )}

      {/* Background multi-upload: enqueue all, then go to Statement Processing. */}
      {bgUploading && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Uploading statements… ({bgUploading.done}/{bgUploading.total})</p>
          <p className="text-xs text-gray-400 mt-1">Extraction runs in the background — you’ll review each one in Statement Processing.</p>
        </div>
      )}

      {/* Processing */}
      {(uploadMutation.isPending || parsing) && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            {/* react-query keeps uploadMutation.isPending true for the whole
                async onSuccess (which runs the parse), so check `parsing` FIRST
                — otherwise the label sticks on "Uploading…" and the stage
                progress (detecting → ocr → extracting) is never shown. */}
            {parsing
              ? ((stage && STAGE_LABELS[stage]) || 'AI parsing statement...')
              : 'Uploading...'}
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
            {accountId && accountSuggested && (
              <p className="text-xs text-gray-500 mt-1">
                Suggested from a previous statement with the same account number — change it if this is wrong.
              </p>
            )}

            {/* Import destination (Statement Match Engine wave 1). */}
            <fieldset className="mt-4 border-t pt-3">
              <legend className="sr-only">Import destination</legend>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  className="mt-0.5"
                  checked={importMode === 'bank_feed'}
                  onChange={() => setImportMode('bank_feed')}
                />
                <span className="text-sm text-gray-800">
                  Import transactions to the bank feed
                  <span className="block text-xs text-gray-500">
                    Rows land in the bank feed for categorization and posting.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer mt-2">
                <input
                  type="radio"
                  name="import-mode"
                  className="mt-0.5"
                  checked={importMode === 'reconcile_only'}
                  onChange={() => setImportMode('reconcile_only')}
                />
                <span className="text-sm text-gray-800">
                  Reconciliation only — my transactions are already entered (manual books / live bank feed)
                  <span className="block text-xs text-gray-500">
                    Nothing is imported; the statement is stored so its lines can be matched against your books at reconciliation time.
                  </span>
                </span>
              </label>
            </fieldset>
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

          {/* Category preview (opt-in, dry-run) */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => previewMutation.mutate()} loading={previewMutation.isPending}>
              <Brain className="h-4 w-4 mr-1" /> Preview categories
            </Button>
            {previewError && <span className="text-sm text-red-600">{previewError}</span>}
            {!previewError && Object.keys(previewByIndex).length > 0 && (
              <span className="text-xs text-gray-500">Suggestions only — the same AI categorization runs automatically when you import.</span>
            )}
            {!previewError && Object.keys(previewByIndex).length === 0 && !previewMutation.isPending && (
              <span className="text-xs text-gray-400">See the suggested account &amp; cleaned name for each row before importing.</span>
            )}
          </div>

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
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Check # / Payee</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Suggested Category</th>
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
                      {previewByIndex[idx]?.cleanedName && previewByIndex[idx]!.cleanedName !== txn.description && (
                        <div className="text-xs text-gray-500 mt-0.5">→ {previewByIndex[idx]!.cleanedName}</div>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'credit' ? '+' : '-'}${parseFloat(txn.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-gray-500 capitalize">{txn.type}</td>
                    <td className="px-4 py-2">
                      {txn.checkNumber ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 whitespace-nowrap">#{txn.checkNumber}</span>
                          <input
                            type="text"
                            value={txn.checkPayee}
                            onChange={(e) => setCheckPayee(idx, e.target.value)}
                            placeholder="Payee"
                            aria-label={`Payee for check ${txn.checkNumber}`}
                            className="rounded-md border-gray-300 text-sm px-2 py-1 w-36"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {previewByIndex[idx] ? (
                        previewByIndex[idx]!.suggestedAccountName ? (
                          <span className="text-gray-900">
                            {previewByIndex[idx]!.suggestedAccountName}
                            {previewByIndex[idx]!.confidence != null && (
                              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${previewByIndex[idx]!.confidence! >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {Math.round(previewByIndex[idx]!.confidence! * 100)}%
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No match</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
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
                {isBatch ? (
                  <Button variant="secondary" onClick={skipFile}>Skip this file</Button>
                ) : (
                  <Button variant="secondary" onClick={() => { setFile(null); setTransactions([]); setMetadata(null); }}>
                    Upload Different File
                  </Button>
                )}
                <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending} disabled={selectedCount === 0 || !accountId}>
                  <Download className="h-4 w-4 mr-1" />{' '}
                  {importMode === 'reconcile_only' ? 'Save Statement for Reconciliation' : `Import ${selectedCount} Transactions`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-3">
              <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">
                {imported.reconcileOnly
                  ? `Statement saved for reconciliation — ${imported.lineCount ?? 0} lines stored, nothing imported to the bank feed`
                  : `Imported ${imported.imported} transactions`}
              </p>
              {(imported.skipped ?? 0) > 0 && <p className="text-xs text-green-600">{imported.skipped} duplicates skipped</p>}
              {(imported.cleansing?.aiFailed ?? 0) > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
                  AI cleanup unavailable — {imported.cleansing!.aiFailed} description{imported.cleansing!.aiFailed === 1 ? '' : 's'} kept regex-only cleaning.
                  {imported.cleansing!.firstError ? ` ${imported.cleansing!.firstError}` : ''}
                </p>
              )}
              {imported.duplicateWarning && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
                  {imported.duplicateWarning}
                </p>
              )}
              <div className="flex gap-2 justify-center">
                {isBatch && (
                  <Button onClick={() => advanceQueue({ name: file?.name ?? `File ${queueIndex + 1}`, imported: imported.imported })}>
                    {moreFilesQueued ? `Next file (${queueIndex + 2} of ${queue.length})` : 'Finish batch'}
                  </Button>
                )}
                {imported.reconcileOnly ? (
                  <Button variant={isBatch ? 'secondary' : undefined} onClick={() => navigate('/banking/reconcile')}>
                    Go to Reconciliation
                  </Button>
                ) : (
                  <Button variant={isBatch ? 'secondary' : undefined} onClick={() => navigate('/banking/feed')}>Review in Bank Feed</Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
