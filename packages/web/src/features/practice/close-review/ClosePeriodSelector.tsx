// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ClosePeriod {
  label: string;
  periodStart: string; // ISO, inclusive
  periodEnd: string;   // ISO, exclusive (first ms of next month)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Earliest year offered. Catch-up and cleanup work reaches back years, so
// the picker is not limited to recent months (it used to offer only the
// current month and the three before it).
export const FIRST_CLOSE_YEAR = 2000;

// UTC month boundaries so a tenant in another timezone doesn't see
// off-by-one-day counts at month edges. monthIndex may overflow/underflow;
// Date.UTC normalizes it (month -1 = December of the prior year).
export function periodForMonth(year: number, monthIndex: number, now: Date = new Date()): ClosePeriod {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const isCurrent = start.getUTCFullYear() === now.getUTCFullYear() && start.getUTCMonth() === now.getUTCMonth();
  const base = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  return {
    label: isCurrent ? `${base} (current)` : base,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

// The month normally being closed is the one that just ended, so that is
// the default rather than the still-open current month.
export function defaultClosePeriod(now: Date = new Date()): ClosePeriod {
  return periodForMonth(now.getUTCFullYear(), now.getUTCMonth() - 1, now);
}

function parts(p: ClosePeriod) {
  const d = new Date(p.periodStart);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

interface Props {
  value: ClosePeriod;
  onChange: (next: ClosePeriod) => void;
  now?: Date;
}

export function ClosePeriodSelector({ value, onChange, now = new Date() }: Props) {
  const { year, month } = parts(value);
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth();
  const atLatest = year === curYear && month === curMonth;
  const atEarliest = year === FIRST_CLOSE_YEAR && month === 0;
  const years: number[] = [];
  for (let y = curYear; y >= FIRST_CLOSE_YEAR; y--) years.push(y);

  const go = (y: number, m: number) => {
    // Never move past the current month.
    if (y > curYear || (y === curYear && m > curMonth)) {
      onChange(periodForMonth(curYear, curMonth, now));
      return;
    }
    onChange(periodForMonth(y, m, now));
  };

  const selectCls = 'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm';
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-sm font-medium text-gray-700">Period</span>
      <button type="button" aria-label="Previous month" disabled={atEarliest}
        onClick={() => go(year, month - 1)}
        className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <select aria-label="Close month" className={selectCls} value={month}
        onChange={(e) => go(year, Number(e.target.value))}>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i} disabled={year === curYear && i > curMonth}>{name}</option>
        ))}
      </select>
      <select aria-label="Close year" className={selectCls} value={year}
        onChange={(e) => go(Number(e.target.value), month)}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button type="button" aria-label="Next month" disabled={atLatest}
        onClick={() => go(year, month + 1)}
        className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
        <ChevronRight className="h-4 w-4" />
      </button>
      {atLatest && <span className="ml-1 text-xs text-amber-700">current month, still open</span>}
    </div>
  );
}
