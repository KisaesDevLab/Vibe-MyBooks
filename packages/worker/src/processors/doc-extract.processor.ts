// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// BullMQ worker for the `doc-extract` queue: one job per rendered page →
// local Qwen vision call → validate → persist or flag for review. Worker
// concurrency is the model-call concurrency cap (EXTRACTION_EXTRACT_CONCURRENCY),
// so a heavy image-prefill model can't be hammered with parallel calls.

import { Worker, type Job } from 'bullmq';
import {
  DOC_EXTRACT_QUEUE,
  makeRedisConnection,
  type ExtractJobData,
} from '../../../api/src/services/extraction/queue.js';
import { processExtractPage } from '../../../api/src/services/extraction/extraction.service.js';
import { env } from '../../../api/src/config/env.js';

export function startDocExtractWorker(): Worker<ExtractJobData> {
  const worker = new Worker<ExtractJobData>(
    DOC_EXTRACT_QUEUE,
    async (job: Job<ExtractJobData>) => {
      await processExtractPage(job.data.tenantId, job.data.jobId, job.data.pageNo);
    },
    {
      connection: makeRedisConnection(),
      concurrency: env.EXTRACTION_EXTRACT_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[doc-extract] job ${job?.id ?? '?'} failed: ${err?.message ?? err}`);
  });
  return worker;
}
