// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Client portal: "Send us bills". Drop vendor bills for the firm to enter;
// see a coarse status per upload (Received / Processing / Entered). No
// amounts or accounting detail are shown — that is the staff queue's job.

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, Clock, FileText, Inbox, Upload } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

type PortalStatus = 'received' | 'processing' | 'entered' | 'closed';

interface PortalCapture {
  id: string;
  fileName: string;
  status: PortalStatus;
  createdAt: string;
  enteredAt: string | null;
}

interface ListResponse {
  featureEnabled: boolean;
  captures: PortalCapture[];
}

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic';
const MAX_FILES = 10;

const STATUS: Record<PortalStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  received: { label: 'Received', cls: 'bg-gray-100 text-gray-700', icon: Inbox },
  processing: { label: 'Being processed', cls: 'bg-blue-100 text-blue-700', icon: Clock },
  entered: { label: 'Entered', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  closed: { label: 'Reviewed', cls: 'bg-gray-100 text-gray-500', icon: CheckCircle2 },
};

export function PortalBillUploadPage() {
  const { me, activeCompanyId } = usePortal();
  const isPreview = !!me.preview;
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setRetryable(false);
    fetch(`${import.meta.env.BASE_URL}api/portal/bill-captures?companyId=${activeCompanyId}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 403) {
          if (!cancelled) setError("Bill uploads aren't enabled for your account.");
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ListResponse | null) => {
        if (!d || cancelled) return;
        if (d.featureEnabled === false) {
          setError("Bill uploads aren't enabled for your account.");
          return;
        }
        setData(d);
      })
      .catch(() => {
        if (!cancelled) { setError('Failed to load your uploads.'); setRetryable(true); }
      });
    return () => { cancelled = true; };
  }, [activeCompanyId, attempt]);

  // Poll while anything is still being processed.
  useEffect(() => {
    if (!data || !data.captures.some((c) => c.status === 'received' || c.status === 'processing')) return;
    const t = setTimeout(() => setAttempt((a) => a + 1), 5000);
    return () => clearTimeout(t);
  }, [data]);

  const startUpload = async (list: FileList | File[]) => {
    if (!activeCompanyId || isPreview) return;
    const files = Array.from(list);
    if (files.length === 0) return;
    setNotice(null);
    setUploading({ done: 0, total: files.length });
    let sent = 0;
    let dupes = 0;
    try {
      for (let i = 0; i < files.length; i += MAX_FILES) {
        const chunk = files.slice(i, i + MAX_FILES);
        const fd = new FormData();
        fd.append('companyId', activeCompanyId);
        for (const f of chunk) fd.append('files', f);
        const res = await fetch(`${import.meta.env.BASE_URL}api/portal/bill-captures/upload`, {
          method: 'POST', credentials: 'include', body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message || 'Upload failed. Please try again.');
        }
        const result = await res.json() as { captures: Array<{ duplicate: boolean }> };
        sent += result.captures.filter((c) => !c.duplicate).length;
        dupes += result.captures.filter((c) => c.duplicate).length;
        setUploading({ done: Math.min(i + chunk.length, files.length), total: files.length });
      }
      setNotice(
        sent > 0
          ? `Thanks — ${sent} bill${sent === 1 ? '' : 's'} sent to your accountant.${dupes ? ` ${dupes} had already been sent.` : ''}`
          : 'Those bills had already been sent.',
      );
      setAttempt((a) => a + 1);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void startUpload(e.dataTransfer.files);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Send us bills</h1>
      <p className="text-sm text-gray-500 mb-4">
        Upload vendor bills or invoices you've received. We'll enter them into your books and you can see the status here.
      </p>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          {error}
          {retryable && (
            <button className="ml-2 underline" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
          )}
        </div>
      )}

      {!error && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); if (!isPreview) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 mb-4 text-center ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'} ${isPreview ? 'opacity-60' : ''}`}
          >
            <input
              ref={fileInput}
              id="portal-bill-files"
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              disabled={isPreview}
              onChange={(e) => e.target.files && void startUpload(e.target.files)}
            />
            <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            {uploading ? (
              <p className="text-sm text-gray-700">Uploading {uploading.done} of {uploading.total}…</p>
            ) : isPreview ? (
              <p className="text-sm text-gray-500">Uploads are disabled while previewing as this client.</p>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  Drag and drop bills here, or{' '}
                  <label htmlFor="portal-bill-files" className="text-primary-600 hover:underline cursor-pointer">choose files</label>
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, WEBP or HEIC, up to 10 MB each. One bill per file works best.</p>
              </>
            )}
          </div>

          {notice && <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">{notice}</div>}

          {!data && <div className="p-8 flex justify-center"><LoadingSpinner /></div>}

          {data && data.captures.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600">You haven't sent any bills yet.</p>
            </div>
          )}

          {data && data.captures.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {data.captures.map((c) => {
                const s = STATUS[c.status];
                const Icon = s.icon;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{c.fileName}</p>
                      <p className="text-xs text-gray-400">Sent {new Date(c.createdAt).toLocaleDateString()}{c.enteredAt ? ` · entered ${new Date(c.enteredAt).toLocaleDateString()}` : ''}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
