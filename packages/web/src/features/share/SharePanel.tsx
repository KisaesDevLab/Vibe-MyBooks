// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Sharer-side UI for peer screen share (Phase 9 + 11 sharer half):
// header entry point, pre-share consent modal, join-code display, per-viewer
// approval prompts (queued, Deny-on-dismiss), the persistent live banner with
// per-viewer eject, viewer pointers, countdown/idle warnings, and the
// post-session summary.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorUp, MonitorPlay, Copy, X, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import {
  useShareCapabilities,
  useCreateShareSession,
  useShareSession,
  useApprovalContext,
  useApproveParticipant,
  useDenyParticipant,
  useEjectParticipant,
  useEndShareSession,
  useExtendShareSession,
  fetchSharerTicket,
  type ShareParticipantView,
} from './useShare';
import { connectShareSocket, type ShareSocket, type ShareEnvelope } from './shareSocket';
import { startRecorder, type RecorderHandle } from './recorder';
import { SHARE_MASKING_SUMMARY } from './masking';

const IDLE_TIMEOUT_MS = 90_000; // mirrors SHARE_IDLE_TIMEOUT_SECONDS default
const IDLE_WARNING_MS = IDLE_TIMEOUT_MS - 30_000; // 9.12 warning lead
const TTL_WARNING_MS = 5 * 60_000; // countdown warning at 5 minutes left

const POINTER_COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed'];

interface PointerRing {
  participantId: string;
  x: number;
  y: number;
  at: number;
}

/** Group a code for speaking aloud: 4F7K9RB2 → 4F7K-9RB2 (9.3). */
function displayCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function fmtRemaining(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const s = Math.max(0, Math.floor((ms % 60_000) / 1000));
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SharePanel() {
  const { data: caps } = useShareCapabilities();
  const toast = useToast();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState<{ sessionId: string; joinCode: string; expiresAt: string } | null>(null);
  const [pointerRings, setPointerRings] = useState<PointerRing[]>([]);
  const [pointersEnabled, setPointersEnabled] = useState(true);
  const [mutedPointerIds, setMutedPointerIds] = useState<Set<string>>(new Set());
  const [idleWarning, setIdleWarning] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const create = useCreateShareSession();
  const end = useEndShareSession();
  const extend = useExtendShareSession();
  const sessionId = session?.sessionId ?? null;
  // Poll while a session is up so approval prompts appear even if the WS
  // nudge is missed; the WS participant-update invalidates faster.
  const { data: live, refetch: refetchSession } = useShareSession(sessionId, { poll: !!sessionId });
  const approve = useApproveParticipant(sessionId);
  const deny = useDenyParticipant(sessionId);
  const eject = useEjectParticipant(sessionId);

  const socketRef = useRef<ShareSocket | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const hiddenSinceRef = useRef<number | null>(null);
  const summaryShownRef = useRef(false);

  const participants = useMemo(() => live?.participants ?? [], [live]);
  const approved = useMemo(() => participants.filter((p) => p.status === 'approved'), [participants]);
  const requested = useMemo(() => participants.filter((p) => p.status === 'requested'), [participants]);
  const sessionOver = !!live && !['pending', 'active'].includes(live.session.status);

  // Queue rather than stack approval prompts (9.8): show the oldest.
  const activePrompt = requested.length > 0 ? requested[requested.length - 1]! : null;

  const stopEverything = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const endSession = useCallback(
    (why: string) => {
      if (!sessionId) return;
      // Client-side first (9.11): stop the recorder before the network trip.
      stopEverything();
      end.mutate(sessionId, {
        onSettled: () => {
          if (why !== 'quiet') toast.info('Screen sharing ended.');
        },
      });
      setSession(null);
      setIdleWarning(false);
    },
    [sessionId, stopEverything, end, toast],
  );

  // ── Sharer WS: participant updates, snapshot requests, pointers ──────────
  useEffect(() => {
    if (!sessionId) return;
    const sock = connectShareSocket({
      getTicket: () => fetchSharerTicket(sessionId),
      onMessage: (msg: ShareEnvelope) => {
        if (msg.type === 'participant-update') void refetchSession();
        else if (msg.type === 'snapshot-request') recorderRef.current?.takeFullSnapshot();
        else if (msg.type === 'pointer' && pointersEnabled) {
          const p = msg.payload as { x: number; y: number; participantId: string };
          if (!p || mutedPointerIds.has(p.participantId)) return;
          setPointerRings((rings) => [
            ...rings.filter((r) => r.participantId !== p.participantId),
            { participantId: p.participantId, x: p.x, y: p.y, at: Date.now() },
          ]);
        }
      },
      onClosed: ({ final }) => {
        if (final) {
          // Server ended the session (kill switch, TTL, admin revoke…).
          stopEverything();
          void refetchSession();
        }
      },
    });
    socketRef.current = sock;
    return () => {
      sock.close();
      socketRef.current = null;
    };
    // pointersEnabled/mutedPointerIds intentionally read via closure refresh:
    // reconnecting the socket on toggle would drop the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, refetchSession]);

  // ── Recorder lifecycle: record only while ≥1 approved viewer (7.3/7.4) ──
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    if (approved.length > 0 && !recorderRef.current) {
      void startRecorder({
        onBatch: (events) => {
          socketRef.current?.send({ v: 1, type: 'events', payload: { events } });
        },
        bufferedAmount: () => socketRef.current?.bufferedAmount() ?? 0,
      }).then((handle) => {
        if (cancelled) {
          handle.stop();
          return;
        }
        recorderRef.current = handle;
      });
    } else if (approved.length === 0 && recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    return () => {
      cancelled = true;
    };
  }, [sessionId, approved.length]);

  // ── Session end detection → post-session summary (9.13) ─────────────────
  useEffect(() => {
    if (!sessionOver || !live || summaryShownRef.current) return;
    summaryShownRef.current = true;
    stopEverything();
    const names = live.participants
      .filter((p) => p.approvedAt)
      .map((p) => {
        const start = p.approvedAt ? new Date(p.approvedAt).getTime() : 0;
        const stop = p.endedAt ? new Date(p.endedAt).getTime() : Date.now();
        const mins = Math.max(1, Math.round((stop - start) / 60_000));
        return `${p.viewerName} (${mins} min)`;
      });
    toast.info(
      names.length > 0 ? `Sharing ended. Viewers: ${names.join(', ')}.` : 'Sharing ended. No viewers joined.',
      { durationMs: 8000 },
    );
    setSession(null);
  }, [sessionOver, live, stopEverything, toast]);

  useEffect(() => {
    if (!sessionOver) summaryShownRef.current = false;
  }, [sessionOver]);

  // ── Idle + tab-hidden + pagehide bounds (7.8, 9.12, 13.6) ───────────────
  useEffect(() => {
    if (!sessionId) return;
    lastActivityRef.current = Date.now();
    const markActive = () => {
      lastActivityRef.current = Date.now();
      setIdleWarning(false);
    };
    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    for (const e of activityEvents) window.addEventListener(e, markActive, { passive: true });

    const onVisibility = () => {
      if (document.hidden) hiddenSinceRef.current = Date.now();
      else hiddenSinceRef.current = null;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onPageHide = () => {
      // Best effort: stop capture instantly; the server's sharer-disconnect
      // handling (5.11) ends the session authoritatively.
      recorderRef.current?.stop();
      socketRef.current?.close();
    };
    window.addEventListener('pagehide', onPageHide);

    const tick = setInterval(() => {
      setNow(Date.now());
      const idleFor = Date.now() - lastActivityRef.current;
      const hiddenFor = hiddenSinceRef.current ? Date.now() - hiddenSinceRef.current : 0;
      if (idleFor > IDLE_TIMEOUT_MS || hiddenFor > IDLE_TIMEOUT_MS) {
        endSession('idle');
      } else if (idleFor > IDLE_WARNING_MS) {
        setIdleWarning(true);
      }
      // Expire pointer rings after 3s.
      setPointerRings((rings) => rings.filter((r) => Date.now() - r.at < 3000));
    }, 1000);

    return () => {
      for (const e of activityEvents) window.removeEventListener(e, markActive);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      clearInterval(tick);
    };
  }, [sessionId, endSession]);

  if (!caps?.enabled) return null;

  const expiresAtMs = live ? new Date(live.session.expiresAt).getTime() : session ? new Date(session.expiresAt).getTime() : 0;
  const remainingMs = expiresAtMs - now;
  const pointerColorOf = (participantId: string) => {
    const idx = approved.findIndex((p) => p.id === participantId);
    return POINTER_COLORS[(idx >= 0 ? idx : 0) % POINTER_COLORS.length]!;
  };
  const pointerNameOf = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.viewerName ?? 'Viewer';

  return (
    <>
      {/* Header entry points (9.1, 10.1) */}
      {!session && (
        <span className="inline-flex items-center">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Share my screen with another MyBooks user"
          >
            <MonitorUp className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Share my screen</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/share/view')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Join a screen share someone else started"
          >
            <MonitorPlay className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Join a screen share</span>
          </button>
        </span>
      )}

      {/* Pre-share consent modal (9.2) + code display (9.3) */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Share my screen">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            {!session ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Share my screen</h2>
                <ul className="text-sm text-gray-700 space-y-2 mb-4 list-disc pl-5">
                  <li>Only this MyBooks tab is shared — never your desktop, other tabs, or other apps.</li>
                  <li>{SHARE_MASKING_SUMMARY}</li>
                  <li>Each person who wants to watch must be approved by you, by name, one at a time.</li>
                  <li>Sharing stops automatically after 60 minutes, or 90 seconds of inactivity — and you can stop it any time.</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 mb-4 flex gap-2">
                  <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>Only approve viewers you were already talking to. Never start a share because someone unexpected asked you to.</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() =>
                      create.mutate(localStorage.getItem('activeCompanyId'), {
                        onSuccess: (r) => setSession(r),
                        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not start sharing.'),
                      })
                    }
                    loading={create.isPending}
                  >
                    Start sharing
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Your join code</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Read this code to the person who should watch. They enter it under <b>Join a screen share</b>. You approve each person before they see anything. The code stays valid for additional viewers while the session lasts.
                </p>
                <div className="flex items-center justify-center gap-3 bg-gray-50 border border-gray-200 rounded-lg py-4 mb-4">
                  <span className="text-2xl font-mono font-bold tracking-widest text-gray-900" data-share-mask>
                    {displayCode(session.joinCode)}
                  </span>
                  <button
                    type="button"
                    aria-label="Copy join code"
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-200"
                    onClick={() => {
                      void navigator.clipboard?.writeText(session.joinCode);
                      toast.info('Code copied.');
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">Nothing is recorded or sent to anyone until you approve them.</p>
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>Done</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Approval prompt (9.4–9.6) — queued, one at a time */}
      {session && activePrompt && (
        <ApprovalPrompt
          key={activePrompt.id}
          sessionId={session.sessionId}
          participant={activePrompt}
          pendingCount={requested.length}
          onApprove={(flags) =>
            approve.mutate(
              { participantId: activePrompt.id, ...flags },
              { onError: (e) => toast.error(e instanceof Error ? e.message : 'Approval failed.') },
            )
          }
          onDeny={() => deny.mutate(activePrompt.id)}
          busy={approve.isPending || deny.isPending}
        />
      )}

      {/* Persistent live banner (9.9–9.10) */}
      {session && (
        <div
          className="fixed top-0 inset-x-0 z-[80] bg-red-600 text-white px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-2 font-semibold text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
            Sharing your screen
          </span>
          <span className="text-sm inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {fmtRemaining(remainingMs)} left
          </span>
          {approved.length === 0 && <span className="text-sm text-red-100">No viewers yet — nothing is being transmitted.</span>}
          {approved.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 bg-red-700 rounded-full pl-3 pr-1 py-0.5 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pointerColorOf(p.id) }} aria-hidden="true" />
              {p.viewerName}
              {p.isCrossFirm && (
                <span className="text-[10px] uppercase tracking-wide bg-amber-400 text-amber-950 rounded px-1" title={`Outside your firm: ${p.viewerFirmName}`}>
                  {p.viewerFirmName}
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${p.viewerName}`}
                className="p-1 rounded-full hover:bg-red-800"
                onClick={() => eject.mutate(p.id)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <span className="flex-1" />
          {remainingMs < TTL_WARNING_MS && remainingMs > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                extend.mutate(session.sessionId, {
                  onSuccess: () => toast.info('Session extended once.'),
                  onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not extend.'),
                })
              }
            >
              Extend once
            </Button>
          )}
          <button
            type="button"
            className="text-sm underline decoration-red-300 hover:decoration-white mr-1"
            onClick={() => setPointersEnabled((v) => !v)}
            title="Toggle viewer pointers"
          >
            {pointersEnabled ? 'Pointers on' : 'Pointers off'}
          </button>
          <Button size="sm" variant="secondary" onClick={() => endSession('user')}>
            Stop sharing
          </Button>
        </div>
      )}

      {/* Idle warning (9.12) */}
      {session && idleWarning && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-2 text-sm shadow-lg">
          Still there? Sharing stops in 30 seconds without activity.
        </div>
      )}

      {/* Viewer pointer overlay (11.2–11.3, sharer-only 11.4) */}
      {session && pointersEnabled && pointerRings.length > 0 && (
        <div className="fixed inset-0 z-[75] pointer-events-none" aria-hidden="true">
          {pointerRings
            .filter((r) => !mutedPointerIds.has(r.participantId))
            .map((r) => (
              <div
                key={r.participantId}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
              >
                <div
                  className="h-8 w-8 rounded-full border-4 animate-ping absolute -left-4 -top-4"
                  style={{ borderColor: pointerColorOf(r.participantId) }}
                />
                <button
                  type="button"
                  className="relative text-[10px] font-semibold text-white rounded px-1.5 py-0.5 mt-4 pointer-events-auto"
                  style={{ backgroundColor: pointerColorOf(r.participantId) }}
                  title="Click to hide this viewer's pointer"
                  onClick={() =>
                    setMutedPointerIds((prev) => new Set(prev).add(r.participantId))
                  }
                >
                  {pointerNameOf(r.participantId)}
                </button>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

// ── Approval dialog (9.4–9.6, 4.6–4.8) ─────────────────────────────────────

function ApprovalPrompt(props: {
  sessionId: string;
  participant: ShareParticipantView;
  pendingCount: number;
  onApprove: (flags: { crossFirmConfirmed?: boolean; scopeWarningConfirmed?: boolean }) => void;
  onDeny: () => void;
  busy: boolean;
}) {
  const { data: ctx } = useApprovalContext(props.sessionId, props.participant.id);
  const [crossFirmConfirmed, setCrossFirmConfirmed] = useState(false);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const deadline = new Date(ctx.requestedAt).getTime() + ctx.approvalWindowSeconds * 1000;
    const t = setInterval(() => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [ctx]);

  if (!ctx) return null;
  const entityMismatch = ctx.viewerHasEntityAccess === false;
  const needsCrossFirm = ctx.isCrossFirm && !crossFirmConfirmed;
  const needsScope = entityMismatch && !scopeConfirmed;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Screen share request">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Allow this person to watch?</h2>
        {props.pendingCount > 1 && (
          <p className="text-xs text-gray-500 mb-2">{props.pendingCount - 1} more request{props.pendingCount > 2 ? 's' : ''} waiting</p>
        )}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-3 text-sm">
          <div className="font-semibold text-gray-900">{ctx.viewerName}</div>
          <div className="text-gray-600">{ctx.viewerEmail}</div>
          <div className="text-gray-600">Firm: {ctx.viewerFirmName}</div>
          {secondsLeft !== null && (
            <div className="text-xs text-gray-400 mt-1">Request expires in {secondsLeft}s</div>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Only approve someone you were already talking to. If this request is unexpected, deny it.
        </p>

        {ctx.isCrossFirm && (
          <label className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3 mb-3 text-sm text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={crossFirmConfirmed}
              onChange={(e) => setCrossFirmConfirmed(e.target.checked)}
            />
            <span>
              <b>{ctx.viewerName} is outside your firm</b> ({ctx.viewerFirmName}). I understand they will see my MyBooks screen.
            </span>
          </label>
        )}

        {entityMismatch && (
          <label className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3 mb-3 text-sm text-red-900 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={scopeConfirmed}
              onChange={(e) => setScopeConfirmed(e.target.checked)}
            />
            <span>
              <b>{ctx.viewerName} does not have access to {ctx.entityName ?? 'the open company'}</b> in MyBooks. I understand they will see this company's books on my screen anyway.
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          {/* Deny is the safe default on dismissal (9.4). */}
          <Button variant="secondary" onClick={props.onDeny} disabled={props.busy}>
            Deny
          </Button>
          <Button
            onClick={() =>
              props.onApprove({
                crossFirmConfirmed: ctx.isCrossFirm ? crossFirmConfirmed : undefined,
                scopeWarningConfirmed: entityMismatch ? scopeConfirmed : undefined,
              })
            }
            disabled={props.busy || needsCrossFirm || needsScope || secondsLeft === 0}
            loading={props.busy}
          >
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}
