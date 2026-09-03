// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useCallback, useEffect, useState } from 'react';
import { Inbox, Send, CheckSquare, XCircle, Eye, MailOpen, Paperclip, Download, X } from 'lucide-react';
import type { DocRequestStatus, DocumentRequestSummary } from '@kis-books/shared';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { Pagination } from '../../../components/ui/Pagination';
import { api } from './RemindersPage';

const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', '500'];

interface ReminderSendRow {
  id: string;
  scheduleId: string | null;
  channel: string;
  sentAt: string;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  error: string | null;
}

// 'unread' = submitted by the client and not yet acknowledged by staff.
type GridFilter = DocRequestStatus | 'all' | 'unread';

interface DocumentRequestsTabProps {
  onChange?: () => void;
  // Deep-link entry (dashboard banner / staff-notification email).
  initialFilter?: GridFilter;
}

export function DocumentRequestsTab({ onChange, initialFilter }: DocumentRequestsTabProps) {
  const [items, setItems] = useState<DocumentRequestSummary[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<GridFilter>(initialFilter ?? 'pending');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<string>('50');
  const [offset, setOffset] = useState<number>(0);
  const limit = Number(pageSize);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerFor, setDrawerFor] = useState<DocumentRequestSummary | null>(null);
  // Inline viewer for the file the client actually uploaded.
  const [viewerFor, setViewerFor] = useState<DocumentRequestSummary | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter === 'unread') params.set('unread', 'true');
      else if (statusFilter !== 'all') params.set('status', statusFilter);
      if (overdueOnly) params.set('overdue', 'true');
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const r = await api<{ items: DocumentRequestSummary[]; total: number }>(
        `/practice/document-requests?${params.toString()}`,
      );
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    }
  }, [statusFilter, overdueOnly, limit, offset]);

  useEffect(() => { void reload(); }, [reload]);

  const remind = async (row: DocumentRequestSummary) => {
    setBusyId(row.id);
    setInfo(null);
    try {
      const r = await api<{ result: string }>(`/practice/document-requests/${row.id}/remind`, { method: 'POST' });
      setInfo(`Reminder ${r.result}`);
      await reload();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remind failed.');
    } finally { setBusyId(null); }
  };

  const markReceived = async (row: DocumentRequestSummary) => {
    if (!confirm(`Mark ${row.description} (${row.periodLabel}) as received?`)) return;
    setBusyId(row.id);
    try {
      await api(`/practice/document-requests/${row.id}/mark-received`, { method: 'POST' });
      await reload();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark failed.');
    } finally { setBusyId(null); }
  };

  const markReviewed = async (row: DocumentRequestSummary) => {
    setBusyId(row.id);
    try {
      await api(`/practice/document-requests/${row.id}/mark-reviewed`, { method: 'POST' });
      await reload();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark reviewed failed.');
    } finally { setBusyId(null); }
  };

  const markAllReviewed = async () => {
    if (!confirm('Mark every unread client submission as reviewed?')) return;
    setBusyId('all');
    setInfo(null);
    try {
      const r = await api<{ ok: boolean; count: number }>('/practice/document-requests/mark-all-reviewed', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setInfo(`${r.count} ${r.count === 1 ? 'submission' : 'submissions'} marked reviewed`);
      await reload();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark all reviewed failed.');
    } finally { setBusyId(null); }
  };

  const cancel = async (row: DocumentRequestSummary) => {
    if (!confirm('Cancel this document request? The contact will not be reminded again.')) return;
    setBusyId(row.id);
    try {
      await api(`/practice/document-requests/${row.id}/cancel`, { method: 'POST' });
      await reload();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed.');
    } finally { setBusyId(null); }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Open document requests</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            One row per issued cycle. {total} match{total === 1 ? '' : 'es'} the current filter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusFilter === 'unread' && items && items.length > 0 && (
            <button
              type="button"
              onClick={() => void markAllReviewed()}
              disabled={busyId === 'all'}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
            >
              <MailOpen className="h-4 w-4" /> Mark all reviewed
            </button>
          )}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as GridFilter); setOffset(0); }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          >
            <option value="unread">Unread submissions</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => { setOverdueOnly(e.target.checked); setOffset(0); }}
            />
            Overdue only
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}
      {info && !error && (
        <div role="status" className="mb-3 p-3 border border-emerald-200 bg-emerald-50 rounded-md text-sm text-emerald-800">
          {info}
        </div>
      )}

      {!items ? (
        <div className="py-6 flex justify-center"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <Inbox className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">
            {statusFilter === 'unread' ? 'No unread client submissions — you are caught up.' : 'No requests match this filter.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Contact</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Document</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Period</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Requested</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Due</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Last reminded</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => {
                const overdue = r.status === 'pending' && r.dueDate && new Date(r.dueDate) < new Date();
                return (
                  <tr key={r.id} className={'hover:bg-gray-50 ' + (r.unread ? 'bg-indigo-50/40' : '')}>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">{r.contactName ?? r.contactEmail}</div>
                      {r.contactName && <div className="text-xs text-gray-500">{r.contactEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{r.documentType.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{r.description}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.periodLabel}</td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">{formatDate(r.requestedAt)}</td>
                    <td className={'px-4 py-3 tabular-nums ' + (overdue ? 'text-red-700 font-medium' : 'text-gray-700')}>
                      {r.dueDate ? formatDate(r.dueDate) : '—'}
                      {overdue && <span className="ml-1 text-xs">(overdue)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      {r.lastRemindedAt ? formatDate(r.lastRemindedAt) : '—'}
                      {r.reminderSendCount > 0 && (
                        <div className="text-xs text-gray-500">{r.reminderSendCount} send{r.reminderSendCount === 1 ? '' : 's'}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={r.status} />
                        {r.unread && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-600 text-white"
                            title="The client sent this and nobody has reviewed it yet"
                          >
                            New
                          </span>
                        )}
                      </div>
                      {r.status === 'submitted' && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 max-w-xs">
                          {r.submittedFilename ? (
                            <button
                              type="button"
                              onClick={() => setViewerFor(r)}
                              className="inline-flex items-center gap-1 min-w-0 text-indigo-700 hover:text-indigo-900 hover:underline"
                              title={`View ${r.submittedFilename}`}
                            >
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="truncate">{r.submittedFilename}</span>
                            </button>
                          ) : (
                            <span>Marked received by staff</span>
                          )}
                        </div>
                      )}
                      {r.status === 'submitted' && r.submittedAt && (
                        <div className="text-xs text-gray-500">
                          {formatDate(r.submittedAt)}
                          {r.reviewedAt ? ` · reviewed ${formatDate(r.reviewedAt)}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <IconButton title="View thread" onClick={() => setDrawerFor(r)}>
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        {r.unread && (
                          <IconButton
                            title="Mark reviewed"
                            disabled={busyId === r.id}
                            onClick={() => void markReviewed(r)}
                          >
                            <MailOpen className="h-4 w-4 text-indigo-700" />
                          </IconButton>
                        )}
                        {r.status === 'pending' && (
                          <>
                            <IconButton
                              title="Remind now"
                              disabled={busyId === r.id}
                              onClick={() => void remind(r)}
                            >
                              <Send className="h-4 w-4 text-indigo-700" />
                            </IconButton>
                            <IconButton
                              title="Mark received"
                              disabled={busyId === r.id}
                              onClick={() => void markReceived(r)}
                            >
                              <CheckSquare className="h-4 w-4 text-emerald-700" />
                            </IconButton>
                            <IconButton
                              title="Cancel"
                              disabled={busyId === r.id}
                              onClick={() => void cancel(r)}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </IconButton>
                          </>
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

      {items && (
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onChange={setOffset}
          unit="requests"
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setPageSize(size); setOffset(0); }}
        />
      )}

      {drawerFor && <ThreadDrawer request={drawerFor} onClose={() => setDrawerFor(null)} />}
      {viewerFor?.submittedReceiptId && (
        <AttachmentViewer
          receiptId={viewerFor.submittedReceiptId}
          filename={viewerFor.submittedFilename ?? 'attachment'}
          caption={`${viewerFor.contactName ?? viewerFor.contactEmail} · ${viewerFor.description} · ${viewerFor.periodLabel}`}
          onClose={() => setViewerFor(null)}
        />
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: DocRequestStatus }) {
  const map: Record<DocRequestStatus, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    submitted: { label: 'Submitted', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    superseded: { label: 'Superseded', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${m.cls}`}>
      {m.label}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function ThreadDrawer({ request, onClose }: { request: DocumentRequestSummary; onClose: () => void }) {
  const [sends, setSends] = useState<ReminderSendRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sends: ReminderSendRow[] }>(`/practice/document-requests/${request.id}/sends`)
      .then((r) => setSends(r.sends))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load thread.'));
  }, [request.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div
        className="bg-white shadow-xl w-full max-w-lg p-5 space-y-3 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{request.description}</h2>
            <p className="text-sm text-gray-500">{request.contactEmail} · {request.periodLabel}</p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">Close</button>
        </div>
        <hr />
        {error && <div className="text-sm text-red-700">{error}</div>}
        {!sends ? (
          <div className="py-6 flex justify-center"><LoadingSpinner /></div>
        ) : sends.length === 0 ? (
          <p className="text-sm text-gray-500">No reminders sent yet.</p>
        ) : (
          <ol className="space-y-3">
            {sends.map((s) => (
              <li key={s.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-sm text-gray-900">
                  {s.scheduleId ? 'Cadence reminder' : 'Issuance email'}
                  <span className="ml-2 text-xs text-gray-500">{new Date(s.sentAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-600 space-x-3">
                  {s.openedAt && <span>Opened {new Date(s.openedAt).toLocaleString()}</span>}
                  {s.clickedAt && <span>Clicked {new Date(s.clickedAt).toLocaleString()}</span>}
                  {s.bouncedAt && <span className="text-red-700">Bounced</span>}
                  {s.error && <span className="text-red-700">{s.error}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// Authorized fetch of a submitted receipt's bytes as an object URL. The
// file route takes a Bearer header (or a single-use ?_dl= token), so a
// bare <iframe src> would 401 — same blob-backed approach the attachment
// library uses. The URL is revoked on close so the blob isn't retained.
function useReceiptObjectUrl(receiptId: string | null): {
  url: string | null;
  mimeType: string | null;
  error: string | null;
} {
  const [state, setState] = useState<{ url: string | null; mimeType: string | null; error: string | null }>({
    url: null, mimeType: null, error: null,
  });

  useEffect(() => {
    if (!receiptId) {
      setState({ url: null, mimeType: null, error: null });
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/v1/practice/receipts/${receiptId}/file?inline=1`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' },
        );
        if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : `HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, mimeType: blob.type || null, error: null });
      } catch (e) {
        if (!cancelled) {
          setState({ url: null, mimeType: null, error: e instanceof Error ? e.message : 'Could not load file' });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [receiptId]);

  return state;
}

function AttachmentViewer({
  receiptId,
  filename,
  caption,
  onClose,
}: {
  receiptId: string;
  filename: string;
  caption: string;
  onClose: () => void;
}) {
  const { url, mimeType, error } = useReceiptObjectUrl(receiptId);
  const isImage = (mimeType ?? '').startsWith('image/');

  // Escape closes, matching the other overlays on this page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Attachment: ${filename}`}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{filename}</h2>
            <p className="text-xs text-gray-500 truncate">{caption}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <a
                href={url}
                download={filename}
                className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:text-indigo-900"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-gray-50 flex items-center justify-center">
          {error ? (
            <p className="text-sm text-red-700 px-4 text-center">{error}</p>
          ) : !url ? (
            <LoadingSpinner />
          ) : isImage ? (
            <img src={url} alt={filename} className="max-h-full max-w-full object-contain" />
          ) : (
            // PDFs and anything else the browser can render inline.
            <iframe src={url} title={filename} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}
