// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Worker for the `tax-param-ai-check` queue: one job per tax_param_ai_check_runs row
// (Tax Estimator AI parameter check, OPEN-QUESTIONS Q48). The run itself lives in the API
// package (tax-param-ai-check.service executeRun) so the API can also run it in-process when no
// worker / Redis is available. Concurrency 1 here: each run already checks two rows at a time,
// and the claim (queued → running) is a compare-and-swap, so a watchdog cannot double-run it.
//
// The handler is shared with the desktop in-process worker (api
// queue/handlers.ts); the backend (BullMQ on the server), concurrency, retries
// and log lines come from the JobQueue and its spec (api queue/specs.ts).

import { TAX_PARAM_AI_CHECK_QUEUE } from '../../../api/src/services/extraction/queue.js';
import { getJobQueue } from '../../../api/src/queue/index.js';
import { JOB_HANDLERS } from '../../../api/src/queue/handlers.js';
import type { WorkerHandle } from '../../../api/src/queue/job-queue.js';

export async function startTaxParamAiCheckWorker(): Promise<WorkerHandle> {
  return (await getJobQueue()).work(TAX_PARAM_AI_CHECK_QUEUE, JOB_HANDLERS[TAX_PARAM_AI_CHECK_QUEUE]);
}
