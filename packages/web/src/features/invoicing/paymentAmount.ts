// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Exact cents for Record Payment, computed from the decimal strings the API
// returns (balance_due is stored with 4 places). No float math: the engine
// rounds the payment and the invoice's balance to cents half away from zero
// and applies min(amount, balance), so the modal must round the same way or
// a default like 10.005 → "10.00" leaves the invoice partial at $0.00.

const DECIMAL = /^\s*([+-])?(\d*)(?:\.(\d*))?\s*$/;

/** A decimal string as whole cents, rounded half away from zero; null when
 *  it isn't a plain decimal number (empty, letters, exponent). */
export function toCents(value: string | null | undefined): bigint | null {
  if (value == null) return null;
  const m = DECIMAL.exec(value.replace(/,/g, ''));
  if (!m) return null;
  const [, sign, intPart = '', fracPart = ''] = m;
  if (intPart === '' && fracPart === '') return null;
  const frac = fracPart.padEnd(3, '0');
  let cents = BigInt(intPart || '0') * 100n + BigInt(frac.slice(0, 2));
  // Half up (away from zero): the third decimal decides; the rest can only
  // matter at exactly ...5000..., which already rounds up.
  if (Number(frac[2]) >= 5) cents += 1n;
  return sign === '-' ? -cents : cents;
}

/** Whole cents as a plain 2-place string ("-1.05", "0.00"). */
export function centsToString(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${whole.toString()}.${frac}`;
}

/** A decimal string rounded half away from zero to a 2-place string. */
export function roundCents(value: string | null | undefined): string | null {
  const c = toCents(value);
  return c == null ? null : centsToString(c);
}

/**
 * What Record Payment will do with `amount` against a balance: the invoice
 * takes min(amount, balance) and anything above becomes an unapplied credit
 * for the customer. All values are 2-place strings; null when the amount
 * isn't a number yet.
 */
export function splitPayment(amount: string, balance: string): { applied: string; excess: string } | null {
  const a = toCents(amount);
  const b = toCents(balance);
  if (a == null || b == null) return null;
  const payable = b > 0n ? b : 0n;
  const applied = a < payable ? a : payable;
  const excess = a > payable ? a - payable : 0n;
  return { applied: centsToString(applied), excess: centsToString(excess) };
}
