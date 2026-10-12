// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { EstimateResultDTO } from '@kis-books/shared';
import { daysUntil, dollars, fmtDate, num, pct } from './format';

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="text-2xl sm:text-3xl font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="text-sm text-gray-500">{sub}</div>
    </div>
  );
}

/** The first unpaid federal installment: due on/after today, else the earliest unpaid one. */
export function nextFederalPayment(r: EstimateResultDTO, today: Date = new Date()) {
  const unpaid = r.federalEstimates.installments.filter((i) => i.status === 'unpaid');
  return unpaid.find((i) => daysUntil(i.dueDate, today) >= 0) ?? unpaid[0] ?? null;
}

export function KeyFigures({ estimate: r, today }: { estimate: EstimateResultDTO; today?: Date }) {
  const fed = r.federalEstimates.totals;
  const state = r.stateEstimates.reduce((a, e) => a + num(e.totals.estimatesPaid) + num(e.totals.withholding), 0);
  const paid = num(fed.estimatesPaid) + num(fed.withholding) + state;
  const next = nextFederalPayment(r, today);
  const days = next ? daysUntil(next.dueDate, today) : 0;
  const income = num(r.federal.income.totalIncome);
  const effective = income > 0 ? num(r.summary.federalTotal) / income : 0;
  return (
    <section aria-label="Key figures" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Tile label={`Projected ${r.taxYear} total tax`} value={dollars(r.summary.total)} sub={`Federal ${dollars(r.summary.federalTotal)} · State ${dollars(r.summary.stateTotal)}`} />
      <Tile label="Paid & withheld to date" value={dollars(paid)} sub={`Federal estimates ${dollars(fed.estimatesPaid)} · withholding ${dollars(fed.withholding)}`} />
      <Tile label="Next federal payment" value={next ? dollars(next.catchUpAmount) : dollars(0)}
        sub={next ? `Due ${fmtDate(next.dueDate)} · ${days >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} overdue`}` : 'No federal payment due'} />
      <Tile label="Marginal federal rate" value={pct(r.summary.marginalRate, 0)} sub={`Overall effective ${pct(effective)} of ${dollars(r.federal.income.totalIncome)}`} />
    </section>
  );
}
