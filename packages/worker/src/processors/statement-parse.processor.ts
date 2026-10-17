// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Worker for the `statement-parse` queue: one job per uploaded bank /
// credit-card statement → detect → OCR (GLM-OCR) → extract (LLM) → reconcile,
// updating the ai_jobs row the upload UI polls. Running this in the worker
// (rather than fire-and-forget in the API) means a statement parse survives an
// API restart/redeploy and is concurrency-capped so heavy multi-page OCR can't
// starve request serving.
//
// The handler is shared with the desktop in-process worker (api
// queue/handlers.ts); the backend (BullMQ on the server), concurrency, retries
// and log lines come from the JobQueue and its spec (api queue/specs.ts).

import { STATEMENT_PARSE_QUEUE } from '../../../api/src/services/extraction/queue.js';
import { getJobQueue } from '../../../api/src/queue/index.js';
import { JOB_HANDLERS } from '../../../api/src/queue/handlers.js';
import type { WorkerHandle } from '../../../api/src/queue/job-queue.js';

export async function startStatementParseWorker(): Promise<WorkerHandle> {
  return (await getJobQueue()).work(STATEMENT_PARSE_QUEUE, JOB_HANDLERS[STATEMENT_PARSE_QUEUE]);
}
