// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// BullMQ worker for the `doc-render` queue: rasterizes an uploaded document
// to page images and enqueues a per-page extract job. Deep-relative imports
// into the API package follow the existing worker convention (the scheduler
// code is the source of truth; the worker runs it via tsx, no emit step).

import { Worker, type Job } from 'bullmq';
import {
  DOC_RENDER_QUEUE,
  makeRedisConnection,
  type RenderJobData,
} from '../../../api/src/services/extraction/queue.js';
import { processRender } from '../../../api/src/services/extraction/extraction.service.js';

export function startDocRenderWorker(): Worker<RenderJobData> {
  const worker = new Worker<RenderJobData>(
    DOC_RENDER_QUEUE,
    async (job: Job<RenderJobData>) => {
      await processRender(job.data.tenantId, job.data.jobId);
    },
    {
      connection: makeRedisConnection(),
      // Rendering is CPU/IO bound (poppler + image writes); a small cap keeps
      // a burst of uploads from saturating the box.
      concurrency: 2,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[doc-render] job ${job?.id ?? '?'} failed: ${err?.message ?? err}`);
  });
  return worker;
}
