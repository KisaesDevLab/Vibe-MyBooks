// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { AdjustmentCadenceDTO, DeductionMode, HsaCoverage, StateBase } from '@kis-books/shared';

export const CADENCE_LABELS: Record<AdjustmentCadenceDTO, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly (÷3)', annual: 'Annual (spread)', one_time: 'One time',
};
export const DEDUCTION_MODE_LABELS: Record<DeductionMode, string> = {
  auto: 'Automatic (larger of standard / itemized)', standard: 'Force standard', itemized: 'Force itemized',
};
export const HSA_LABELS: Record<HsaCoverage, string> = { self: 'Self-only', family: 'Family', none: 'No HSA' };
export const STATE_BASE_LABELS: Record<StateBase, string> = {
  federal_agi: 'Federal AGI', federal_taxable: 'Federal taxable income', custom: 'Custom amount',
};
export const FULL_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const ITEMIZED_FIELDS = [
  ['saltPaid', 'State and local taxes paid (SALT)'], ['mortgageInterest', 'Mortgage interest'],
  ['charitableCash', 'Charitable (cash)'], ['charitableNoncash', 'Charitable (non-cash)'], ['other', 'Other itemized'],
] as const;
export const SCH1A_FIELDS = [
  ['qualifiedTips', 'Qualified tips'], ['qualifiedOvertime', 'Qualified overtime'], ['carLoanInterest', 'Car loan interest'],
] as const;

export const fmtMoney = (n: number | string): string =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** QA D31: a stored decimal(19,4) string as an editable value ("8000.0000" → "8000", "150.5000" → "150.5"). */
export function plainDecimal(v: string | null | undefined): string {
  if (v == null) return '';
  const t = String(v).trim();
  return /^-?\d+\.\d+$/.test(t) ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
}
