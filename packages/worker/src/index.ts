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

const startedAt = new Date().toISOString();
console.log(`[Worker] Vibe MyBooks worker starting at ${startedAt}`);

try {
  startBackupScheduler();
  startRecurringScheduler();
  console.log('[Worker] Schedulers registered: backup-scheduler, recurring-scheduler');
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
// scheduler could go unnoticed for 60 minutes.
setInterval(() => {
  console.log(`[Worker] Heartbeat ${new Date().toISOString()}`);
}, 15 * 60 * 1000);
