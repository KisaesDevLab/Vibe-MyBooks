// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Money formatting utilities.
//
// The server represents money as `decimal(19,4)` (a string in JSON,
// e.g. "1234.5600"). The UI historically rendered those values with
// `parseFloat(x).toFixed(2)`, which works for ordinary amounts but
// silently rounds "0.0050" → "0.01" and discards the fourth decimal
// for anything that uses it (tax rates, per-line tax amounts). Use
// these helpers instead so display behaviour is consistent and the
// original precision is preserved when needed.
//
// Implementation note: the UI doesn't need full arbitrary-precision
// arithmetic to *display* values that the server already produced at
// 4-decimal precision. `Number(str).toFixed(2)` is fine for
// formatting — the bug is arithmetic on numbers. These helpers only
// format; any UI-side arithmetic should import `decimal.js` directly.

export type MoneyInput = string | number | null | undefined;

function toNum(v: MoneyInput): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format as USD with 2 decimal places and thousands separators,
 * e.g. `formatMoney("1234.5678") === "$1,234.57"`.
 */
export function formatMoney(v: MoneyInput): string {
  return toNum(v).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Like `formatMoney` but with configurable decimals + currency.
 */
export function formatMoneyWith(
  v: MoneyInput,
  options: { currency?: string; decimals?: number } = {},
): string {
  const { currency = 'USD', decimals = 2 } = options;
  return toNum(v).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Raw numeric value (no `$`), always 2 decimals. Useful inside table
 * cells that already have their own column prefix, e.g. `Balance: 123.45`.
 */
export function formatAmount(v: MoneyInput, decimals = 2): string {
  return toNum(v).toFixed(decimals);
}

/**
 * Parse a money-input into a plain number. Prefer `formatMoney` for
 * display; `toNumber` is for legitimate arithmetic cases (e.g. sorting
 * table rows by total).
 */
export function toNumber(v: MoneyInput): number {
  return toNum(v);
}
