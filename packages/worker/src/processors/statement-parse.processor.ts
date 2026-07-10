// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// BullMQ worker for the `statement-parse` queue: one job per uploaded bank /
// credit-card statement → detect → OCR (GLM-OCR) → extract (LLM) → reconcile,
// updating the ai_jobs row the upload UI polls. Running this in the worker
// (rather than fire-and-forget in the API) means a statement parse survives an
// API restart/redeploy and is concurrency-capped so heavy multi-page OCR can't
// starve request serving.

import { Worker, type Job } from 'bullmq';
import {
  STATEMENT_PARSE_QUEUE,
  makeRedisConnection,
  type StatementParseJobData,
} from '../../../api/src/services/extraction/queue.js';
import { runStatementParseJob } from '../../../api/src/services/ai-statement-parser.service.js';
import { env } from '../../../api/src/config/env.js';

export function startStatementParseWorker(): Worker<StatementParseJobData> {
  const worker = new Worker<StatementParseJobData>(
    STATEMENT_PARSE_QUEUE,
    async (job: Job<StatementParseJobData>) => {
      await runStatementParseJob(job.data.tenantId, job.data.attachmentId, job.data.jobId);
    },
    {
      connection: makeRedisConnection(),
      concurrency: env.STATEMENT_PARSE_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    // The ai_jobs row was already terminal-failed by runStatementParseJob; this
    // is just operator-visible logging.
    console.error(`[statement-parse] job ${job?.id ?? '?'} failed: ${err?.message ?? err}`);
  });
  return worker;
}
