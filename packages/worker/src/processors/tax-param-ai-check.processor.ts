// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// BullMQ worker for the `tax-param-ai-check` queue: one job per tax_param_ai_check_runs row
// (Tax Estimator AI parameter check, OPEN-QUESTIONS Q48). The run itself lives in the API
// package (tax-param-ai-check.service executeRun) so the API can also run it in-process when no
// worker / Redis is available. Concurrency 1 here: each run already checks two rows at a time,
// and the claim (queued → running) is a compare-and-swap, so a watchdog cannot double-run it.

import { Worker, type Job } from 'bullmq';
import {
  TAX_PARAM_AI_CHECK_QUEUE,
  makeRedisConnection,
  type TaxParamAiCheckJobData,
} from '../../../api/src/services/extraction/queue.js';
import { executeRun } from '../../../api/src/services/tax-estimator/tax-param-ai-check.service.js';

export function startTaxParamAiCheckWorker(): Worker<TaxParamAiCheckJobData> {
  const worker = new Worker<TaxParamAiCheckJobData>(
    TAX_PARAM_AI_CHECK_QUEUE,
    async (job: Job<TaxParamAiCheckJobData>) => {
      await executeRun(job.data.runId);
    },
    { connection: makeRedisConnection(), concurrency: 1 },
  );
  worker.on('completed', (job) => {
    console.log(`[tax-ai-check] job ${job.id} completed in worker (${(job.finishedOn ?? Date.now()) - (job.processedOn ?? job.timestamp)} ms)`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[tax-ai-check] job ${job?.id ?? '?'} failed: ${err?.message ?? err}`);
  });
  return worker;
}
