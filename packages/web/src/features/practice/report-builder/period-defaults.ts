// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// F6 — resolve a template's defaultPeriod token into a concrete local
// date range for the new-instance modal. Uses LOCAL dates, matching how
// the modal previously built its month-start → today default.

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export interface PeriodRange {
  start: string;
  end: string;
}

export const DEFAULT_PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'last_quarter', label: 'Last quarter' },
  { value: 'ytd', label: 'Year-to-date' },
  { value: 'last_year', label: 'Last year' },
  { value: 'last_12_months', label: 'Trailing 12 months' },
];

export function resolveDefaultPeriodRange(defaultPeriod: string, now: Date = new Date()): PeriodRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = iso(now);
  switch (defaultPeriod) {
    case 'last_month':
      return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    case 'this_quarter': {
      const qm = Math.floor(m / 3) * 3;
      return { start: iso(new Date(y, qm, 1)), end: today };
    }
    case 'last_quarter': {
      const qm = Math.floor(m / 3) * 3 - 3;
      return { start: iso(new Date(y, qm, 1)), end: iso(new Date(y, qm + 3, 0)) };
    }
    case 'ytd':
      return { start: iso(new Date(y, 0, 1)), end: today };
    case 'last_year':
      return { start: iso(new Date(y - 1, 0, 1)), end: iso(new Date(y - 1, 11, 31)) };
    case 'last_12_months':
      // Whole months: 1st of the month 11 months back → today, matching
      // the 12-month trend-chart window convention.
      return { start: iso(new Date(y, m - 11, 1)), end: today };
    case 'this_month':
    default:
      // Unknown tokens keep the historical modal default.
      return { start: iso(new Date(y, m, 1)), end: today };
  }
}
