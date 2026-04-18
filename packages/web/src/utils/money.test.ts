// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyWith, formatAmount, toNumber } from './money';

describe('formatMoney', () => {
  it('formats a string amount as USD', () => {
    expect(formatMoney('1234.56')).toBe('$1,234.56');
  });

  it('rounds server-side 4-decimal values to 2 for display', () => {
    expect(formatMoney('1234.5678')).toBe('$1,234.57');
  });

  it('handles null/undefined as zero', () => {
    expect(formatMoney(null)).toBe('$0.00');
    expect(formatMoney(undefined)).toBe('$0.00');
  });

  it('handles non-numeric strings as zero', () => {
    expect(formatMoney('not-a-number')).toBe('$0.00');
  });
});

describe('formatMoneyWith', () => {
  it('respects custom currency', () => {
    // EUR uses € symbol; allow either the symbol or the ISO code since locale
    // data varies slightly across Node versions.
    const out = formatMoneyWith('100', { currency: 'EUR' });
    expect(out).toMatch(/100/);
    expect(out).toMatch(/€|EUR/);
  });

  it('respects custom decimals', () => {
    expect(formatMoneyWith('1.5', { decimals: 4 })).toBe('$1.5000');
  });
});

describe('formatAmount', () => {
  it('has no currency prefix', () => {
    expect(formatAmount('42')).toBe('42.00');
  });
});

describe('toNumber', () => {
  it('returns 0 for non-finite input', () => {
    expect(toNumber('Infinity')).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });
});
