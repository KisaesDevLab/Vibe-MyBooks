// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import type { EstimateResultDTO } from '@kis-books/shared';
import { num } from './format';
import { nextFederalPayment } from './KeyFigures';

export interface CompareRow {
  key: string;
  label: string;
  kind: 'money' | 'rate';
  /** Tax rows show a signed, colored change (minus = lower tax); others show neutral change text. */
  isTax: boolean;
  /** One per compared scenario (formatted later); null = not applicable. */
  values: Array<string | null>;
  notes: Array<string | undefined>;
}

/** Line-by-line comparison rows, read straight from each scenario's engine result. */
export function buildCompareRows(rs: EstimateResultDTO[], today?: Date): CompareRow[] {
  const row = (key: string, label: string, isTax: boolean, pick: (r: EstimateResultDTO) => string | null, note?: (r: EstimateResultDTO) => string | undefined, kind: 'money' | 'rate' = 'money'): CompareRow =>
    ({ key, label, kind, isTax, values: rs.map(pick), notes: rs.map((r) => note?.(r)) });
  return [
    row('income', 'Total income', false, (r) => r.federal.income.totalIncome),
    row('se', 'Self-employment tax', true, (r) => r.federal.seTax),
    row('ret', 'Retirement (SEP / 401(k)) deducted', false, (r) => r.federal.adjustmentsToIncome.retirement,
      (r) => (r.federal.persons.some((p) => p.retirement.capped) ? 'capped at limit' : undefined)),
    row('agi', 'Adjusted gross income', false, (r) => r.federal.agi),
    row('qbi', 'QBI deduction', false, (r) => r.federal.qbi.deduction),
    row('ti', 'Taxable income', false, (r) => r.federal.taxableIncome),
    row('regular', 'Regular tax', true, (r) => r.federal.regularTax.tax),
    row('marginal', 'Marginal federal rate', false, (r) => r.summary.marginalRate, undefined, 'rate'),
    row('fed', 'Federal total', true, (r) => r.summary.federalTotal),
    row('state', 'State total', true, (r) => r.summary.stateTotal),
    row('total', 'Total estimated tax', true, (r) => r.summary.total),
    row('shreq', 'Federal safe harbor: required annual payment', false, (r) => r.summary.federalRequiredAnnualPayment,
      (r) => `rule: ${r.federalEstimates.safeHarbor.appliedRule.replace('_', ' ')}`),
    row('next', 'Next federal payment', false, (r) => nextFederalPayment(r, today)?.catchUpAmount ?? '0',
      (r) => (num(r.federalEstimates.totals.excess) > 0 ? `overpaid ${Math.round(num(r.federalEstimates.totals.excess)).toLocaleString('en-US')}` : undefined)),
  ];
}

/** value - baseline, or null when either side is missing. */
export function deltaOf(base: string | null, v: string | null): number | null {
  if (base == null || v == null) return null;
  return num(v) - num(base);
}
