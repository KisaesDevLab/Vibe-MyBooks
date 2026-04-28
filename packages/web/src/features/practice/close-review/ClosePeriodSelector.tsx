// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo } from 'react';

export interface ClosePeriod {
  label: string;
  periodStart: string; // ISO, inclusive
  periodEnd: string;   // ISO, exclusive (first ms of next month)
}

// Produces the four period options the Close Review surface offers:
// the current calendar month plus the three prior months. UTC is
// used for the boundaries so a tenant in a different timezone
// doesn't see off-by-one-day bucket counts at month boundaries.
export function buildClosePeriods(now: Date = new Date()): ClosePeriod[] {
  const periods: ClosePeriod[] = [];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  for (let i = 0; i < 4; i++) {
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth() - i;
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1));
    const base = `${monthNames[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
    const label = i === 0 ? `${base} (current)` : base;
    periods.push({
      label,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    });
  }
  return periods;
}

interface Props {
  value: ClosePeriod;
  onChange: (next: ClosePeriod) => void;
}

export function ClosePeriodSelector({ value, onChange }: Props) {
  const periods = useMemo(() => buildClosePeriods(), []);
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Period</span>
      <select
        value={value.periodStart}
        onChange={(e) => {
          const next = periods.find((p) => p.periodStart === e.target.value);
          if (next) onChange(next);
        }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
      >
        {periods.map((p) => (
          <option key={p.periodStart} value={p.periodStart}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
