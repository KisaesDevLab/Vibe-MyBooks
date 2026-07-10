// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Like useState, but mirrored to sessionStorage so screen selection
 * criteria (date ranges, filters, toggles) survive an in-tab refresh or
 * route round-trip without the user re-entering them every time.
 *
 * - Keys are namespaced: `vibe:<screen>:<field>` — pass the full key.
 * - JSON-serialized; lazy-initialized from storage with the provided
 *   default as fallback.
 * - sessionStorage (per-tab session), NOT localStorage — two tabs keep
 *   independent criteria and everything resets when the tab closes.
 * - Resilient: parse errors, quota errors, and storage being disabled
 *   (Safari private mode) all degrade to plain useState behavior.
 *
 * Use for user-chosen filter state only — do not persist pagination
 * offsets or transient UI (modals, expanded rows).
 */
export function useSessionState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* corrupted entry or storage unavailable — fall through */
    }
    return defaultValue;
  });

  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try {
        window.sessionStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* quota exceeded / storage disabled — state still updates in memory */
      }
      return resolved;
    });
  }, [key]);

  return [value, set];
}
