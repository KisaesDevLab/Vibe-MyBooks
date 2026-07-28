// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Viewer side of peer screen share (Phase 10 + the sending half of the
// Phase 11 pointer channel). Join code → waiting for approval → live replay
// in a sandboxed iframe with a pointer-events-none overlay (belt-and-braces
// read-only on top of the protocol-level enforcement).

import { useCallback, useEffect, useRef, useState } from 'react';
import { MonitorPlay, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useRequestJoin, fetchViewerTicket, type JoinRequestResponse } from './useShare';
import { connectShareSocket, type ShareSocket, type ShareEnvelope } from './shareSocket';

type ViewState =
  | { kind: 'enter-code' }
  | { kind: 'waiting'; request: JoinRequestResponse; secondsLeft: number }
  | { kind: 'connecting'; request: JoinRequestResponse }
  | { kind: 'live'; request: JoinRequestResponse; degraded: boolean }
  | { kind: 'ended'; reason: string; wasLive: boolean };

// rrweb Replayer instance type (loaded dynamically).
type ReplayerLike = {
  startLive: (baselineTime?: number) => void;
  addEvent: (ev: unknown) => void;
  destroy?: () => void;
};

const POINTER_MIN_INTERVAL_MS = 150; // stay safely under the 10/s server cap

export function ShareViewerPage() {
  const [state, setState] = useState<ViewState>({ kind: 'enter-code' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const request = useRequestJoin();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const socketRef = useRef<ShareSocket | null>(null);
  const startedLiveRef = useRef(false);
  const gotMetaRef = useRef(false);
  const gotSnapshotRef = useRef(false);
  const bufferRef = useRef<unknown[]>([]);
  const lastPointerAtRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardownReplay = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    try {
      replayerRef.current?.destroy?.();
    } catch {
      /* already gone */
    }
    replayerRef.current = null;
    startedLiveRef.current = false;
    gotMetaRef.current = false;
    gotSnapshotRef.current = false;
    bufferRef.current = [];
    // 10.10 — clear the replay surface immediately; nothing stays rendered.
    if (containerRef.current) containerRef.current.innerHTML = '';
  }, []);

  useEffect(() => () => {
    teardownReplay();
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, [teardownReplay]);

  // ── Waiting: poll the participant ticket endpoint until approved ─────────
  // A 409 means still `requested`; 200 yields the ticket and we connect.
  const beginWaiting = useCallback((req: JoinRequestResponse) => {
    setState({ kind: 'waiting', request: req, secondsLeft: req.approvalWindowSeconds });
    const deadline = Date.now() + req.approvalWindowSeconds * 1000;
    let connecting = false;
    pollTimerRef.current = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setState((s) => (s.kind === 'waiting' ? { ...s, secondsLeft } : s));
      if (connecting) return;
      void (async () => {
        try {
          connecting = true;
          const ticket = await fetchViewerTicket(req.participantId);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          connectAsViewer(req, ticket);
        } catch (err) {
          connecting = false;
          const status = (err as { status?: number }).status;
          if (status === 409) {
            // still waiting for approval
            if (Date.now() > deadline + 2000) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setState({ kind: 'ended', reason: 'The approval window ran out. You can enter the code again.', wasLive: false });
            }
            return;
          }
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setState({
            kind: 'ended',
            reason: status === 403 ? 'You cannot join this session.' : 'This session is no longer available.',
            wasLive: false,
          });
        }
      })();
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live replay ──────────────────────────────────────────────────────────
  const connectAsViewer = useCallback((req: JoinRequestResponse, firstTicket: string) => {
    setState({ kind: 'connecting', request: req });
    let usedFirstTicket = false;

    const feed = async (events: unknown[]) => {
      for (const ev of events) {
        const e = ev as { type?: number; timestamp?: number };
        if (e?.type === 4) gotMetaRef.current = true;
        if (e?.type === 2) gotSnapshotRef.current = true;
        bufferRef.current.push(ev);
      }
      // Mount the Replayer once Meta + FullSnapshot have both arrived (10.5).
      if (!startedLiveRef.current && gotMetaRef.current && gotSnapshotRef.current && containerRef.current) {
        startedLiveRef.current = true;
        const [rrweb] = await Promise.all([
          import('rrweb'),
          // Replayer chrome styles ride the same lazy chunk.
          import('rrweb/dist/rrweb.min.css'),
        ]);
        const replayer = new rrweb.Replayer([], {
          root: containerRef.current,
          liveMode: true,
          mouseTail: false,
          // Sandboxed iframe (10.6): rrweb builds its own iframe; we sandbox
          // it below after construction.
        }) as unknown as ReplayerLike;
        replayerRef.current = replayer;
        // Buffer ~300 ms to smooth jitter (10.9).
        replayer.startLive(Date.now() - 300);
        // Belt-and-braces read-only: sandbox the replay iframe and kill
        // pointer events inside the container (10.6).
        const iframe = containerRef.current.querySelector('iframe');
        iframe?.setAttribute('sandbox', 'allow-same-origin');
        const wrapper = containerRef.current.querySelector('.replayer-wrapper') as HTMLElement | null;
        if (wrapper) wrapper.style.pointerEvents = 'none';
        for (const ev of bufferRef.current) replayer.addEvent(ev);
        bufferRef.current = [];
        setState({ kind: 'live', request: req, degraded: false });
        fitReplay();
      } else if (startedLiveRef.current && replayerRef.current) {
        for (const ev of bufferRef.current) replayerRef.current.addEvent(ev);
        bufferRef.current = [];
      }
    };

    const sock = connectShareSocket({
      getTicket: async () => {
        // The first connect uses the ticket that just succeeded; reconnects
        // need a fresh single-use ticket.
        if (!usedFirstTicket) {
          usedFirstTicket = true;
          return firstTicket;
        }
        return fetchViewerTicket(req.participantId);
      },
      onMessage: (msg: ShareEnvelope) => {
        if (msg.type === 'events') {
          const payload = msg.payload as { events?: unknown[] };
          if (Array.isArray(payload?.events)) void feed(payload.events);
        }
      },
      onOpen: () => {
        setState((s) => (s.kind === 'live' ? { ...s, degraded: false } : s));
      },
      onClosed: ({ code: closeCode, final }) => {
        if (!final) {
          setState((s) => (s.kind === 'live' ? { ...s, degraded: true } : s));
          return;
        }
        const wasLive = startedLiveRef.current;
        teardownReplay();
        const reason =
          closeCode === 4011
            ? `You were removed by ${req.sharerName}.`
            : closeCode === 4010
              ? 'The sharer ended the session.'
              : 'The session ended.';
        setState({ kind: 'ended', reason, wasLive });
      },
    });
    socketRef.current = sock;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teardownReplay]);

  // Scale the replay to fit while preserving aspect (10.7).
  const fitReplay = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const wrapper = container.querySelector('.replayer-wrapper') as HTMLElement | null;
    const iframe = container.querySelector('iframe');
    if (!wrapper || !iframe) return;
    const w = Number(iframe.getAttribute('width')) || iframe.clientWidth || 1280;
    const h = Number(iframe.getAttribute('height')) || iframe.clientHeight || 800;
    const scale = Math.min(container.clientWidth / w, (window.innerHeight - 220) / h, 1);
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'top left';
    container.style.height = `${h * scale}px`;
  }, []);

  useEffect(() => {
    window.addEventListener('resize', fitReplay);
    const t = setInterval(fitReplay, 2000); // dimensions change on sharer resize
    return () => {
      window.removeEventListener('resize', fitReplay);
      clearInterval(t);
    };
  }, [fitReplay]);

  // Pointer channel — send normalized coordinates on click (11.1).
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (state.kind !== 'live' || !socketRef.current) return;
    const now = Date.now();
    if (now - lastPointerAtRef.current < POINTER_MIN_INTERVAL_MS) return;
    lastPointerAtRef.current = now;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    socketRef.current.send({ v: 1, type: 'pointer', payload: { x, y } });
  };

  const submitCode = () => {
    setError(null);
    request.mutate(code, {
      onSuccess: (r) => beginWaiting(r),
      onError: (err) => {
        const status = (err as { status?: number }).status;
        const msg = err instanceof Error ? err.message : 'That code is not valid.';
        // Distinct messages for full/denied/ejected come from the server
        // (10.3); invalid and non-existent are identical by design (10.2).
        setError(status === 429 ? 'Too many attempts. Wait a while and try again.' : msg);
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <MonitorPlay className="h-6 w-6 text-gray-500" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Join a screen share</h1>
      </div>

      {state.kind === 'enter-code' && (
        <div className="bg-white rounded-lg border p-6 max-w-md">
          <p className="text-sm text-gray-600 mb-4">
            Enter the code the sharer read to you. They must approve you before you see anything, and everything you view is logged.
          </p>
          <label htmlFor="share-code" className="block text-sm font-medium text-gray-700 mb-1">Join code</label>
          <input
            id="share-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.trim().length >= 4) submitCode();
            }}
            placeholder="4F7K-9RB2"
            maxLength={12}
            className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            autoComplete="off"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-2 mb-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
          <Button onClick={submitCode} disabled={code.trim().length < 4} loading={request.isPending}>
            Request to view
          </Button>
        </div>
      )}

      {state.kind === 'waiting' && (
        <div className="bg-white rounded-lg border p-8 max-w-md text-center">
          <div className="animate-pulse text-4xl mb-3" aria-hidden="true">⏳</div>
          <p className="text-sm text-gray-700 mb-1">
            Waiting for <b>{state.request.sharerName}</b> to approve…
          </p>
          <p className="text-xs text-gray-400">Request expires in {state.secondsLeft}s</p>
        </div>
      )}

      {(state.kind === 'connecting' || state.kind === 'live') && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                state.kind === 'live' && !state.degraded
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {state.kind === 'live' ? (state.degraded ? 'Reconnecting…' : 'Live') : 'Connecting…'}
            </span>
            <span className="text-gray-500">Viewing {state.request.sharerName}'s MyBooks screen (read-only)</span>
            <span className="flex-1" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                teardownReplay();
                setState({ kind: 'ended', reason: 'You left the session.', wasLive: true });
              }}
            >
              Leave
            </Button>
          </div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-300">
            {/* Replay mounts inside; the transparent overlay both blocks all
                interaction and captures pointer clicks (10.6 + 11.1). */}
            <div ref={containerRef} className="min-h-[300px] overflow-hidden" />
            <div
              className="absolute inset-0 cursor-crosshair"
              onClick={onOverlayClick}
              title="Click to point — the sharer sees a highlight where you click"
            />
            {state.kind === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
                Waiting for the first frame…
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Click anywhere on the screen to point at it for the sharer. You cannot interact with their MyBooks.
          </p>
        </div>
      )}

      {state.kind === 'ended' && (
        <div className="bg-white rounded-lg border p-8 max-w-md text-center">
          <p className="text-sm text-gray-800 mb-2">{state.reason}</p>
          <p className="text-xs text-gray-400 mb-4">This session was logged for your firm's records.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setCode('');
              setError(null);
              setState({ kind: 'enter-code' });
            }}
          >
            Enter another code
          </Button>
        </div>
      )}
    </div>
  );
}
