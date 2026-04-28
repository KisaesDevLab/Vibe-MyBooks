// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Inbox, Send, CheckSquare, XCircle, Eye } from 'lucide-react';
import type { DocRequestStatus, DocumentRequestSummary } from '@kis-books/shared';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { api } from './RemindersPage';

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

interface DocumentRequestsTabProps {
  onChange?: () => void;
}

export function DocumentRequestsTab({ onChange }: DocumentRequestsTabProps) {
  const [items, setItems] = useState<DocumentRequestSummary[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<DocRequestStatus | 'all'>('pending');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerFor, setDrawerFor] = useState<DocumentRequestSummary | null>(null);

  const reload = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (overdueOnly) params.set('overdue', 'true');
      const r = await api<{ items: DocumentRequestSummary[]; total: number }>(
        `/practice/document-requests?${params.toString()}`,
      );
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    }
  };

  useEffect(() => { void reload(); }, [statusFilter, overdueOnly]);

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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DocRequestStatus | 'all')}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
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
          <p className="text-sm text-gray-500">No requests match this filter.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                  <tr key={r.id} className="hover:bg-gray-50">
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
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <IconButton title="View thread" onClick={() => setDrawerFor(r)}>
                          <Eye className="h-4 w-4" />
                        </IconButton>
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

      {drawerFor && <ThreadDrawer request={drawerFor} onClose={() => setDrawerFor(null)} />}
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
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
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
