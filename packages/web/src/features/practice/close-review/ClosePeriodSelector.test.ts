// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { defaultClosePeriod, periodForMonth } from './ClosePeriodSelector';

describe('close period helpers', () => {
  it('defaults to the month that just ended', () => {
    const now = new Date(Date.UTC(2026, 3, 15)); // April 15 2026
    const p = defaultClosePeriod(now);
    expect(p.label).toBe('March 2026');
    expect(p.periodStart).toBe('2026-03-01T00:00:00.000Z');
    expect(p.periodEnd).toBe('2026-04-01T00:00:00.000Z');
  });

  it('crosses the year boundary', () => {
    const now = new Date(Date.UTC(2026, 0, 10)); // January 2026
    expect(defaultClosePeriod(now).label).toBe('December 2025');
  });

  it('reaches any earlier month, not just the last four', () => {
    const now = new Date(Date.UTC(2026, 8, 25));
    const p = periodForMonth(2022, 6, now);
    expect(p.label).toBe('July 2022');
    expect(p.periodStart).toBe('2022-07-01T00:00:00.000Z');
    expect(p.periodEnd).toBe('2022-08-01T00:00:00.000Z');
  });

  it('marks the current month', () => {
    const now = new Date(Date.UTC(2026, 8, 25));
    expect(periodForMonth(2026, 8, now).label).toBe('September 2026 (current)');
  });
});
