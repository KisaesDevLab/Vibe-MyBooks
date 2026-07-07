// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// BullMQ worker for the `report-pack` queue: one job per report_pack_runs row.
// Renders each report section to its own single-orientation PDF via a single
// Chromium, then merges [cover, TOC, ...sections] with pdf-lib, stamps
// cross-document page numbers, and uploads the merged buffer as a transient
// artifact (expires_at = now + TTL). Running this in the worker keeps the
// heavy multi-render off the request path and survives an API restart.

import { Worker, type Job } from 'bullmq';
import { and, asc, eq } from 'drizzle-orm';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import puppeteer, { type Browser } from 'puppeteer';
import {
  getReportDef,
  resolveReportDates,
  reportPackItemOptionsSchema,
} from '@kis-books/shared';
import {
  REPORT_PACK_QUEUE,
  makeRedisConnection,
  type ReportPackJobData,
} from '../../../api/src/services/extraction/queue.js';
import { db } from '../../../api/src/db/index.js';
import { sql } from 'drizzle-orm';
import {
  reportPacks,
  reportPackItems,
  reportPackRuns,
} from '../../../api/src/db/schema/index.js';
import {
  REPORT_PACK_RENDERERS,
  renderReportSectionHtml,
} from '../../../api/src/services/report-pack-render.js';
import {
  buildReportPackSectionHtml,
  escapeHtml,
} from '../../../api/src/services/report-export.service.js';
import { getReportFooter } from '../../../api/src/services/tenant-report-settings.service.js';
import { getProviderForTenant } from '../../../api/src/services/storage/storage-provider.factory.js';
import {
  reportPackArtifactKey,
  ARTIFACT_TTL_MS,
} from '../../../api/src/services/report-pack.service.js';

const TOC_ENTRIES_PER_PAGE = 30;

const PDF_MARGIN = { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' };

interface RenderedSection {
  reportId: string;
  label: string;
  bytes: Uint8Array;
  pageCount: number;
  startPage: number; // 1-based page number in the merged document
}

interface SectionFailure {
  reportId: string;
  message: string;
}

async function htmlToPdfBytes(browser: Browser, html: string, landscape: boolean): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'Letter',
      landscape,
      margin: PDF_MARGIN,
      printBackground: true,
    });
  } finally {
    await page.close();
  }
}

function coverHtml(packName: string, companyName: string, dateLabel: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#111}
    .company{font-size:16px;color:#666;margin-bottom:8px}
    .title{font-size:34px;font-weight:700;text-align:center;margin:0 40px}
    .date{font-size:15px;color:#444;margin-top:16px}
  </style></head><body>
    <div class="company">${escapeHtml(companyName)}</div>
    <div class="title">${escapeHtml(packName)}</div>
    <div class="date">${escapeHtml(dateLabel)}</div>
  </body></html>`;
}

function tocHtml(entries: Array<{ label: string; startPage: number }>): string {
  const rows = entries.map((e, i) => `
    <tr><td class="idx">${i + 1}.</td><td class="lbl">${escapeHtml(e.label)}</td><td class="pg">${e.startPage}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:40px;color:#111}
    h1{font-size:24px;margin:0 0 24px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:7px 4px;border-bottom:1px solid #eee}
    .idx{width:34px;color:#666}
    .pg{width:60px;text-align:right;font-variant-numeric:tabular-nums;color:#444}
  </style></head><body>
    <h1>Contents</h1>
    <table>${rows}</table>
  </body></html>`;
}

/** Copy every page of a source PDF (raw bytes) into `target`. */
async function appendPdf(target: PDFDocument, srcBytes: Uint8Array): Promise<void> {
  const src = await PDFDocument.load(srcBytes);
  const pages = await target.copyPages(src, src.getPageIndices());
  for (const p of pages) target.addPage(p);
}

async function processRun(runId: string): Promise<void> {
  const run = await db.query.reportPackRuns.findFirst({ where: eq(reportPackRuns.id, runId) });
  if (!run) {
    console.error(`[report-pack] run ${runId} not found — skipping`);
    return;
  }
  const pack = await db.query.reportPacks.findFirst({ where: eq(reportPacks.id, run.packId) });
  if (!pack || pack.deletedAt) {
    await db.update(reportPackRuns).set({
      status: 'failed',
      finishedAt: new Date(),
      errorJson: { message: 'Pack was deleted before the run started' },
    }).where(eq(reportPackRuns.id, runId));
    return;
  }

  const items = await db.select().from(reportPackItems)
    .where(eq(reportPackItems.packId, pack.id))
    .orderBy(asc(reportPackItems.sortOrder));

  await db.update(reportPackRuns).set({ status: 'running', startedAt: new Date() })
    .where(eq(reportPackRuns.id, runId));

  // Company chrome + tenant footer.
  const companyRow = await db.execute(
    sql`SELECT business_name FROM companies WHERE id = ${run.companyId}`,
  );
  const companyName = (companyRow.rows as Array<{ business_name?: string }>)[0]?.business_name || 'Company';
  const footer = await getReportFooter(run.tenantId);

  const rangeStart = run.rangeStart ?? '';
  const rangeEnd = run.rangeEnd ?? '';
  const asOfDate = run.asOfDate ?? rangeEnd;

  const sections: RenderedSection[] = [];
  const failures: SectionFailure[] = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
  });

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      await db.update(reportPackRuns).set({
        progress: Math.round((i / Math.max(items.length, 1)) * 90),
        currentReportId: item.reportId,
      }).where(eq(reportPackRuns.id, runId));

      const def = getReportDef(item.reportId);
      try {
        const renderer = REPORT_PACK_RENDERERS[item.reportId];
        if (!def || !renderer) throw new Error(`Unknown report id: ${item.reportId}`);

        const options = reportPackItemOptionsSchema.parse(item.optionsJson ?? {});
        const params = resolveReportDates(def, { start: rangeStart, end: rangeEnd }, asOfDate);
        const opts = {
          basis: options.basis ?? (pack.defaultBasis === 'cash' ? 'cash' as const : 'accrual' as const),
          tagId: options.tagId ?? pack.defaultTagId ?? null,
          groupBy: options.groupBy ?? null,
          showPct: options.showPct ?? false,
        };

        const reportData = await renderer(run.tenantId, run.companyId, params, opts);
        const { html: tableHtml, orientation } = renderReportSectionHtml(item.reportId, reportData);
        const dateLabel = def.temporal === 'as-of'
          ? `As of ${params['as_of_date'] ?? asOfDate}`
          : `${rangeStart} to ${rangeEnd}`;
        const sectionHtml = buildReportPackSectionHtml({
          title: def.label, companyName, dateLabel, tableHtml, footer,
        });
        const bytes = await htmlToPdfBytes(browser, sectionHtml, orientation === 'landscape');
        const doc = await PDFDocument.load(bytes);
        sections.push({
          reportId: item.reportId,
          label: def.label,
          bytes,
          pageCount: doc.getPageCount(),
          startPage: 0, // filled in after cover/TOC sizing
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (pack.onError === 'skip') {
          failures.push({ reportId: item.reportId, message });
          continue;
        }
        throw err;
      }
    }

    // ── Layout: cover (1) + TOC (ceil(n/30)) + sections ──
    const coverPages = pack.coverPage ? 1 : 0;
    const tocPages = pack.toc && sections.length > 0
      ? Math.ceil(sections.length / TOC_ENTRIES_PER_PAGE)
      : 0;
    let cursor = coverPages + tocPages + 1;
    for (const s of sections) {
      s.startPage = cursor;
      cursor += s.pageCount;
    }

    const merged = await PDFDocument.create();

    if (coverPages > 0) {
      const dateLabel = `${rangeStart} to ${rangeEnd}`;
      await appendPdf(merged, await htmlToPdfBytes(browser, coverHtml(pack.name, companyName, dateLabel), false));
    }
    if (tocPages > 0) {
      const tocBytes = await htmlToPdfBytes(
        browser,
        tocHtml(sections.map((s) => ({ label: s.label, startPage: s.startPage }))),
        false,
      );
      await appendPdf(merged, tocBytes);
    }
    for (const s of sections) {
      await appendPdf(merged, s.bytes);
    }

    // Never produce a 0-page PDF (valid-file guard for an all-skip run).
    if (merged.getPageCount() === 0) merged.addPage();

    // ── Cross-document page numbers ("Page X of Y"), skipping the cover ──
    if (pack.pageNumbers) {
      const font = await merged.embedFont(StandardFonts.Helvetica);
      const pages = merged.getPages();
      const total = pages.length;
      pages.forEach((page, idx) => {
        if (idx < coverPages) return; // no number on the cover
        const label = `Page ${idx + 1} of ${total}`;
        const size = 8;
        const width = font.widthOfTextAtSize(label, size);
        const { width: pw } = page.getSize();
        page.drawText(label, {
          x: pw - width - 36,
          y: 18,
          size,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      });
    }

    const mergedBytes = await merged.save();
    const buffer = Buffer.from(mergedBytes);
    const key = reportPackArtifactKey(run.tenantId, runId);
    const provider = await getProviderForTenant(run.tenantId);
    await provider.upload(key, buffer, {
      fileName: `${runId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: buffer.length,
    });

    const status = failures.length > 0 ? 'partial' : 'succeeded';
    await db.update(reportPackRuns).set({
      status,
      progress: 100,
      currentReportId: null,
      transientKey: key,
      expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS),
      pageCount: merged.getPageCount(),
      byteSize: buffer.length,
      errorJson: failures.length > 0 ? { failures } : null,
      finishedAt: new Date(),
    }).where(eq(reportPackRuns.id, runId));

    console.log(`[report-pack] run ${runId} ${status}: ${sections.length} section(s), ${failures.length} failure(s), ${merged.getPageCount()} page(s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(reportPackRuns).set({
      status: 'failed',
      currentReportId: null,
      errorJson: { message, failures },
      finishedAt: new Date(),
    }).where(and(eq(reportPackRuns.id, runId)));
    throw err;
  } finally {
    await browser.close();
  }
}

export function startReportPackWorker(): Worker<ReportPackJobData> {
  const worker = new Worker<ReportPackJobData>(
    REPORT_PACK_QUEUE,
    async (job: Job<ReportPackJobData>) => {
      await processRun(job.data.runId);
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
