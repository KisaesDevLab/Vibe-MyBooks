// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useCallback, useEffect, useState } from 'react';
import { Eye, Download, FileText, Image as ImageIcon, X } from 'lucide-react';

// The contact's own uploads on the capture page: receipts sent with the
// receipt button, and (second tab) files sent against a document request.
// Preview opens the stored file inline; the portal session cookie
// authenticates /api/portal/receipts/:id/file.

interface UploadRow {
  id: string;
  filename: string | null;
  mimeType: string | null;
  status: string;
  capturedAt: string;
  documentRequestId: string | null;
  requestDescription: string | null;
  requestPeriodLabel: string | null;
}

type Kind = 'receipt' | 'request';

const fileUrl = (id: string, inline: boolean) =>
  `${import.meta.env.BASE_URL}api/portal/receipts/${id}/file${inline ? '?inline=1' : ''}`;

// Browsers can't render HEIC inline; offer the download instead.
const previewable = (mime: string | null) =>
  !!mime && (mime === 'application/pdf' || (mime.startsWith('image/') && mime !== 'image/heic'));

export function PortalUploadsList({ companyId, refreshKey }: { companyId: string; refreshKey?: number }) {
  const [kind, setKind] = useState<Kind>('receipt');
  const [rows, setRows] = useState<UploadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/portal/receipts?companyId=${companyId}&kind=${kind}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { receipts: UploadRow[] };
      setRows(body.receipts);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Could not load your uploads.');
    }
  }, [companyId, kind]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-base font-semibold text-gray-900">Your uploads</h2>
        <div role="tablist" aria-label="Upload type" className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
          {([['receipt', 'Receipts'], ['request', 'Requested documents']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-md px-2.5 py-1 font-medium ${kind === k ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          {kind === 'receipt' ? 'No receipts uploaded yet.' : 'No documents sent for requests yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {rows.map((r) => {
            const Icon = r.mimeType?.startsWith('image/') ? ImageIcon : FileText;
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{r.filename || 'Upload'}</p>
                  <p className="truncate text-xs text-gray-500">
                    {new Date(r.capturedAt).toLocaleDateString()}
                    {r.requestDescription && ` · ${r.requestDescription}${r.requestPeriodLabel ? ` (${r.requestPeriodLabel})` : ''}`}
                  </p>
                </div>
                {previewable(r.mimeType) ? (
                  <button
                    type="button"
                    onClick={() => setPreview(r)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    aria-label={`Preview ${r.filename ?? 'upload'}`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                ) : (
                  <a
                    href={fileUrl(r.id, false)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${preview.filename ?? 'upload'}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
              <p className="truncate text-sm font-medium text-gray-900">{preview.filename}</p>
              <div className="flex items-center gap-2">
                <a href={fileUrl(preview.id, false)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded p-1 text-gray-500 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
              {preview.mimeType === 'application/pdf' ? (
                <iframe title={preview.filename ?? 'Preview'} src={fileUrl(preview.id, true)} className="h-full w-full" />
              ) : (
                <img src={fileUrl(preview.id, true)} alt={preview.filename ?? 'Upload'} className="mx-auto max-h-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
