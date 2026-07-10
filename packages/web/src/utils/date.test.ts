// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { toLocalISODate, todayLocalISO, dateShortcut } from './date';

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

describe('dateShortcut', () => {
  // Thu 2026-03-12 is a Thursday (getDay() === 4).
  const D = '2026-03-12';

  it('t returns today', () => {
    expect(dateShortcut('t', D)).toBe(todayLocalISO());
    expect(dateShortcut('T', '')).toBe(todayLocalISO());
  });

  it('+ / = advance a day, - / _ go back a day', () => {
    expect(dateShortcut('+', D)).toBe('2026-03-13');
    expect(dateShortcut('=', D)).toBe('2026-03-13');
    expect(dateShortcut('-', D)).toBe('2026-03-11');
    expect(dateShortcut('_', D)).toBe('2026-03-11');
  });

  it('+ across a month boundary rolls over', () => {
    expect(dateShortcut('+', '2026-03-31')).toBe('2026-04-01');
    expect(dateShortcut('-', '2026-03-01')).toBe('2026-02-28');
  });

  it('w / k jump to start / end of week (Sun–Sat)', () => {
    expect(dateShortcut('w', D)).toBe('2026-03-08'); // Sunday
    expect(dateShortcut('k', D)).toBe('2026-03-14'); // Saturday
  });

  it('m / h jump to start / end of month', () => {
    expect(dateShortcut('m', D)).toBe('2026-03-01');
    expect(dateShortcut('h', D)).toBe('2026-03-31');
    expect(dateShortcut('h', '2026-02-15')).toBe('2026-02-28'); // non-leap Feb
  });

  it('y / r jump to start / end of year', () => {
    expect(dateShortcut('y', D)).toBe('2026-01-01');
    expect(dateShortcut('r', D)).toBe('2026-12-31');
  });

  it('returns null for non-shortcut keys', () => {
    expect(dateShortcut('a', D)).toBeNull();
    expect(dateShortcut('Enter', D)).toBeNull();
    expect(dateShortcut('5', D)).toBeNull();
  });

  it('starts from today when the field is empty', () => {
    // +1 day from today, computed the same way the helper does.
    const t = new Date();
    t.setDate(t.getDate() + 1);
    expect(dateShortcut('+', '')).toBe(toLocalISODate(t));
  });
});
