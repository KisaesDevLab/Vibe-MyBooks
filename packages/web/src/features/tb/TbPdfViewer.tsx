// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Leadsheet attachment viewer: renders the ORIGINAL PDF page-by-page
// with pdfjs so clicks map to page coordinates, overlays the stored
// tickmark annotations as removable chips, and supports click-to-place
// stamping from the firm's tickmark library. Stamps are data — the
// server burns them into the PDF only when the file is downloaded, so
// placing/removing marks never mutates the stored original.

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { apiClient, isApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Download, Stamp, X } from 'lucide-react';
import { MARK_TONES } from './workpaperShared';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Annotation {
  id: string; page: number; xPct: number; yPct: number;
  symbol: string; color: string | null; note: string | null;
}

interface Tickmark { id: string; symbol: string; description: string; color: string | null }

export function TbPdfViewer({ attachmentId, refCode, sourceFileName, annotations, onClose }: {
  attachmentId: string;
  refCode: string;
  sourceFileName: string;
  annotations: Annotation[];
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<Tickmark | null>(null);
  const [stampNote, setStampNote] = useState('');

  const { data: marksData } = useQuery({
    queryKey: ['tb', 'tickmarks'],
    queryFn: () => apiClient<{ tickmarks: Tickmark[] }>('/tb/tickmarks'),
  });

  // Load the ORIGINAL bytes (annotations overlay client-side).
  useEffect(() => {
    let cancelled = false;
    let loaded: pdfjs.PDFDocumentProxy | null = null;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/v1/tb/row-attachments/${attachmentId}/file?stamped=0`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'X-Company-Id': localStorage.getItem('activeCompanyId') ?? '',
          },
        });
        if (!res.ok) throw new Error(`Could not load the PDF (${res.status})`);
        const bytes = await res.arrayBuffer();
        loaded = await pdfjs.getDocument({ data: bytes }).promise;
        if (!cancelled) setDoc(loaded);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load the PDF');
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy().catch(() => undefined);
    };
  }, [attachmentId]);

  // Render the current page.
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale: 1.4 });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [doc, page]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tb', 'row-attachments'] });

  const addStamp = useMutation({
    mutationFn: (input: { page: number; xPct: number; yPct: number; tickmarkId: string; note: string | null }) =>
      apiClient<{ annotation: Annotation }>(`/tb/row-attachments/${attachmentId}/annotations`, {
        method: 'POST', body: JSON.stringify(input),
      }),
    onSuccess: () => { invalidate(); toast.success('Tickmark placed'); },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Stamp failed'),
  });
  const removeStamp = useMutation({
    mutationFn: (annotationId: string) =>
      apiClient(`/tb/row-attachments/${attachmentId}/annotations/${annotationId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Remove failed'),
  });

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!stampMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    addStamp.mutate({
      page,
      xPct: Math.min(Math.max(xPct, 0), 1),
      yPct: Math.min(Math.max(yPct, 0), 1),
      tickmarkId: stampMode.id,
      note: stampNote.trim() || null,
    });
    setStampMode(null);
    setStampNote('');
  };

  const downloadStamped = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/v1/tb/row-attachments/${attachmentId}/file`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        'X-Company-Id': localStorage.getItem('activeCompanyId') ?? '',
      },
    });
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `${refCode}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageAnnotations = annotations.filter((a) => a.page === page);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-medium text-gray-900">
              <span className="font-mono text-blue-700 mr-2">{refCode}</span>
              {sourceFileName}
            </h2>
            {doc && (
              <p className="text-xs text-gray-500">
                Page {page} of {doc.numPages}
                {stampMode && <span className="ml-2 text-blue-700 font-medium">Click the page to place “{stampMode.symbol}”</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {doc && doc.numPages > 1 && (
              <>
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</Button>
                <Button size="sm" variant="secondary" disabled={page >= doc.numPages} onClick={() => setPage((p) => p + 1)}>Next ›</Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={downloadStamped} title="Download with stamps burned in">
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1" aria-label="Close">✕</button>
          </div>
        </div>

        <div className="flex grow min-h-0">
          {/* ── Page canvas + overlays ─────────────────────── */}
          <div className="grow overflow-auto bg-gray-100 p-4">
            {loadError && <p className="text-sm text-red-700 p-4">{loadError}</p>}
            {!doc && !loadError && <LoadingSpinner className="py-16" />}
            <div className="relative inline-block">
              <canvas ref={canvasRef} onClick={onCanvasClick}
                className={stampMode ? 'cursor-crosshair shadow' : 'shadow'} />
              {pageAnnotations.map((a) => (
                <button key={a.id}
                  style={{ left: `${a.xPct * 100}%`, top: `${a.yPct * 100}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full text-xs font-bold shadow ring-1 ring-black/10 ${MARK_TONES[a.color ?? 'red'] ?? MARK_TONES['red']}`}
                  title={`${a.symbol}${a.note ? ` — ${a.note}` : ''} (click to remove)`}
                  onClick={() => {
                    if (window.confirm(`Remove tickmark “${a.symbol}”${a.note ? ` (${a.note})` : ''}?`)) {
                      removeStamp.mutate(a.id);
                    }
                  }}>
                  {a.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* ── Stamp palette ──────────────────────────────── */}
          <div className="w-64 shrink-0 border-l border-gray-200 p-3 overflow-y-auto">
            <h3 className="text-xs uppercase text-gray-500 font-medium mb-2 flex items-center gap-1">
              <Stamp className="h-3.5 w-3.5" /> Tickmarks
            </h3>
            <input value={stampNote} onChange={(e) => setStampNote(e.target.value)}
              placeholder="Optional note for next stamp…" maxLength={200}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs mb-2" />
            <ul className="space-y-1">
              {(marksData?.tickmarks ?? []).map((m) => (
                <li key={m.id}>
                  <button
                    className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm border ${stampMode?.id === m.id ? 'border-blue-400 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                    onClick={() => setStampMode(stampMode?.id === m.id ? null : m)}>
                    <span className={`inline-flex items-center justify-center h-6 min-w-6 px-1 rounded text-xs font-semibold ${MARK_TONES[m.color ?? 'gray'] ?? MARK_TONES['gray']}`}>
                      {m.symbol}
                    </span>
                    <span className="grow text-gray-800 text-xs">{m.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            {(marksData?.tickmarks ?? []).length === 0 && (
              <p className="text-xs text-gray-500">No tickmark library — load defaults on the Leadsheets page.</p>
            )}
            {stampMode && (
              <button onClick={() => setStampMode(null)}
                className="mt-2 w-full text-xs text-gray-500 hover:text-gray-800 inline-flex items-center justify-center gap-1">
                <X className="h-3 w-3" /> Cancel stamp mode
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
