// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { roundCents, splitPayment, toCents } from './paymentAmount';

describe('roundCents (half away from zero, like the engine)', () => {
  it('rounds a 4-place balance up at the half cent, where float toFixed(2) went down', () => {
    expect(roundCents('10.0050')).toBe('10.01');
    expect(roundCents('10.005')).toBe('10.01');
    expect(roundCents('1.005')).toBe('1.01'); // float: (1.005).toFixed(2) === '1.00'
  });

  it('keeps exact cents and pads', () => {
    expect(roundCents('50')).toBe('50.00');
    expect(roundCents('50.1')).toBe('50.10');
    expect(roundCents('0.0049')).toBe('0.00');
    expect(roundCents('1234567.8949')).toBe('1234567.89');
    expect(roundCents('.995')).toBe('1.00');
  });

  it('rounds negatives away from zero', () => {
    expect(roundCents('-10.005')).toBe('-10.01');
    expect(roundCents('-0.004')).toBe('0.00');
  });

  it('rejects what is not a plain decimal', () => {
    expect(toCents('')).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(toCents('1e3')).toBeNull();
    expect(toCents(null)).toBeNull();
  });
});

describe('splitPayment', () => {
  it('applies up to the balance and turns the rest into a credit', () => {
    expect(splitPayment('60', '50.00')).toEqual({ applied: '50.00', excess: '10.00' });
    expect(splitPayment('50.00', '50.00')).toEqual({ applied: '50.00', excess: '0.00' });
    expect(splitPayment('20', '50.00')).toEqual({ applied: '20.00', excess: '0.00' });
  });

  it('a paid or negative balance takes nothing', () => {
    expect(splitPayment('5', '0.00')).toEqual({ applied: '0.00', excess: '5.00' });
    expect(splitPayment('5', '-3.00')).toEqual({ applied: '0.00', excess: '5.00' });
  });

  it('is null while the amount is not a number', () => {
    expect(splitPayment('', '50.00')).toBeNull();
  });
});
