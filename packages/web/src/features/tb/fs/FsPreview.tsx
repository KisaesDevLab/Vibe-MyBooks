// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Right-hand preview for the statement editor. "Live" renders the shared
// HTML renderer's paper sheets in a sandboxed, script-free iframe (fonts
// come from the public /fs-fonts route); "Exact PDF" asks the server for
// the real PDF of the unsaved draft and draws it with pdf.js, so page
// breaks, TOC page numbers and embedded fonts are exactly what prints.

import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function FsLivePreview({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  const [doc, setDoc] = useState(html);
  // Debounce re-renders while typing; keep the reader's scroll position.
  useEffect(() => {
    const t = setTimeout(() => {
      scroll.current = ref.current?.contentWindow?.scrollY ?? scroll.current;
      setDoc(html);
    }, 150);
    return () => clearTimeout(t);
  }, [html]);
  return (
    <iframe
      ref={ref}
      title="Financial statements preview"
      className="w-full h-full border-0 bg-gray-200"
      sandbox="allow-same-origin"
      srcDoc={doc}
      onLoad={() => ref.current?.contentWindow?.scrollTo(0, scroll.current)}
    />
  );
}

export function FsPdfProof({ blob, loading, error }: { blob: Blob | null; loading: boolean; error: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  useEffect(() => {
    if (!blob || !container.current) return;
    let cancelled = false;
    let loaded: pdfjs.PDFDocumentProxy | null = null;
    const host = container.current;
    host.innerHTML = '';
    (async () => {
      loaded = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
      if (cancelled) return;
      setPages(loaded.numPages);
      for (let i = 1; i <= loaded.numPages; i++) {
        const page = await loaded.getPage(i);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'mx-auto mb-6 shadow bg-white max-w-full';
        host.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      loaded?.destroy().catch(() => undefined);
    };
  }, [blob]);
  return (
    <div className="h-full overflow-y-auto bg-gray-200 p-6">
      {loading && <LoadingSpinner className="py-16" />}
      {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {!loading && !error && pages > 0 && <p className="text-center text-xs text-gray-600 mb-3">{pages} page{pages === 1 ? '' : 's'} — exactly as the PDF will print</p>}
      <div ref={container} />
    </div>
  );
}
