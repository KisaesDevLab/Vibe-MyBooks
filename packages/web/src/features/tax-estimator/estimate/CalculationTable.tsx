// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { EstimateResultDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { buildCalcSections, type CalcLine, type TraceScope } from './calcLines';
import { dollars, dollarsOrDash } from './format';
import { traceRowsFor } from './traceRows';
import { TraceDrawer } from './TraceDrawer';
import { TableScroll } from '../../../components/ui/TableScroll';

const CHIP: Record<'warn' | 'info', string> = { warn: 'bg-amber-100 text-amber-900', info: 'bg-blue-50 text-blue-800' };

export function CalculationTable({ estimate }: { estimate: EstimateResultDTO }) {
  const [open, setOpen] = useState<{ title: string; scope: TraceScope } | null>(null);
  const sections = buildCalcSections(estimate);
  const lineRow = (l: CalcLine) => (
    <tr key={l.key} className={l.bold ? 'bg-gray-50 font-semibold' : undefined}>
      <td className={`${l.indent ? 'pl-10 pr-4' : 'px-4'} py-2 align-baseline`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={l.muted ? 'text-gray-600' : 'text-gray-900'}>{l.label}</span>
          {l.chips?.map((c) => <span key={c.text} className={`rounded px-1.5 py-0.5 text-xs font-medium ${CHIP[c.tone]}`}>{c.text}</span>)}
          {l.trace && (
            <Button size="sm" variant="ghost" aria-label={`Trace ${l.label}`} onClick={() => setOpen({ title: l.label, scope: l.trace! })}>Trace</Button>
          )}
        </div>
        {l.sub && <div className="text-xs font-normal text-gray-500">{l.sub}</div>}
      </td>
      <td className={`px-4 py-2 text-right tabular-nums align-baseline ${l.muted ? 'text-gray-500 italic' : 'text-gray-700'}`}>{l.ytd == null ? '' : dollars(l.ytd)}</td>
      <td className={`px-4 py-2 text-right tabular-nums align-baseline ${l.muted ? 'text-gray-500 italic' : 'text-gray-900'}`}>{dollarsOrDash(l.projected)}</td>
    </tr>
  );
  return (
    <section aria-label="Calculation" className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Calculation</h2>
        <span className="ml-auto text-sm text-gray-500">Select Trace on a line to see how it was computed</span>
      </div>
      <TableScroll className="border-0 shadow-none rounded-none">
        <table className="min-w-[36rem] w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-4 py-2 text-left font-semibold">Line</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">YTD tax basis</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">{estimate.taxYear} projected</th>
            </tr>
          </thead>
          {sections.map((s) => (
            <tbody key={s.key} className="divide-y divide-gray-100">
              <tr><th scope="rowgroup" colSpan={3} className="px-4 pt-3 pb-1 text-left text-sm font-semibold text-primary-700">{s.title}</th></tr>
              {s.lines.map(lineRow)}
            </tbody>
          ))}
        </table>
      </TableScroll>
      {open && <TraceDrawer title={open.title} rows={traceRowsFor(estimate, open.scope)} onClose={() => setOpen(null)} />}
    </section>
  );
}
