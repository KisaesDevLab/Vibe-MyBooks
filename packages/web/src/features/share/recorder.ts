// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// rrweb recorder integration (Phase 7). The rrweb module is dynamically
// imported so it is code-split out of the main bundle and never downloaded
// unless a session actually has an approved viewer (7.2/7.3).

import {
  redactSensitiveText,
  maskInputFixed,
  BLOCK_SELECTOR,
  MASK_TEXT_SELECTOR,
  RR_IGNORE_CLASS,
} from './masking';

export interface RecorderHandle {
  /** Force a FullSnapshot (server sends snapshot-request for late joiners). */
  takeFullSnapshot: () => void;
  stop: () => void;
}

export interface RecorderCallbacks {
  /** Batched events ready to send. */
  onBatch: (events: unknown[]) => void;
  /** Current socket bufferedAmount, for backpressure (7.7). */
  bufferedAmount: () => number;
}

const FLUSH_INTERVAL_MS = 250; // 7.6
const FLUSH_BYTES = 32 * 1024; // 7.6
const BACKPRESSURE_BYTES = 1024 * 1024; // 7.7

export async function startRecorder(cb: RecorderCallbacks): Promise<RecorderHandle> {
  const rrweb = await import('rrweb');

  let buffer: unknown[] = [];
  let bufferBytes = 0;
  let droppedWhileBackpressured = false;
  let stopped = false;

  const flush = () => {
    if (stopped || buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    bufferBytes = 0;
    cb.onBatch(batch);
  };

  const timer = setInterval(() => {
    // Backpressure recovery: once the socket drains after we dropped
    // incrementals, force a FullSnapshot so viewers resync (7.7).
    if (droppedWhileBackpressured && cb.bufferedAmount() < BACKPRESSURE_BYTES / 4) {
      droppedWhileBackpressured = false;
      try {
        rrweb.record.takeFullSnapshot(true);
      } catch {
        /* recorder may be mid-teardown */
      }
    }
    flush();
  }, FLUSH_INTERVAL_MS);

  const stopRecord = rrweb.record({
    emit(event) {
      if (stopped) return;
      // rrweb EventType: 2 = FullSnapshot, 4 = Meta. Those are never dropped.
      const critical = event.type === 2 || event.type === 4;
      if (!critical && cb.bufferedAmount() > BACKPRESSURE_BYTES) {
        droppedWhileBackpressured = true;
        return;
      }
      buffer.push(event);
      // Cheap byte estimate; exact size is measured at send time.
      bufferBytes += JSON.stringify(event).length;
      if (critical || bufferBytes >= FLUSH_BYTES) flush();
    },
    // ── Masking policy (Phase 8; see masking.ts + docs/screen-share.md) ──
    maskAllInputs: true, // 8.1 — every input masked, no allowlist yet
    maskInputFn: maskInputFixed, // 8.6 — fixed-length, hides value length
    maskTextFn: redactSensitiveText, // 8.4 — pattern redaction on ALL text
    maskTextClass: 'rr-mask',
    maskTextSelector: MASK_TEXT_SELECTOR, // 8.3/8.5
    blockClass: 'rr-block',
    blockSelector: BLOCK_SELECTOR, // 8.7
    ignoreClass: RR_IGNORE_CLASS,
    // ── Capture profile (7.5) ──
    inlineStylesheet: true,
    inlineImages: false, // 8.12 — images stay URL references
    recordCanvas: false,
    collectFonts: false,
    sampling: { mousemove: 50, scroll: 150, input: 'last', media: 800 },
    slimDOMOptions: 'all',
    checkoutEveryNms: 120_000,
  });

  return {
    takeFullSnapshot: () => {
      try {
        rrweb.record.takeFullSnapshot(true);
      } catch {
        /* not recording */
      }
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      try {
        stopRecord?.();
      } catch {
        /* already stopped */
      }
      buffer = [];
      bufferBytes = 0;
    },
  };
}
