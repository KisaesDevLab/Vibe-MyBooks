// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Check, Image as ImageIcon, Upload as UploadIcon, CloudOff } from 'lucide-react';
import { usePortal } from './PortalLayout';
import { drainQueue, enqueueReceipt, listQueue } from './receiptQueue';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 18.2/18.6 — contact-mode
// receipt capture. Single-tap capture, retake, and upload via
// /api/portal/receipts/upload. Falls back to file-picker on
// browsers that don't expose getUserMedia (rare, but desktop
// Chrome on insecure HTTP origins blocks the camera).

export function PortalCapturePage() {
  const { activeCompanyId, me } = usePortal();
  const isPreview = !!me.preview;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [streamErr, setStreamErr] = useState<string | null>(null);
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [drainStatus, setDrainStatus] = useState<string | null>(null);

  // 18.3 — drain pending offline uploads when the capture page mounts
  // and on every reconnect. Runs in the background so the camera UI
  // is interactive immediately.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const before = (await listQueue()).length;
        if (before === 0) {
          if (!cancelled) setQueueCount(0);
          return;
        }
        const result = await drainQueue();
        if (cancelled) return;
        setQueueCount(result.remaining);
        if (result.uploaded > 0) {
          setDrainStatus(`Synced ${result.uploaded} queued receipt${result.uploaded === 1 ? '' : 's'}.`);
        }
      } catch {
        // best-effort — queue stays
      }
    };
    run();
    const onOnline = () => run();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (shot) return; // already captured
    let cancelled = false;
    let mediaStream: MediaStream | null = null;

    const start = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStreamErr('Camera not available on this browser. Use the file picker.');
          return;
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch (e) {
        setStreamErr(
          e instanceof Error
            ? `Camera unavailable: ${e.message}`
            : 'Camera unavailable. Use the file picker.',
        );
      }
    };
    start();

    return () => {
      cancelled = true;
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    };
  }, [shot]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShot(blob);
        setShotUrl(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.85,
    );
  };

  const retake = () => {
    if (shotUrl) URL.revokeObjectURL(shotUrl);
    setShot(null);
    setShotUrl(null);
    setUploaded(null);
    setErr(null);
  };

  const onFile = (file: File) => {
    if (shotUrl) URL.revokeObjectURL(shotUrl);
    setShot(file);
    setShotUrl(URL.createObjectURL(file));
  };

  const send = async () => {
    if (!shot || !activeCompanyId) return;
    if (isPreview) {
      setErr('Action disabled in preview mode.');
      return;
    }
    setUploading(true);
    setErr(null);
    const filename = (shot instanceof File && shot.name) ? shot.name : 'capture.jpg';
    const mime = shot.type || 'image/jpeg';

    // If the browser already says it's offline, enqueue first to avoid
    // a guaranteed-fail fetch. We still try when navigator.onLine is
    // true, falling through to the enqueue path on network error.
    const tryEnqueue = async (reason: 'offline' | 'failed') => {
      try {
        const r = await enqueueReceipt({
          blob: shot,
          filename,
          mimeType: mime,
          companyId: activeCompanyId,
          queuedAt: Date.now(),
        });
        setQueueCount(r.total);
        setUploaded(
          reason === 'offline'
            ? "You're offline — saved to queue. We'll send it when you reconnect."
            : `Saved offline (queue: ${r.total}). Will retry when online.`,
        );
      } catch (qe) {
        setErr(qe instanceof Error ? qe.message : 'Could not queue offline.');
      }
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await tryEnqueue('offline');
      setUploading(false);
      return;
    }

    try {
      const form = new FormData();
      form.append('file', shot, filename);
      form.append('companyId', activeCompanyId);
      const res = await fetch('/api/portal/receipts/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = (await res.json()) as { id: string; duplicate: boolean };
      setUploaded(data.duplicate ? 'Already on file — duplicate detected.' : 'Uploaded.');
    } catch (e) {
      // Network error → enqueue. Server-side 4xx/5xx → surface error
      // (don't queue garbage that will keep failing).
      if (e instanceof TypeError) {
        await tryEnqueue('failed');
      } else {
        setErr(e instanceof Error ? e.message : 'Upload failed.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-3">Capture receipt</h1>

      {(queueCount > 0 || drainStatus) && (
        <div className="mb-3 flex items-center justify-between gap-2 text-sm bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-blue-900">
          <span className="flex items-center gap-2">
            <CloudOff className="h-4 w-4" />
            {drainStatus ?? `${queueCount} receipt${queueCount === 1 ? '' : 's'} queued offline`}
          </span>
          {queueCount > 0 && (
            <button
              onClick={async () => {
                const r = await drainQueue();
                setQueueCount(r.remaining);
                if (r.uploaded > 0) setDrainStatus(`Synced ${r.uploaded}.`);
              }}
              className="text-xs font-medium text-blue-800 hover:underline"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {!shot ? (
        <>
          <div className="rounded-lg overflow-hidden bg-black aspect-[3/4] flex items-center justify-center">
            {streamErr ? (
              <p className="text-white text-sm p-4 text-center">{streamErr}</p>
            ) : (
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex items-center justify-between gap-2 mt-4">
            <button
              onClick={() => fallbackInputRef.current?.click()}
              className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-md"
            >
              <ImageIcon className="h-4 w-4" /> Pick file
            </button>
            <button
              onClick={capture}
              disabled={!!streamErr}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-3 rounded-full"
            >
              <Camera className="h-5 w-5" /> Capture
            </button>
            <input
              ref={fallbackInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg overflow-hidden bg-gray-100">
            <img src={shotUrl ?? ''} alt="Captured receipt" className="w-full" />
          </div>
          <div className="flex items-center justify-between gap-2 mt-4">
            <button
              onClick={retake}
              className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-md"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button
              onClick={send}
              disabled={uploading || !activeCompanyId || isPreview}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-3 rounded-full"
            >
              {uploaded ? <Check className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
              {uploaded ? 'Uploaded' : uploading ? 'Sending…' : 'Send'}
            </button>
          </div>
          {uploaded && (
            <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {uploaded}
            </p>
          )}
          {err && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default PortalCapturePage;
