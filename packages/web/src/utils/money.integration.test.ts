// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, afterEach } from 'vitest';
import { formatMoney, setActiveCurrency, getActiveCurrency } from './money';

describe('money.setActiveCurrency integration', () => {
  // Reset to USD after every test so ordering doesn't leak runtime state.
  afterEach(() => setActiveCurrency('USD'));

  it('defaults to USD', () => {
    expect(getActiveCurrency()).toBe('USD');
    expect(formatMoney('100')).toBe('$100.00');
  });

  it('switches to the configured currency', () => {
    setActiveCurrency('GBP');
    expect(getActiveCurrency()).toBe('GBP');
    // Symbol varies across Node ICU builds; accept either the £ symbol or
    // the ISO code.
    expect(formatMoney('100')).toMatch(/£|GBP/);
    expect(formatMoney('100')).toMatch(/100/);
  });

  it('ignores nullish currency', () => {
    setActiveCurrency('EUR');
    setActiveCurrency(null);
    // Null doesn't reset — getActiveCurrency still returns the last-set value.
    // This matches CompanyProvider's behavior: an unconfigured company falls
    // back to USD at setActiveCurrency('USD') time, not to "null".
    expect(getActiveCurrency()).toBe('EUR');
  });

  it('uppercases the currency code', () => {
    setActiveCurrency('eur');
    expect(getActiveCurrency()).toBe('EUR');
  });
});
