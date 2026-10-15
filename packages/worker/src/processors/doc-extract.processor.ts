// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Worker for the `doc-extract` queue: one job per rendered page →
// local Qwen vision call → validate → persist or flag for review. Worker
// concurrency is the model-call concurrency cap (EXTRACTION_EXTRACT_CONCURRENCY),
// so a heavy image-prefill model can't be hammered with parallel calls.
//
// The handler is shared with the desktop in-process worker (api
// queue/handlers.ts); the backend (BullMQ on the server), concurrency, retries
// and log lines come from the JobQueue and its spec (api queue/specs.ts).

import { DOC_EXTRACT_QUEUE } from '../../../api/src/services/extraction/queue.js';
import { getJobQueue } from '../../../api/src/queue/index.js';
import { JOB_HANDLERS } from '../../../api/src/queue/handlers.js';
import type { WorkerHandle } from '../../../api/src/queue/job-queue.js';

export async function startDocExtractWorker(): Promise<WorkerHandle> {
  return (await getJobQueue()).work(DOC_EXTRACT_QUEUE, JOB_HANDLERS[DOC_EXTRACT_QUEUE]);
}
