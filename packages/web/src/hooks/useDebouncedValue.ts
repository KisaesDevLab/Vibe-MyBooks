// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after the value
 * has been stable for `delayMs` (default 400ms).
 *
 * Pattern for search/date inputs that feed a React Query key: keep the
 * input controlled by the RAW state (typing stays responsive), pass the
 * DEBOUNCED value into the query key so the request fires only after
 * the user pauses — not on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounce specialized for native date inputs (`<input type="date">`),
 * which fire a change event per SEGMENT while the user is still typing
 * (year "0002" → "0020" → "2026"). In addition to the debounce, the
 * debounced value only advances when the candidate is a COMPLETE valid
 * calendar date (YYYY-MM-DD with a plausible year); partial values keep
 * the last good date so queries never fire for year 0002.
 */
export function useDebouncedDate(value: string, delayMs = 400): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // '' is a deliberate "no filter" (cleared input) and passes through;
    // partial values keep the last good date while the user types.
    if (value !== '' && !isCompleteDate(value)) return;
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

/** A complete, plausible YYYY-MM-DD calendar day (year 1900-2200). */
export function isCompleteDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = parseInt(value.slice(0, 4), 10);
  if (year < 1900 || year > 2200) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
