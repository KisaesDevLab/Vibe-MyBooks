// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Local-date helpers. The codebase historically used
// `new Date().toISOString().split('T')[0]` to mean "today" — that returns
// the **UTC** date, so a user in PST at 10pm typing a new invoice stamped
// it with tomorrow's UTC date, pushing the transaction across month / quarter
// / year boundaries from the user's perspective. These helpers format in
// the *browser's local* timezone.

/**
 * Today's date in the browser's local timezone, as YYYY-MM-DD.
 * Equivalent to `new Date().toLocaleDateString('sv-SE')` but without
 * relying on the Swedish locale trick.
 */
export function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

/**
 * Convert a `Date` to YYYY-MM-DD in the browser's local timezone.
 * Replaces `d.toISOString().split('T')[0]` for any value that represents
 * a calendar day (txn date, due date) rather than an instant.
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The fiscal year window (start/end, inclusive) containing `onDate`
 * (defaults to local today) for a company whose fiscal year starts in
 * `fyStartMonth` (1-based). July start → Jul 1 .. Jun 30.
 */
export function fiscalYearRange(fyStartMonth: number, onDate?: string): { start: string; end: string } {
  const today = onDate ?? todayLocalISO();
  const y = parseInt(today.slice(0, 4), 10);
  const m = parseInt(today.slice(5, 7), 10);
  const startYear = m < fyStartMonth ? y - 1 : y;
  const start = `${startYear}-${String(fyStartMonth).padStart(2, '0')}-01`;
  // Last day before the next fiscal start.
  const endD = new Date(Date.UTC(startYear + 1, fyStartMonth - 1, 0));
  const end = endD.toISOString().split('T')[0]!;
  return { start, end };
}

/** Month labels rotated to a fiscal start (e.g. 7 → Jul, Aug, … Jun). */
export function fiscalMonthLabels(fyStartMonth: number): string[] {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = Math.min(Math.max(fyStartMonth || 1, 1), 12) - 1;
  return [...names.slice(s), ...names.slice(0, s)];
}
