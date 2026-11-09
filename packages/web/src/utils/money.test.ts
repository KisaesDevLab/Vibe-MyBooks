// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyWith, formatAmount, toNumber, isExactZero, exactToCents, formatExactMoney, exactAbs } from './money';

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

describe('exact decimal strings', () => {
  it('isExactZero is true only for exact zero', () => {
    expect(isExactZero('0')).toBe(true);
    expect(isExactZero('0.0000')).toBe(true);
    expect(isExactZero('-0.00')).toBe(true);
    expect(isExactZero('0.0040')).toBe(false);
    expect(isExactZero('-0.0001')).toBe(false);
    expect(isExactZero('12.00')).toBe(false);
    expect(isExactZero(null)).toBe(false);
    expect(isExactZero('abc')).toBe(false);
  });

  it('exactToCents rounds half away from zero without floats', () => {
    expect(exactToCents('1234.5650')).toBe('1234.57');
    expect(exactToCents('-1234.5650')).toBe('-1234.57');
    expect(exactToCents('0.0040')).toBe('0.00');
    expect(exactToCents('-0.0040')).toBe('0.00');
    expect(exactToCents('0.0050')).toBe('0.01');
    expect(exactToCents('5')).toBe('5.00');
    expect(exactToCents('90071992547409.9950')).toBe('90071992547410.00');
    expect(exactToCents('x')).toBeNull();
  });

  it('formatExactMoney groups thousands and signs', () => {
    expect(formatExactMoney('1234567.8900')).toBe('$1,234,567.89');
    expect(formatExactMoney('-25.5000')).toBe('-$25.50');
    expect(formatExactMoney(undefined)).toBe('—');
    expect(exactAbs('-12.3400')).toBe('12.3400');
  });
});
