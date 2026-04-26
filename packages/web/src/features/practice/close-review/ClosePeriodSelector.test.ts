// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { buildClosePeriods } from './ClosePeriodSelector';

describe('buildClosePeriods', () => {
  it('returns 4 periods with current month first', () => {
    const now = new Date(Date.UTC(2026, 3, 15)); // April 15 2026
    const periods = buildClosePeriods(now);
    expect(periods).toHaveLength(4);
    expect(periods[0]?.label).toBe('April 2026 (current)');
    expect(periods[1]?.label).toBe('March 2026');
    expect(periods[2]?.label).toBe('February 2026');
    expect(periods[3]?.label).toBe('January 2026');
  });

  it('handles year boundaries correctly', () => {
    const now = new Date(Date.UTC(2026, 1, 10)); // February 2026
    const periods = buildClosePeriods(now);
    expect(periods[2]?.label).toBe('December 2025');
    expect(periods[3]?.label).toBe('November 2025');
  });

  it('periodStart is first ms of month, periodEnd is first ms of next month', () => {
    const now = new Date(Date.UTC(2026, 3, 15));
    const periods = buildClosePeriods(now);
    const april = periods[0]!;
    expect(april.periodStart).toBe('2026-04-01T00:00:00.000Z');
    expect(april.periodEnd).toBe('2026-05-01T00:00:00.000Z');
  });
});
