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
