// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Worker container entry point.
//
// Historical note: this file was a 15-line stub that only kept the
// event loop alive. The schedulers (backup + recurring) have been
// running inside the API process instead, which was fine functionally
// because `withSchedulerLock` (Postgres advisory lock) prevents two
// processes from doing the same cycle — but it left the worker
// container idle and architecturally misplaced the scheduling
// responsibility.
//
// This file now boots the same scheduler functions the API boots.
// Because both still acquire the same advisory locks, either process
// can go down without losing coverage — and on a normal deploy the
// worker is the one that actually wins the lock since it's usually
// up first.
//
// Deep-relative imports into the API package are intentional: the
// scheduler code is the source of truth and we don't want a second
// copy to drift. The worker's tsconfig widens `include` to let this
// resolve; runtime uses `tsx` so no emit step is needed.

import { startBackupScheduler } from '../../api/src/services/backup-scheduler.service.js';
import { startRecurringScheduler } from '../../api/src/services/recurring.service.js';
import { runChunkedTagBackfill } from '../../api/src/services/tags/backfill-sweep.service.js';
import { startCloudflaredAlerter, stopCloudflaredAlerter } from '../../api/src/services/cloudflared/alert.service.js';
import { startBackupVerifier, stopBackupVerifier } from '../../api/src/services/backup-verify.service.js';
import { startClassificationStateBackfill } from '../../api/src/services/classification-state-backfill.service.js';
import { startCheckScheduler, stopCheckScheduler } from '../../api/src/services/review-checks/scheduler.service.js';
import { startPortalRecurringScheduler, stopPortalRecurringScheduler } from '../../api/src/services/portal-recurring-scheduler.service.js';
import { startPortalReminderScheduler, stopPortalReminderScheduler } from '../../api/src/services/portal-reminder-scheduler.service.js';
import { startRecurringDocRequestScheduler, stopRecurringDocRequestScheduler } from '../../api/src/services/recurring-doc-request-scheduler.service.js';
import { pool } from '../../api/src/db/index.js';

const startedAt = new Date().toISOString();
console.log(`[Worker] Vibe MyBooks worker starting at ${startedAt}`);

try {
  startBackupScheduler();
  startRecurringScheduler();
  startCloudflaredAlerter();
  startBackupVerifier();
  startClassificationStateBackfill();
  startCheckScheduler();
  startPortalRecurringScheduler();
  startPortalReminderScheduler();
  startRecurringDocRequestScheduler();
  console.log('[Worker] Schedulers registered: backup-scheduler, recurring-scheduler, cloudflared-alerter, backup-verifier, classification-state-backfill, review-checks-scheduler, portal-recurring-scheduler, portal-reminder-scheduler, recurring-doc-request-scheduler');

  // One-shot chunked tag backfill sweep. Runs in the background so
  // worker startup isn't gated on it — the advisory lock ensures no
  // two processes do the work, and the sweep is a no-op when no
  // untagged-but-transaction-tagged journal lines remain (which is
  // the steady state once it has run once on a tenant).
  void runChunkedTagBackfill()
    .then((r) => {
      if (r.skipped) {
        console.log('[Worker] tag-backfill sweep skipped (lock held elsewhere)');
      } else if (r.chunks === 0) {
        console.log('[Worker] tag-backfill sweep found nothing to backfill');
      } else {
        console.log(`[Worker] tag-backfill sweep done: chunks=${r.chunks} rows=${r.rowsUpdated}`);
      }
    })
    .catch((err) => console.error('[Worker] tag-backfill sweep failed:', err));
} catch (err) {
  // A bootstrap-time error here would leave the container restarting
  // every few seconds under `restart: unless-stopped`. Log loudly and
  // exit non-zero so Docker reports the unhealthy state rather than
  // silently consuming the loop.
  console.error('[Worker] Fatal bootstrap error:', err);
  process.exit(1);
}

// Heartbeat log so operators can verify the worker is alive without
// waiting for the first scheduler tick (hourly) — otherwise a crashed
// scheduler could go unnoticed for 60 minutes. Keep a handle so the
// shutdown path can stop it cleanly.
const heartbeat = setInterval(() => {
  console.log(`[Worker] Heartbeat ${new Date().toISOString()}`);
}, 15 * 60 * 1000);

// Graceful shutdown — same shape as the API's handler. The in-process
// schedulers use setInterval/setTimeout, which Node's built-in pool
// unref doesn't clear, so we explicitly stop the heartbeat and flush
// the DB pool. Postgres session advisory locks release on connection
// close, which frees the next scheduler tick elsewhere immediately.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Worker] ${signal} received — shutting down`);
  clearInterval(heartbeat);
  stopCloudflaredAlerter();
  stopBackupVerifier();
  stopCheckScheduler();
  stopPortalRecurringScheduler();
  stopPortalReminderScheduler();
  stopRecurringDocRequestScheduler();
  const forceExit = setTimeout(() => {
    console.error('[Worker] shutdown deadline exceeded — forcing exit');
    process.exit(1);
  }, 10_000);
  if (typeof forceExit.unref === 'function') forceExit.unref();
  try { await pool.end(); } catch (err) { console.error('[Worker] pool.end error:', err); }
  clearTimeout(forceExit);
  process.exit(0);
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('unhandledRejection', (reason) => console.error('[Worker:unhandledRejection]', reason));
process.on('uncaughtException', (err) => { console.error('[Worker:uncaughtException]', err); void shutdown('uncaughtException'); });
