// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bill Capture BullMQ worker. Runs the bill-OCR pipeline for one uploaded
// vendor bill per job so it survives an API restart and is concurrency-
// capped (GLM-OCR is a single-slot engine). The API keeps a 30 s watchdog
// and runs the job in-process if nobody claims it — see
// bill-capture.service.ts dispatch().

import { Worker, type Job } from 'bullmq';
import {
  BILL_CAPTURE_QUEUE,
  makeRedisConnection,
  type BillCaptureJobData,
} from '../../../api/src/services/extraction/queue.js';
import { runBillCaptureJob } from '../../../api/src/services/bill-capture.service.js';
import { env } from '../../../api/src/config/env.js';

export function startBillCaptureWorker(): Worker<BillCaptureJobData> {
  const worker = new Worker<BillCaptureJobData>(
    BILL_CAPTURE_QUEUE,
    async (job: Job<BillCaptureJobData>) => {
      await runBillCaptureJob(job.data.tenantId, job.data.captureId);
    },
    {
      connection: makeRedisConnection(),
      concurrency: env.BILL_CAPTURE_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    // The bill_captures row was already marked failed by runBillCaptureJob;
    // this is operator-visible logging only.
    console.error(`[bill-capture] job ${job?.id ?? '?'} failed: ${err?.message ?? err}`);
  });
  return worker;
}
