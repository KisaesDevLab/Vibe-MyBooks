// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

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

// Active currency for the current session. CompanyProvider updates this on
// login and on company switch via setActiveCurrency(). Default is USD because
// the appliance ships US-first, but any non-US operator now sees their
// company.currency rendered without having to thread a currency prop through
// every call site.
let ACTIVE_CURRENCY = 'USD';
let ACTIVE_LOCALE = 'en-US';

export function setActiveCurrency(currency: string | null | undefined, locale?: string): void {
  if (currency) ACTIVE_CURRENCY = currency.toUpperCase();
  if (locale) ACTIVE_LOCALE = locale;
}

export function getActiveCurrency(): string {
  return ACTIVE_CURRENCY;
}

function toNum(v: MoneyInput): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format using the session's active currency with 2 decimal places and
 * thousands separators, e.g. `formatMoney("1234.5678") === "$1,234.57"`.
 * Falls back to USD when the company hasn't set a currency yet.
 */
export function formatMoney(v: MoneyInput): string {
  return toNum(v).toLocaleString(ACTIVE_LOCALE, {
    style: 'currency',
    currency: ACTIVE_CURRENCY,
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
  const { currency = ACTIVE_CURRENCY, decimals = 2 } = options;
  return toNum(v).toLocaleString(ACTIVE_LOCALE, {
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

// ─── Exact decimal strings (no floating point) ─────────────────────
//
// Some engine responses carry money as exact decimal strings meant for
// decisions, not just display (e.g. a reconciliation's `differenceExact`
// "0.0040": it may only be finished at exactly zero). These helpers never
// go through a JS number, so "0.0040" is never mistaken for zero.

const EXACT_DECIMAL = /^([+-])?(\d+)(?:\.(\d+))?$/;

/** True only for a well-formed decimal string equal to exactly zero ("0", "-0.0000"). */
export function isExactZero(v: string | null | undefined): boolean {
  if (v == null) return false;
  const m = EXACT_DECIMAL.exec(v.trim());
  if (!m) return false;
  return /^0+$/.test(m[2]!) && /^0*$/.test(m[3] ?? '');
}

/**
 * An exact decimal string rounded half away from zero to cents, as a
 * signed plain string ("-1234.5650" → "-1234.57"). Returns null for a
 * malformed value. Uses BigInt, never a JS number.
 */
export function exactToCents(v: string | null | undefined): string | null {
  if (v == null) return null;
  const m = EXACT_DECIMAL.exec(v.trim());
  if (!m) return null;
  const negative = m[1] === '-';
  const frac = m[3] ?? '';
  const places = Math.max(frac.length, 2);
  const scaled = BigInt(m[2]! + frac.padEnd(places, '0'));
  const divisor = 10n ** BigInt(places - 2);
  let cents = scaled / divisor;
  if (divisor > 1n && (scaled % divisor) * 2n >= divisor) cents += 1n;
  const digits = cents.toString().padStart(3, '0');
  const out = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
  return negative && cents !== 0n ? `-${out}` : out;
}

/** `exactToCents` as "$1,234.57" / "-$1,234.57" (thousands separators, no float). */
export function formatExactMoney(v: string | null | undefined): string {
  const cents = exactToCents(v);
  if (cents == null) return '—';
  const negative = cents.startsWith('-');
  const [int, frac] = (negative ? cents.slice(1) : cents).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${frac}`;
}

/** The value without its sign ("-12.3400" → "12.3400"); null passes through. */
export function exactAbs(v: string | null | undefined): string | null | undefined {
  return v == null ? v : v.trim().replace(/^[+-]/, '');
}
