// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Payables > Bill Capture: drop many vendor bills, watch them get read in
// the background, click a row to review and post. Modelled on
// banking/StatementImportsPage; polling lives in useBillCaptures.

import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BillCaptureStatus, BillCaptureSummary } from '@kis-books/shared';
import {
  useBillCaptures,
  useDiscardBillCapture,
  useReprocessBillCapture,
  useUploadBillCaptures,
} from '../../../api/hooks/useBillCaptures';
import { useAiStatus } from '../../../api/hooks/useAi';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { Pagination } from '../../../components/ui/Pagination';
import { useToast } from '../../../components/ui/Toaster';
import { AlertTriangle, FileText, RefreshCw, ScanLine, Trash2, Upload, UserRound, Globe, Copy } from 'lucide-react';

type Disposition = { label: string; cls: string; canReview: boolean; canReprocess: boolean; canDiscard: boolean };

export function disposition(c: BillCaptureSummary): Disposition {
  switch (c.status) {
    case 'entered':
      return { label: c.billVoided ? 'Entered (voided)' : 'Entered', cls: 'bg-green-100 text-green-700', canReview: true, canReprocess: false, canDiscard: false };
    case 'discarded':
      return { label: 'Discarded', cls: 'bg-gray-100 text-gray-500', canReview: true, canReprocess: false, canDiscard: false };
    case 'failed':
      return { label: 'Read failed', cls: 'bg-red-100 text-red-700', canReview: true, canReprocess: true, canDiscard: true };
    case 'ready':
      return c.extractionSkippedReason
        ? { label: 'Ready — not scanned', cls: 'bg-amber-100 text-amber-700', canReview: true, canReprocess: c.extractionSkippedReason !== 'unsupported_type', canDiscard: true }
        : { label: 'Ready to review', cls: 'bg-amber-100 text-amber-700', canReview: true, canReprocess: true, canDiscard: true };
    case 'processing':
      return { label: 'Reading…', cls: 'bg-blue-100 text-blue-700', canReview: true, canReprocess: false, canDiscard: true };
    default:
      return { label: 'Queued', cls: 'bg-gray-100 text-gray-600', canReview: true, canReprocess: false, canDiscard: true };
  }
}

const STATUS_FILTERS: { value: '' | BillCaptureStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'received', label: 'Queued' },
  { value: 'processing', label: 'Reading' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'entered', label: 'Entered' },
  { value: 'discarded', label: 'Discarded' },
];

const PAGE_SIZE_OPTIONS = ['25', '50', '100', '200'];
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/tiff,.pdf,.jpg,.jpeg,.png,.webp,.heic,.tif,.tiff';
const MAX_BATCH = 20;

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(v: string | null): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
}

export function BillCapturePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'' | BillCaptureStatus>('');
  const [pageSize, setPageSize] = useState('50');
  const [offset, setOffset] = useState(0);
  const limit = parseInt(pageSize, 10);
  const { data, isLoading, isError, refetch } = useBillCaptures({ status: statusFilter, limit, offset });
  const { data: aiStatus } = useAiStatus();
  const upload = useUploadBillCaptures();
  const discard = useDiscardBillCapture();
  const reprocess = useReprocessBillCapture();
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const captures = data?.captures ?? [];
  const counts = data?.counts;
  const inFlight = (counts?.received ?? 0) + (counts?.processing ?? 0);

  const startUpload = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    // Batches of MAX_BATCH so a 60-file drop still works within the
    // server's per-request cap; progress counts files, not requests.
    setUploadProgress({ done: 0, total: files.length });
    let created = 0;
    let dupes = 0;
    try {
      for (let i = 0; i < files.length; i += MAX_BATCH) {
        const chunk = files.slice(i, i + MAX_BATCH);
        const result = await upload.mutateAsync(chunk);
        created += result.filter((r) => !r.duplicate).length;
        dupes += result.filter((r) => r.duplicate).length;
        setUploadProgress({ done: Math.min(i + chunk.length, files.length), total: files.length });
      }
      const parts = [`${created} bill${created === 1 ? '' : 's'} uploaded`];
      if (dupes > 0) parts.push(`${dupes} already in the queue`);
      toast.success(parts.join(', '));
    } catch (err) {
      toast.error('Upload failed', { detail: err instanceof Error ? err.message : undefined });
    } finally {
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void startUpload(e.dataTransfer.files);
  };

  const onDiscard = (c: BillCaptureSummary) => {
    if (!window.confirm(`Discard "${c.fileName}"? The file is kept but it leaves the queue.`)) return;
    discard.mutate(c.id, {
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not discard'),
    });
  };
  const onReprocess = (c: BillCaptureSummary) => {
    reprocess.mutate(c.id, {
      onSuccess: () => toast.info(`Re-reading ${c.fileName} in the background.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not re-read'),
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill Capture</h1>
          <p className="text-sm text-gray-500 mt-1">
            Drop vendor bills here. Each is read in the background; open a row to review the details next to the image and post it as a bill.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/bills')}>Bills</Button>
      </div>

      {aiStatus && aiStatus.hasBillOcr === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Bill reading (AI OCR) is not available for this company, so uploads will not be pre-filled. You can still key each bill with the image beside the form.</span>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-6 mb-6 text-center transition-colors ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'}`}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          id="bill-capture-files"
          onChange={(e) => e.target.files && void startUpload(e.target.files)}
        />
        <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        {uploadProgress ? (
          <p className="text-sm text-gray-700">Uploading {uploadProgress.done} of {uploadProgress.total}…</p>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Drag and drop bills here, or{' '}
              <label htmlFor="bill-capture-files" className="text-primary-600 hover:underline cursor-pointer">choose files</label>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, WEBP, HEIC or TIFF, up to 10 MB each. One file per bill.</p>
          </>
        )}
      </div>

      {counts && (
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => {
            const n = f.value ? counts[f.value] : Object.values(counts).reduce((s, x) => s + x, 0);
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => { setStatusFilter(f.value); setOffset(0); }}
                className={`text-xs px-3 py-1 rounded-full border ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {f.label} <span className={active ? 'opacity-80' : 'text-gray-400'}>{n}</span>
              </button>
            );
          })}
          {inFlight > 0 && <span className="text-xs text-gray-400 self-center">{inFlight} still reading…</span>}
        </div>
      )}

      {isLoading && <div className="bg-white rounded-lg border p-12 flex justify-center"><LoadingSpinner /></div>}

      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">Couldn't load the capture queue.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
        </div>
      )}

      {!isLoading && !isError && captures.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ScanLine className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">{statusFilter ? 'No bills match this status.' : 'No bills captured yet.'}</p>
          {statusFilter
            ? <button className="text-xs text-primary-600 hover:underline mt-1" onClick={() => setStatusFilter('')}>Clear filter</button>
            : <p className="text-xs text-gray-400 mt-1">Drop a stack of bills above. Clients with portal access can also send them from their portal.</p>}
        </div>
      )}

      {!isLoading && !isError && captures.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Bill</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {captures.map((c) => {
                const d = disposition(c);
                const vendor = c.contactName ?? c.suggestedContactName ?? c.vendorName;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/bills/capture/${c.id}`)}
                  >
                    <td className="px-4 py-2 text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[16rem]" title={c.fileName}>{c.fileName}</span>
                        {c.source === 'portal'
                          ? <span title={`Uploaded via the client portal${c.uploadedByName ? ` by ${c.uploadedByName}` : ''}`}><Globe className="h-3.5 w-3.5 text-blue-400" /></span>
                          : <span title={c.uploadedByName ? `Uploaded by ${c.uploadedByName}` : 'Uploaded by staff'}><UserRound className="h-3.5 w-3.5 text-gray-300" /></span>}
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(c.createdAt).toLocaleString()}</div>
                      {c.extractionError && <div className="text-xs text-red-500 mt-0.5">{c.extractionError}</div>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {vendor ?? '—'}
                      {!c.contactId && c.suggestedContactName && <span className="ml-1 text-xs text-amber-600">(suggested)</span>}
                      {!c.contactId && !c.suggestedContactName && c.vendorName && <span className="ml-1 text-xs text-amber-600">(new)</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{c.vendorInvoiceNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-700">{fmtDate(c.billDate)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-900">{fmtMoney(c.total)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.cls}`}>{d.label}</span>
                      {c.isDuplicate && c.status !== 'entered' && (
                        <span className="ml-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700" title="A bill with this invoice number, or the same total and date, already exists for this vendor">
                          <Copy className="h-3 w-3" /> Duplicate?
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {d.canReview && (
                          <Button size="sm" variant="secondary" onClick={() => navigate(c.status === 'entered' && c.billId ? `/bills/${c.billId}` : `/bills/capture/${c.id}`)}>
                            {c.status === 'entered' ? 'View bill' : 'Review'}
                          </Button>
                        )}
                        {d.canReprocess && (
                          <Button size="sm" variant="secondary" title="Read this bill again from the file" onClick={() => onReprocess(c)} loading={reprocess.isPending && reprocess.variables === c.id}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {d.canDiscard && (
                          <Button size="sm" variant="secondary" title="Discard" onClick={() => onDiscard(c)} loading={discard.isPending && discard.variables === c.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && !isError && data && data.total > 0 && (
        <Pagination
          total={data.total}
          limit={limit}
          offset={offset}
          onChange={setOffset}
          unit="bills"
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setPageSize(size); setOffset(0); }}
        />
      )}
    </div>
  );
}
