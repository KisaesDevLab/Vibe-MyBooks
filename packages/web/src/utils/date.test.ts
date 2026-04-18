// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { toLocalISODate, todayLocalISO } from './date';

describe('toLocalISODate', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    // Construct a Date using local-time components so the test is stable
    // regardless of which TZ the CI runs in. Jan 5 2026, 10 PM local.
    const d = new Date(2026, 0, 5, 22, 0, 0);
    expect(toLocalISODate(d)).toBe('2026-01-05');
  });

  it('pads month and day to two digits', () => {
    const d = new Date(2026, 2, 9); // March 9
    expect(toLocalISODate(d)).toBe('2026-03-09');
  });

  it('does not skew across a UTC midnight when local time is earlier', () => {
    // Dec 31 23:59 local — UTC would have already advanced to Jan 1 for
    // positive offsets, so an ISO string would return the wrong calendar day.
    const d = new Date(2026, 11, 31, 23, 59);
    expect(toLocalISODate(d)).toBe('2026-12-31');
  });
});

describe('todayLocalISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    const out = todayLocalISO();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
