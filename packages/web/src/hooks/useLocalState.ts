// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Like useSessionState, but backed by localStorage so the preference persists
 * across tabs, reloads, and sessions — for durable global display preferences
 * (e.g. "show account numbers on reports") rather than per-tab screen filters.
 *
 * - Keys are namespaced: `vibe:<area>:<field>` — pass the full key.
 * - JSON-serialized; lazy-initialized from storage with the provided default.
 * - Resilient: parse/quota errors and storage being disabled degrade to plain
 *   useState behavior.
 */
export function useLocalState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
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
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* quota exceeded / storage disabled — state still updates in memory */
      }
      return resolved;
    });
  }, [key]);

  return [value, set];
}

// Shared key for the "show account numbers on financial reports" preference so
// P&L, Balance Sheet, and General Ledger stay in sync. Default: show.
export const SHOW_ACCT_NUMBERS_KEY = 'vibe:reports:showAcctNumbers';
