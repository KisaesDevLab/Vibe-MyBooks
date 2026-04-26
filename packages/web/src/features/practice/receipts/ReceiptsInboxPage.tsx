// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useRef, useState } from 'react';
import { Inbox, Upload, Trash2, Search, Banknote } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useCompanyContext } from '../../../providers/CompanyProvider';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 18.8 — bookkeeper Receipts Inbox.
// Replaces the prior placeholder. Talks to /api/v1/practice/receipts.

interface InboxRow {
  id: string;
  filename: string;
  status: string;
  capturedAt: string;
  uploadedBy: string;
  captureSource: string;
  extractedVendor: string | null;
  extractedTotal: string | null;
  extractedDate: string | null;
  matchedTransactionId: string | null;
  matchScore: string | null;
  companyId: string;
  companyName: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function ReceiptsInboxPage() {
  const { companies, activeCompanyId } = useCompanyContext();
  const [statusFilter, setStatusFilter] = useState<string>('unmatched');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [routeDialogFor, setRouteDialogFor] = useState<InboxRow | null>(null);

  const reload = async () => {
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      const data = await api<{ receipts: InboxRow[] }>(`/practice/receipts?${qs}`);
      setRows(data.receipts);
    } catch {
      setError('Failed to load receipts.');
    }
  };

  useEffect(() => {
    setRows(null);
    setError(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const onUpload = async (file: File) => {
    if (!activeCompanyId) {
      setError('Select an active company before uploading.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('companyId', activeCompanyId);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/practice/receipts/upload', {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      await reload();
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const dismiss = async (id: string) => {
    try {
      await api(`/practice/receipts/${id}/dismiss`, { method: 'POST' });
      await reload();
    } catch {
      setError('Could not dismiss.');
    }
  };

  const filtered = rows?.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.filename.toLowerCase().includes(q) ||
      (r.extractedVendor ?? '').toLowerCase().includes(q) ||
      (r.companyName ?? '').toLowerCase().includes(q)
    );
  }) ?? null;

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Receipts Inbox</h1>
          <p className="text-sm text-gray-600 mt-1">
            Review uploaded receipts, attach to transactions, or dismiss. Mobile capture from the
            client portal lands here too.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !activeCompanyId}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload receipt'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </div>
      </header>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file, vendor, or company"
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="unmatched">Unmatched</option>
          <option value="auto_matched">Auto-matched</option>
          <option value="manually_matched">Manual match</option>
          <option value="dismissed">Dismissed</option>
          <option value="pending_ocr">Pending OCR</option>
          <option value="awaits_routing">Awaiting routing</option>
          <option value="statement_imported">Statement imported</option>
          <option value="all">All</option>
        </select>
      </div>

      {error && (
        <div className="mb-3 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {!rows ? (
        <div className="py-12 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
          <Inbox className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">Nothing in the inbox</h3>
          <p className="text-sm text-gray-500">Upload a receipt or wait for clients to upload via the portal.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">File</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Company</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Vendor</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Source</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(filtered ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{r.filename}</td>
                  <td className="px-4 py-3 text-gray-700">{r.companyName}</td>
                  <td className="px-4 py-3 text-gray-700">{r.extractedVendor ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-900 text-right">
                    {r.extractedTotal ? `$${Number(r.extractedTotal).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ReceiptStatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.captureSource}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {r.status === 'awaits_routing' && (
                        <button
                          onClick={() => setRouteDialogFor(r)}
                          title="Pick bank connection to import this statement into"
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-700"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(r.id)}
                        title="Dismiss"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!activeCompanyId && (
        <p className="mt-3 text-xs text-amber-700">
          Pick an active company in the sidebar to enable uploads.
        </p>
      )}
      {companies.length === 0 && (
        <p className="mt-3 text-xs text-gray-500">No companies in this tenant yet.</p>
      )}
      {routeDialogFor && (
        <RouteStatementDialog
          receipt={routeDialogFor}
          onClose={() => setRouteDialogFor(null)}
          onRouted={() => {
            setRouteDialogFor(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

interface BankConnectionOption {
  id: string;
  institutionName: string | null;
  mask: string | null;
  companyId: string | null;
}

function RouteStatementDialog({
  receipt,
  onClose,
  onRouted,
}: {
  receipt: InboxRow;
  onClose: () => void;
  onRouted: () => void;
}) {
  const [conns, setConns] = useState<BankConnectionOption[] | null>(null);
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api<{ connections: BankConnectionOption[] }>('/practice/bank-connections')
      .then((r) => {
        const filtered = r.connections.filter((c) => !c.companyId || c.companyId === receipt.companyId);
        setConns(filtered);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load connections.'));
  }, [receipt.companyId]);

  const submit = async () => {
    if (!pick) {
      setError('Pick a bank connection.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api(`/practice/portal-receipts/${receipt.id}/route-statement`, {
        method: 'POST',
        body: JSON.stringify({ bankConnectionId: pick }),
      });
      onRouted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Routing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">Route statement</h2>
        <p className="text-sm text-gray-600">
          Pick the bank connection to import <span className="font-medium">{receipt.filename}</span> into.
        </p>
        {!conns ? (
          <div className="py-4 flex justify-center"><LoadingSpinner /></div>
        ) : conns.length === 0 ? (
          <p className="text-sm text-amber-700">
            No bank connections found for this company. Connect a bank account first under Banking → Connections.
          </p>
        ) : (
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select a connection…</option>
            {conns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.institutionName ?? 'Bank connection'}
                {c.mask ? ` ····${c.mask}` : ''}
              </option>
            ))}
          </select>
        )}
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !pick}
            onClick={() => void submit()}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            {submitting ? 'Routing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending_ocr: 'bg-gray-100 text-gray-700 ring-gray-400/20',
    ocr_failed: 'bg-red-50 text-red-700 ring-red-600/20',
    unmatched: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    auto_matched: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    manually_matched: 'bg-green-50 text-green-800 ring-green-600/20',
    dismissed: 'bg-gray-100 text-gray-500 ring-gray-400/20',
    awaits_routing: 'bg-orange-50 text-orange-800 ring-orange-600/20',
    statement_imported: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? styles['unmatched']
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default ReceiptsInboxPage;
