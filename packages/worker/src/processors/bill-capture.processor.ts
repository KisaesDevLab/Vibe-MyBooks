// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bill Capture worker. Runs the bill-OCR pipeline for one uploaded
// vendor bill per job so it survives an API restart and is concurrency-
// capped (GLM-OCR is a single-slot engine). The API keeps a 30 s watchdog
// and runs the job in-process if nobody claims it — see
// bill-capture.service.ts dispatch().
//
// The handler is shared with the desktop in-process worker (api
// queue/handlers.ts); the backend (BullMQ on the server), concurrency, retries
// and log lines come from the JobQueue and its spec (api queue/specs.ts).

import { BILL_CAPTURE_QUEUE } from '../../../../engine/packages/api/src/services/extraction/queue.js';
import { getJobQueue } from '../../../../engine/packages/api/src/queue/index.js';
import { JOB_HANDLERS } from '../../../../engine/packages/api/src/queue/handlers.js';
import type { WorkerHandle } from '../../../../engine/packages/api/src/queue/job-queue.js';

export async function startBillCaptureWorker(): Promise<WorkerHandle> {
  return (await getJobQueue()).work(BILL_CAPTURE_QUEUE, JOB_HANDLERS[BILL_CAPTURE_QUEUE]);
}
