// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Worker for the `doc-render` queue: rasterizes an uploaded document
// to page images and enqueues a per-page extract job. Deep-relative imports
// into the API package follow the existing worker convention (the scheduler
// code is the source of truth; the worker runs it via tsx, no emit step).
//
// The handler is shared with the desktop in-process worker (api
// queue/handlers.ts); the backend (BullMQ on the server), concurrency, retries
// and log lines come from the JobQueue and its spec (api queue/specs.ts).

import { DOC_RENDER_QUEUE } from '../../../api/src/services/extraction/queue.js';
import { getJobQueue } from '../../../api/src/queue/index.js';
import { JOB_HANDLERS } from '../../../api/src/queue/handlers.js';
import type { WorkerHandle } from '../../../api/src/queue/job-queue.js';

export async function startDocRenderWorker(): Promise<WorkerHandle> {
  return (await getJobQueue()).work(DOC_RENDER_QUEUE, JOB_HANDLERS[DOC_RENDER_QUEUE]);
}
