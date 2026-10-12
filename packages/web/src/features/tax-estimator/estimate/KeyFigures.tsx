// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { EstimateResultDTO } from '@kis-books/shared';
import { daysUntil, dollars, fmtDate, num, pct } from './format';

const toIsoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  // QA D13: "to date" means as of today — a payment booked with a later date is scheduled, not paid.
  const todayIso = toIsoDay(today ?? new Date());
  const later = r.payments.filter((p) => p.date != null && p.date > todayIso);
  const scheduledIn = (j: (x: string) => boolean) => later.filter((p) => j(p.jurisdiction)).reduce((a, p) => a + num(p.amount), 0);
  const scheduled = later.reduce((a, p) => a + num(p.amount), 0);
  // QA2-05: the sub-line parts add up to the headline (federal estimates as of today, federal
  // withholding, state estimates as of today + state withholding).
  const stateCodes = new Set(r.stateEstimates.map((e) => e.jurisdiction));
  const fedEstimates = Math.max(0, num(fed.estimatesPaid) - scheduledIn((j) => j === 'federal'));
  const fedWithholding = num(fed.withholding);
  const state = Math.max(0, r.stateEstimates.reduce((a, e) => a + num(e.totals.estimatesPaid) + num(e.totals.withholding), 0) - scheduledIn((j) => stateCodes.has(j)));
  const paid = fedEstimates + fedWithholding + state;
  const next = nextFederalPayment(r, today);
  const days = next ? daysUntil(next.dueDate, today) : 0;
  const income = num(r.federal.income.totalIncome);
  const effective = income > 0 ? num(r.summary.federalTotal) / income : 0;
  return (
    <section aria-label="Key figures" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Tile label={`Projected ${r.taxYear} total tax`} value={dollars(r.summary.total)} sub={`Federal ${dollars(r.summary.federalTotal)} · State ${dollars(r.summary.stateTotal)}`} />
      <Tile label="Paid & withheld to date" value={dollars(paid)} sub={`Federal estimates ${dollars(fedEstimates)} · federal withholding ${dollars(fedWithholding)}${state > 0 ? ` · state ${dollars(state)}` : ''}${scheduled > 0 ? ` · ${dollars(scheduled)} dated after today not included` : ''}`} />
      <Tile label="Next federal payment" value={next ? dollars(next.catchUpAmount) : dollars(0)}
        sub={next ? `Due ${fmtDate(next.dueDate)} · ${days >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} overdue`}` : 'No federal payment due'} />
      <Tile label="Marginal federal rate" value={pct(r.summary.marginalRate, 0)} sub={`Overall effective ${pct(effective)} of ${dollars(r.federal.income.totalIncome)}`} />
    </section>
  );
}
