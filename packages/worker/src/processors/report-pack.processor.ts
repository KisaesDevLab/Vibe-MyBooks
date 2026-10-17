// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Worker for the `report-pack` queue: one job per report_pack_runs row.
// The generation itself lives in the API package (report-pack-generate.service)
// so it can also run inline in the API when no worker/Redis is available; this
// processor is just the queue wiring around it.
//
// The handler is shared with the desktop in-process worker (api
// queue/handlers.ts); the backend (BullMQ on the server), concurrency, retries
// and log lines come from the JobQueue and its spec (api queue/specs.ts).

import { REPORT_PACK_QUEUE } from '../../../api/src/services/extraction/queue.js';
import { getJobQueue } from '../../../api/src/queue/index.js';
import { JOB_HANDLERS } from '../../../api/src/queue/handlers.js';
import type { WorkerHandle } from '../../../api/src/queue/job-queue.js';

export async function startReportPackWorker(): Promise<WorkerHandle> {
  return (await getJobQueue()).work(REPORT_PACK_QUEUE, JOB_HANDLERS[REPORT_PACK_QUEUE]);
}
