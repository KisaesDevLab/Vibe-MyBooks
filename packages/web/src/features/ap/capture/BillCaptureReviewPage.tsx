// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bill Capture review: the captured document on the left, a pre-filled
// Bill form on the right. Posts through the same createBill path as Enter
// Bill (server side), so the result lands in Pay Bills unchanged.
//
// Lines mode: the AI's lines are kept in `detailedLines`; Single mode edits
// a separate one-row `singleLine` seeded from the total and the vendor's
// default expense account/tag. Toggling never loses either, and the mode
// is remembered on the vendor by the server.

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { BillCaptureDetail, EnterBillCaptureInput, JournalLine, Transaction } from '@kis-books/shared';
import { todayLocalISO } from '../../../utils/date';
import {
  useBillCapture,
  useBillCaptureFileUrl,
  useDiscardBillCapture,
  useEnterBillCapture,
  useReprocessBillCapture,
} from '../../../api/hooks/useBillCaptures';
import { useBill } from '../../../api/hooks/useAp';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useToast } from '../../../components/ui/Toaster';
import { DatePicker } from '../../../components/forms/DatePicker';
import { ContactSelector } from '../../../components/forms/ContactSelector';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { BillLinesTable } from '../BillLinesTable';
import {
  type BillLine,
  VALID_TERMS,
  calcDueDate,
  emptyLine,
  extractionToLines,
  singleLineFromTotal,
} from '../billFormShared';
import { AlertTriangle, ArrowLeft, ChevronRight, Copy, RefreshCw, RotateCw, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

type LinesMode = 'detailed' | 'single';

interface ApiErrorLike { message: string; code?: string; details?: Record<string, unknown> }
function asApiError(err: unknown): ApiErrorLike {
  const e = err as Partial<ApiErrorLike> | null;
  return { message: e?.message || 'Request failed', code: e?.code, details: e?.details };
}

const SKIP_COPY: Record<string, string> = {
  ai_disabled: 'AI processing is off for this installation, so nothing was pre-filled.',
  ai_function_disabled: 'Bill OCR is switched off in Admin → AI, so nothing was pre-filled.',
  ai_consent_blocked: 'AI consent has not been granted for this company, so nothing was pre-filled.',
  unsupported_type: 'This file type cannot be read automatically.',
};

function confidenceBadge(c: number | null | undefined) {
  if (c == null) return null;
  if (c >= 0.85) return { label: 'High confidence', cls: 'bg-green-100 text-green-700' };
  if (c >= 0.6) return { label: 'Medium confidence', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Low confidence — please check every field', cls: 'bg-red-100 text-red-700' };
}

// ─── Document viewer ────────────────────────────────────────────────

function DocumentViewer({ captureId, mimeType, fileName }: { captureId: string; mimeType: string | null; fileName: string }) {
  const { url, error } = useBillCaptureFileUrl(captureId);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const isPdf = mimeType === 'application/pdf';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col xl:sticky xl:top-4 xl:h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500 truncate" title={fileName}>{fileName}</span>
        {!isPdf && (
          <div className="flex items-center gap-1">
            <button type="button" className="p-1 text-gray-500 hover:text-gray-800" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></button>
            <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" className="p-1 text-gray-500 hover:text-gray-800" title="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></button>
            <button type="button" className="p-1 text-gray-500 hover:text-gray-800" title="Rotate" onClick={() => setRotate((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 min-h-[24rem] xl:min-h-0">
        {error && <p className="text-sm text-red-600 p-4">{error}</p>}
        {!url && !error && <div className="h-full flex items-center justify-center p-8"><LoadingSpinner /></div>}
        {url && isPdf && <iframe title="Bill" src={url} className="w-full h-full min-h-[24rem]" />}
        {url && !isPdf && (
          <div className="p-3">
            <img
              src={url}
              alt="Bill"
              style={{ transform: `scale(${zoom}) rotate(${rotate}deg)`, transformOrigin: 'top left', maxWidth: zoom === 1 ? '100%' : 'none' }}
              className="shadow"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Review page ────────────────────────────────────────────────────

export function BillCaptureReviewPage() {
  const { captureId } = useParams<{ captureId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useBillCapture(captureId);
  const enter = useEnterBillCapture();
  const discard = useDiscardBillCapture();
  const reprocess = useReprocessBillCapture();

  const capture = data?.capture ?? null;
  const nextReadyId = data?.nextReadyId ?? null;

  // An entered capture shows the bill AS POSTED, not the AI's original
  // reading: the vendor, accounts and tags the user picked live on the bill,
  // and re-seeding from the extraction made a finished bill look like
  // everything keyed into it had been lost.
  const postedBillId = capture?.status === 'entered' ? capture.billId ?? '' : '';
  const { data: postedBillData, isError: postedBillMissing } = useBill(postedBillId);
  const postedBill = postedBillData?.bill ?? null;

  // Form state, seeded once per capture (see effect below).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [contactId, setContactId] = useState('');
  const [newVendorMode, setNewVendorMode] = useState(false);
  const [newVendor, setNewVendor] = useState({ displayName: '', billingLine1: '', billingLine2: '', billingCity: '', billingState: '', billingZip: '', defaultExpenseAccountId: '' });
  const [txnDate, setTxnDate] = useState(todayLocalISO());
  const [dueDate, setDueDate] = useState('');
  const [dueDateManual, setDueDateManual] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [customDays, setCustomDays] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [linesMode, setLinesMode] = useState<LinesMode>('detailed');
  const [detailedLines, setDetailedLines] = useState<BillLine[]>([emptyLine()]);
  const [singleLine, setSingleLine] = useState<BillLine>(emptyLine());
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [serverDuplicate, setServerDuplicate] = useState<{ transactionId: string; txnNumber: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seed = (c: BillCaptureDetail) => {
    const ext = c.extraction;
    const vd = c.vendorDefaults;
    const resolvedContact = ext?.contactId ?? c.suggestedContactId ?? '';
    setContactId(resolvedContact);
    setNewVendorMode(false);
    setNewVendor({
      displayName: ext?.vendor ?? '',
      billingLine1: ext?.vendorAddress?.line1 ?? '',
      billingLine2: ext?.vendorAddress?.line2 ?? '',
      billingCity: ext?.vendorAddress?.city ?? '',
      billingState: ext?.vendorAddress?.state ?? '',
      billingZip: ext?.vendorAddress?.zip ?? '',
      defaultExpenseAccountId: '',
    });
    setTxnDate(ext?.billDate || todayLocalISO());
    const terms = ext?.paymentTerms && VALID_TERMS.has(ext.paymentTerms)
      ? ext.paymentTerms
      : vd?.defaultPaymentTerms && VALID_TERMS.has(vd.defaultPaymentTerms) ? vd.defaultPaymentTerms : 'net_30';
    setPaymentTerms(terms);
    setCustomDays('');
    if (ext?.dueDate) { setDueDate(ext.dueDate); setDueDateManual(true); }
    else { setDueDate(''); setDueDateManual(false); }
    setVendorInvoiceNumber(ext?.vendorInvoiceNumber ?? '');
    setMemo(ext?.notes ?? '');
    setInternalNotes('');
    const acct = vd?.defaultExpenseAccountId ?? ext?.defaultExpenseAccountId ?? null;
    const tag = vd?.defaultTagId ?? null;
    const base = { lineItems: ext?.lineItems ?? [], defaultExpenseAccountId: acct, total: ext?.total ?? null, notes: ext?.notes ?? null };
    const detailed = extractionToLines(base, tag);
    setDetailedLines(detailed.length > 0 ? detailed : [singleLineFromTotal(base, tag)]);
    setSingleLine(singleLineFromTotal(base, tag, ext?.vendor ? `${ext.vendor} invoice` : 'Vendor invoice'));
    setLinesMode(vd?.billLinesMode ?? 'detailed');
    setOverrideDuplicate(false);
    setServerDuplicate(null);
    setError(null);
  };

  // Same mapping EnterBillPage uses to load a bill for editing: the expense
  // side is the debit lines.
  const seedFromBill = (c: BillCaptureDetail, b: Transaction) => {
    setContactId(b.contactId || '');
    setNewVendorMode(false);
    setTxnDate(b.txnDate || todayLocalISO());
    setDueDate(b.dueDate || '');
    setDueDateManual(true);
    setPaymentTerms(b.paymentTerms && VALID_TERMS.has(b.paymentTerms) ? b.paymentTerms : 'net_30');
    setCustomDays(b.termsDays ? String(b.termsDays) : '');
    setVendorInvoiceNumber(b.vendorInvoiceNumber || '');
    setMemo(b.memo || '');
    setInternalNotes(b.internalNotes || '');
    const billLines: BillLine[] = (b.lines || [])
      .filter((l: JournalLine) => parseFloat(l.debit) > 0 && l.accountId)
      .map((l: JournalLine) => ({
        accountId: l.accountId,
        description: l.description || '',
        amount: parseFloat(l.debit).toFixed(2),
        tagId: l.tagId ?? null,
        userHasTouchedTag: l.tagId != null,
      }));
    // One posted line against an itemized invoice = it was posted in
    // "Single line at the total" mode.
    const postedSingle = billLines.length === 1 && (c.extraction?.lineItems?.length ?? 0) > 1;
    if (postedSingle) setSingleLine(billLines[0]!);
    else if (billLines.length > 0) setDetailedLines(billLines);
    setLinesMode(postedSingle ? 'single' : 'detailed');
    setOverrideDuplicate(false);
    setServerDuplicate(null);
    setError(null);
  };

  useEffect(() => {
    if (!capture) return;
    // Wait for the read to finish so we seed from the extraction, unless it
    // is taking long — the user can start keying and we won't clobber it.
    if (capture.status === 'received' || capture.status === 'processing') return;
    if (postedBillId) {
      const key = `${capture.id}:bill`;
      if (postedBill) {
        if (seededFor === key) return;
        seedFromBill(capture, postedBill);
        setSeededFor(key);
        return;
      }
      // Still loading the bill: hold off rather than flash the extraction.
      // Only if the bill can't be read (deleted) fall back to what was scanned.
      if (!postedBillMissing) return;
    }
    if (seededFor === capture.id) return;
    seed(capture);
    setSeededFor(capture.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture?.id, capture?.status, postedBillId, postedBill, postedBillMissing]);

  // Terms → due date auto-calc, unless the user (or the AI) set it explicitly.
  // Not before the seed has landed: on the first commit this effect would
  // otherwise overwrite the AI's due date with today + terms.
  useEffect(() => {
    if (dueDateManual || !seededFor) return;
    setDueDate(calcDueDate(txnDate, paymentTerms, customDays));
  }, [txnDate, paymentTerms, customDays, dueDateManual, seededFor]);

  // When the vendor changes to a known contact, re-apply its default account
  // to lines that still have no account.
  const applyVendorDefaults = (acct: string | null) => {
    if (!acct) return;
    setDetailedLines((prev) => prev.map((l) => (l.accountId ? l : { ...l, accountId: acct })));
    setSingleLine((prev) => (prev.accountId ? prev : { ...prev, accountId: acct }));
  };

  const activeLines = linesMode === 'single' ? [singleLine] : detailedLines;
  const total = activeLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const vendorReady = newVendorMode ? newVendor.displayName.trim().length > 0 : !!contactId;
  const badge = useMemo(() => confidenceBadge(capture?.extraction?.confidence), [capture?.extraction?.confidence]);

  const buildInput = (): EnterBillCaptureInput => ({
    ...(newVendorMode
      ? {
        newVendor: {
          displayName: newVendor.displayName.trim(),
          billingLine1: newVendor.billingLine1 || null,
          billingLine2: newVendor.billingLine2 || null,
          billingCity: newVendor.billingCity || null,
          billingState: newVendor.billingState || null,
          billingZip: newVendor.billingZip || null,
          defaultExpenseAccountId: newVendor.defaultExpenseAccountId || (activeLines[0]?.accountId || null),
        },
      }
      : { contactId }),
    txnDate,
    dueDate: dueDate || undefined,
    paymentTerms,
    termsDays: paymentTerms === 'custom' && customDays ? parseInt(customDays, 10) : undefined,
    vendorInvoiceNumber: vendorInvoiceNumber || undefined,
    memo: memo || undefined,
    internalNotes: internalNotes || undefined,
    linesMode,
    overrideDuplicate,
    lines: activeLines
      .filter((l) => l.accountId && l.amount && parseFloat(l.amount) > 0)
      .map((l) => ({ accountId: l.accountId, description: l.description || undefined, amount: l.amount, tagId: l.tagId })),
  });

  const post = (andNext: boolean) => {
    if (!capture) return;
    setError(null);
    const input = buildInput();
    if (input.lines.length === 0) { setError('Add at least one line with an account and an amount.'); return; }
    enter.mutate({ id: capture.id, input }, {
      onSuccess: (res) => {
        toast.success(`Bill ${res.bill.txnNumber ? `${res.bill.txnNumber} ` : ''}posted${res.createdVendorId ? ' and vendor created' : ''}`);
        if (andNext) {
          if (nextReadyId) { setSeededFor(null); navigate(`/bills/capture/${nextReadyId}`); return; }
          toast.info('That was the last bill in the queue.');
        }
        navigate('/bills/capture');
      },
      onError: (err) => {
        const e = asApiError(err);
        if (e.code === 'BILL_CAPTURE_DUPLICATE') {
          setServerDuplicate({ transactionId: String(e.details?.['transactionId'] ?? ''), txnNumber: (e.details?.['txnNumber'] as string | null) ?? null });
          setError('This looks like a duplicate. Tick "Post anyway" if it is a different bill.');
          return;
        }
        if (e.code === 'BILL_CAPTURE_ALREADY_ENTERED') {
          const billId = e.details?.['billId'];
          toast.info('This bill was already entered.');
          navigate(billId ? `/bills/${String(billId)}` : '/bills/capture');
          return;
        }
        setError(e.message);
      },
    });
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); post(false); };

  const onDiscard = () => {
    if (!capture || !window.confirm('Discard this bill? The file is kept but it leaves the queue.')) return;
    discard.mutate(capture.id, {
      onSuccess: () => { toast.info('Discarded'); navigate(nextReadyId ? `/bills/capture/${nextReadyId}` : '/bills/capture'); },
      onError: (err) => toast.error(asApiError(err).message),
    });
  };

  if (isLoading) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;
  if (isError || !capture) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700 mb-3">Couldn't load this capture.</p>
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/bills/capture')}>Back to queue</Button>
        </div>
      </div>
    );
  }

  const reading = capture.status === 'received' || capture.status === 'processing';
  const duplicate = serverDuplicate ?? capture.duplicate;
  const entered = capture.status === 'entered';
  const unknownVendor = !entered && !newVendorMode && !contactId && !!capture.extraction?.vendor;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/bills/capture" className="text-gray-400 hover:text-gray-700" title="Back to queue"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-2xl font-bold text-gray-900 truncate">Review bill</h1>
          {badge && <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}><Sparkles className="inline h-3 w-3 mr-1" />{badge.label}</span>}
        </div>
        <div className="flex items-center gap-2">
          {capture.status !== 'entered' && capture.status !== 'discarded' && !reading && (
            <Button type="button" variant="secondary" size="sm" onClick={() => reprocess.mutate(capture.id, { onSuccess: () => { setSeededFor(null); toast.info('Re-reading…'); }, onError: (err) => toast.error(asApiError(err).message) })} loading={reprocess.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" /> Re-read
            </Button>
          )}
          {nextReadyId && (
            <Button type="button" variant="secondary" size="sm" onClick={() => { setSeededFor(null); navigate(`/bills/capture/${nextReadyId}`); }}>
              Skip <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {capture.status === 'entered' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-800">
          This bill was already entered{capture.billTxnNumber ? ` as ${capture.billTxnNumber}` : ''}.
          {postedBill
            ? ' Shown below as it was posted. To change it, '
            : postedBillMissing ? ' The posted bill could not be loaded, so this shows what was read from the file.' : ''}
          {capture.billId && <Link className={postedBill ? 'underline' : 'ml-2 underline'} to={`/bills/${capture.billId}`}>{postedBill ? 'open the bill' : 'Open the bill'}</Link>}
          {postedBill && '.'}
        </div>
      )}
      {capture.status === 'discarded' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-700">This capture was discarded.</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <DocumentViewer captureId={capture.id} mimeType={capture.mimeType} fileName={capture.fileName} />

        <form onSubmit={onSubmit}>
          {/* A posted bill is a record, not a draft: every control below is
              inert once entered. Edits go through the bill itself, where the
              paid/locked rules apply. */}
          <fieldset disabled={entered} className="space-y-4 min-w-0">
          {reading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
              <LoadingSpinner /> <span>Still reading this bill. The form fills in when it finishes; you can start keying it now if you prefer.</span>
            </div>
          )}
          {capture.extractionSkippedReason && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{SKIP_COPY[capture.extractionSkippedReason] ?? 'This bill was not read automatically.'} Key it from the image.</span>
            </div>
          )}
          {capture.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Reading failed{capture.extractionError ? `: ${capture.extractionError}` : ''}. Key it from the image, or try Re-read.</span>
            </div>
          )}
          {duplicate && capture.status !== 'entered' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <div className="flex items-start gap-2">
                <Copy className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Possible duplicate</p>
                  <p>A bill for this vendor with the same invoice number, or the same total and date, already exists{duplicate.txnNumber ? ` (${duplicate.txnNumber})` : ''}.
                    {duplicate.transactionId && <Link className="ml-1 underline" to={`/bills/${duplicate.transactionId}`} target="_blank" rel="noreferrer">Open it</Link>}
                  </p>
                  <label className="mt-2 inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={overrideDuplicate} onChange={(e) => setOverrideDuplicate(e.target.checked)} />
                    <span>Post anyway — this is a different bill</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Vendor */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            {unknownVendor && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p>Vendor <span className="font-medium">"{capture.extraction?.vendor}"</span> isn't in your contacts.</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {capture.vendorCandidates.map((v) => (
                    <Button key={v.id} type="button" size="sm" variant="secondary" onClick={() => setContactId(v.id)}>Use {v.displayName}</Button>
                  ))}
                  <Button type="button" size="sm" onClick={() => setNewVendorMode(true)}>Create "{capture.extraction?.vendor}" as a new vendor</Button>
                </div>
              </div>
            )}
            {!newVendorMode ? (
              <div>
                <ContactSelector
                  label="Vendor"
                  value={contactId}
                  onChange={(v) => { setContactId(v); }}
                  onSelect={(c) => applyVendorDefaults((c as { defaultExpenseAccountId?: string | null } | null)?.defaultExpenseAccountId ?? null)}
                  contactTypeFilter="vendor"
                  required
                />
                {!contactId && capture.suggestedContactName && (
                  <p className="text-xs text-gray-500 mt-1">Suggested: {capture.suggestedContactName}</p>
                )}
                {!entered && !unknownVendor && capture.extraction?.vendor && (
                  <button type="button" className="text-xs text-primary-600 hover:underline mt-1" onClick={() => setNewVendorMode(true)}>
                    Not the right vendor? Create "{capture.extraction.vendor}" instead
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">New vendor (created when you post)</p>
                  <button type="button" className="text-xs text-primary-600 hover:underline" onClick={() => setNewVendorMode(false)}>Pick an existing vendor instead</button>
                </div>
                <Input label="Vendor name" value={newVendor.displayName} onChange={(e) => setNewVendor({ ...newVendor, displayName: e.target.value })} required />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Address line 1" value={newVendor.billingLine1} onChange={(e) => setNewVendor({ ...newVendor, billingLine1: e.target.value })} />
                  <Input label="Address line 2" value={newVendor.billingLine2} onChange={(e) => setNewVendor({ ...newVendor, billingLine2: e.target.value })} />
                  <Input label="City" value={newVendor.billingCity} onChange={(e) => setNewVendor({ ...newVendor, billingCity: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="State" value={newVendor.billingState} onChange={(e) => setNewVendor({ ...newVendor, billingState: e.target.value })} />
                    <Input label="ZIP" value={newVendor.billingZip} onChange={(e) => setNewVendor({ ...newVendor, billingZip: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default expense account <span className="text-gray-400 font-normal">(optional; defaults to the first line's account)</span></label>
                  <AccountSelector value={newVendor.defaultExpenseAccountId} onChange={(v) => { setNewVendor({ ...newVendor, defaultExpenseAccountId: v }); applyVendorDefaults(v || null); }} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DatePicker label="Bill Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
              <DatePicker label="Due Date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueDateManual(true); }} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => { setPaymentTerms(e.target.value); setDueDateManual(false); }}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="due_on_receipt">Due On Receipt</option>
                  <option value="net_10">Net 10</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                  <option value="net_45">Net 45</option>
                  <option value="net_60">Net 60</option>
                  <option value="net_90">Net 90</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            {paymentTerms === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="Custom Days" type="number" min="0" value={customDays} onChange={(e) => { setCustomDays(e.target.value); setDueDateManual(false); }} />
              </div>
            )}
            <Input label="Vendor Invoice #" value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} placeholder="The vendor's reference number" />
          </div>

          {/* Lines mode */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-3 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Lines</span>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="lines-mode" checked={linesMode === 'detailed'} onChange={() => setLinesMode('detailed')} />
              Detailed <span className="text-gray-400">({detailedLines.length})</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="lines-mode" checked={linesMode === 'single'} onChange={() => setLinesMode('single')} />
              Single line at the total
            </label>
            <span className="text-xs text-gray-400">Your choice is remembered for this vendor.</span>
          </div>

          {linesMode === 'single'
            ? <BillLinesTable lines={[singleLine]} onChange={(ls) => setSingleLine(ls[0] ?? emptyLine())} fixedRowCount title="Categorization" />
            : <BillLinesTable lines={detailedLines} onChange={setDetailedLines} />}

          {linesMode === 'single' && capture.extraction?.total && Math.abs(total - Number(capture.extraction.total)) > 0.005 && (
            <p className="text-xs text-amber-700">The bill reads a total of ${Number(capture.extraction.total).toFixed(2)}; this line is ${total.toFixed(2)}.</p>
          )}

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
            <Input label="Internal Notes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {capture.status !== 'entered' && capture.status !== 'discarded' && (
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={enter.isPending && !enter.variables?.input} disabled={!vendorReady || enter.isPending}>Post bill</Button>
              <Button type="button" variant="secondary" onClick={() => post(true)} disabled={!vendorReady || enter.isPending} title={nextReadyId ? 'Post and open the next bill in the queue' : 'Post (no more bills waiting)'}>
                Post &amp; next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button type="button" variant="secondary" onClick={onDiscard} loading={discard.isPending}><Trash2 className="h-4 w-4 mr-1" /> Discard</Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/bills/capture')}>Back to queue</Button>
            </div>
          )}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
