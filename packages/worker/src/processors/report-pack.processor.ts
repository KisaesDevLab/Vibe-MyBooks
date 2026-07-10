// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// BullMQ worker for the `report-pack` queue: one job per report_pack_runs row.
// The generation itself lives in the API package (report-pack-generate.service)
// so it can also run inline in the API when no worker/Redis is available; this
// processor is just the queue wiring around it.

import { Worker, type Job } from 'bullmq';
import {
  REPORT_PACK_QUEUE,
  makeRedisConnection,
  type ReportPackJobData,
} from '../../../api/src/services/extraction/queue.js';
import { generateReportPackRun } from '../../../api/src/services/report-pack-generate.service.js';

export function startReportPackWorker(): Worker<ReportPackJobData> {
  const worker = new Worker<ReportPackJobData>(
    REPORT_PACK_QUEUE,
    async (job: Job<ReportPackJobData>) => {
      await generateReportPackRun(job.data.runId);
    },
    {
      connection: makeRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[report-pack] job ${job?.id ?? '?'} failed: ${err?.message ?? err}`);
  });
  return worker;
}
