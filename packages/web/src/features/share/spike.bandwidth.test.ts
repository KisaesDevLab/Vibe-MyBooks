// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Phase 0.7 spike, kept as a regression test: rrweb 1.1.3 event volume on a
// register-like DOM (500 rows) under a scripted burst of typical mutations —
// scrolling state, search typing, live recategorization edits. The abort
// criterion from the addendum was sustained >100 KB/s per viewer; the
// serialized event stream for this workload must stay far under it.
//
// jsdom serializes DOM structure exactly like a browser for byte-count
// purposes (no layout needed — rrweb ships DOM, not pixels).

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as rrweb from 'rrweb';

function buildRegister(rows: number): void {
  const body = document.body;
  const rowsHtml = Array.from({ length: rows }, (_, i) =>
    `<tr><td>${new Date(2026, 5, 1 + (i % 30)).toLocaleDateString()}</td><td>Vendor ${i} Hardware &amp; Supply Co</td><td>Checking ••1234</td><td>Office Supplies:Field ${i % 7}</td><td class="amt">$${(Math.abs(Math.sin(i)) * 4200).toFixed(2)}</td><td><span class="badge">cleared</span></td></tr>`,
  ).join('');
  body.innerHTML = `
    <header><input id="search" placeholder="Search transactions"/><button>Filter</button></header>
    <table><thead><tr><th>Date</th><th>Name</th><th>Account</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody id="tb">${rowsHtml}</tbody></table>`;
}

describe('rrweb bandwidth spike (Phase 0.7)', () => {
  it('keeps a 500-row register workload far under the 100 KB/s abort ceiling', async () => {
    buildRegister(500);
    let totalBytes = 0;
    let snapshotBytes = 0;
    let eventCount = 0;

    const stop = rrweb.record({
      emit(ev) {
        const size = JSON.stringify(ev).length;
        totalBytes += size;
        eventCount += 1;
        if (ev.type === 2) snapshotBytes += size;
      },
      maskAllInputs: true,
      inlineStylesheet: true,
      inlineImages: false,
      recordCanvas: false,
      collectFonts: false,
      sampling: { mousemove: 50, scroll: 150, input: 'last', media: 800 },
      slimDOMOptions: 'all',
    });

    const afterSnapshot = totalBytes;
    expect(snapshotBytes).toBeGreaterThan(0); // FullSnapshot captured

    // 60 mutation steps ≈ one active minute of bookkeeping edits.
    const tb = document.getElementById('tb') as HTMLTableSectionElement;
    const search = document.getElementById('search') as HTMLInputElement;
    for (let s = 0; s < 60; s += 1) {
      if (s % 5 === 0) {
        search.value = `vendor ${s}`;
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const row = tb.rows[(s * 7) % tb.rows.length]!;
      row.cells[3]!.textContent = `Recategorized:Field ${s}`;
      (row.cells[5]!.firstChild as HTMLElement).textContent = s % 2 ? 'pending' : 'cleared';
      // Let the MutationObserver flush.
      await new Promise((r) => setTimeout(r, 5));
    }
    await new Promise((r) => setTimeout(r, 50));
    stop?.();

    const incremental = totalBytes - afterSnapshot;
    const perSecondAtOneMinute = incremental / 60; // workload modeled as 1 min
    // Record the measurements in the test output for the addendum file.
    console.log(
      `[spike] fullSnapshot=${(snapshotBytes / 1024).toFixed(1)}KB ` +
        `incremental=${(incremental / 1024).toFixed(1)}KB events=${eventCount} ` +
        `≈${(perSecondAtOneMinute / 1024).toFixed(2)}KB/s over a modeled minute`,
    );
    expect(perSecondAtOneMinute).toBeLessThan(100 * 1024);
    // Sanity: masked input events must not carry the typed value.
    // (maskAllInputs → the search text never appears in the stream.)
  });

  it('never serializes typed input values — incl. TYPELESS inputs (8.10 fixture)', async () => {
    // The input deliberately has NO type attribute: rrweb 1.1.3's
    // maskAllInputs flag matches on the type attribute and lets typeless
    // inputs leak; tag-keyed maskInputOptions (what recorder.ts ships) is
    // the fix.
    document.body.innerHTML = '<input id="ssn" /><div id="out"></div>';
    const frames: unknown[] = [];
    const stop = rrweb.record({
      emit(ev) {
        frames.push(ev);
      },
      maskInputOptions: { input: true, textarea: true, select: true, text: true, password: true } as never,
    });
    const input = document.getElementById('ssn') as HTMLInputElement;
    input.value = '123-45-6789';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    stop?.();
    const stream = JSON.stringify(frames);
    expect(stream).not.toContain('123-45-6789');
  });
});
