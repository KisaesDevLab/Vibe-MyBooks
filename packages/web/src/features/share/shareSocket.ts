// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// WebSocket client for peer screen share. Auth is a single-use ticket sent as
// the FIRST message (never query string — it must not land in proxy logs).
// Reconnects with exponential backoff, capped at 5 attempts (7.8).

export interface ShareEnvelope {
  v: 1;
  type: 'hello' | 'ready' | 'events' | 'snapshot-request' | 'pointer' | 'participant-update' | 'bye' | 'error';
  seq?: number;
  payload?: unknown;
}

export interface ShareSocketCallbacks {
  /** Fresh single-use ticket for each (re)connect attempt. */
  getTicket: () => Promise<string>;
  onMessage: (msg: ShareEnvelope) => void;
  onOpen?: () => void;
  /** Called when the socket closes and will NOT be retried (final). */
  onClosed: (info: { code: number; reason: string; final: boolean }) => void;
}

export interface ShareSocket {
  send: (msg: ShareEnvelope) => void;
  bufferedAmount: () => number;
  close: () => void;
  isOpen: () => boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;
// Server close codes that must NOT trigger a reconnect (deliberate ends).
const NO_RETRY_CODES = new Set([1000, 4003, 4005, 4009, 4010, 4011, 4013]);

export function shareWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/share`;
}

export function connectShareSocket(cb: ShareSocketCallbacks): ShareSocket {
  let ws: WebSocket | null = null;
  let attempts = 0;
  let closedByUs = false;
  let seq = 0;

  const open = async () => {
    let ticket: string;
    try {
      ticket = await cb.getTicket();
    } catch (err) {
      cb.onClosed({ code: 0, reason: err instanceof Error ? err.message : 'ticket failed', final: true });
      return;
    }
    const sock = new WebSocket(shareWsUrl());
    ws = sock;
    sock.onopen = () => {
      sock.send(JSON.stringify({ v: 1, type: 'hello', payload: { ticket } } satisfies ShareEnvelope));
      attempts = 0;
      cb.onOpen?.();
    };
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ShareEnvelope;
        if (msg && msg.v === 1) cb.onMessage(msg);
      } catch {
        /* ignore malformed */
      }
    };
    sock.onclose = (ev) => {
      if (ws !== sock) return; // superseded
      ws = null;
      if (closedByUs || NO_RETRY_CODES.has(ev.code) || attempts >= MAX_RECONNECT_ATTEMPTS) {
        cb.onClosed({ code: ev.code, reason: ev.reason, final: true });
        return;
      }
      attempts += 1;
      cb.onClosed({ code: ev.code, reason: ev.reason, final: false });
      setTimeout(() => {
        if (!closedByUs) void open();
      }, Math.min(500 * 2 ** attempts, 8000));
    };
  };

  void open();

  return {
    send: (msg) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        seq += 1;
        ws.send(JSON.stringify({ ...msg, seq }));
      }
    },
    bufferedAmount: () => ws?.bufferedAmount ?? 0,
    close: () => {
      closedByUs = true;
      try {
        ws?.send(JSON.stringify({ v: 1, type: 'bye' } satisfies ShareEnvelope));
      } catch {
        /* already closed */
      }
      ws?.close(1000, 'bye');
      ws = null;
    },
    isOpen: () => ws?.readyState === WebSocket.OPEN,
  };
}
