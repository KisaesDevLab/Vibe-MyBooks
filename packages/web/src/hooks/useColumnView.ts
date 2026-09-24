// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// One state object per table view: which column sorts, which way, and the
// per-column value filters — persisted for the tab session under
// `vibe:<screen>:view` through useSessionState. The same object feeds a
// client-side list (utils/columnView selectRows) or a server-side one
// (viewToQuery), so every page shares one header component either way.
//
// Restored state is sanitised against `sortKeys`: a key from an older build
// is dropped rather than sent to a zod whitelist that would refuse it.
// Pagination offsets are never stored here — a page keeps its own
// `useState(0)` and resets it on `view.signature`.

import { useCallback, useMemo } from 'react';
import { useSessionState } from './useSessionState';
import type { ColumnFilterOption } from '../components/ui/ColumnFilter';
import type { SortableThFilter } from '../components/ui/SortableTh';

export type SortDir = 'asc' | 'desc';

export interface ColumnViewState<K extends string> {
  sortCol: '' | K;
  sortDir: SortDir;
  filters: Partial<Record<K, string[]>>;
}

export interface ColumnView<K extends string> extends ColumnViewState<K> {
  /** Header click: flip if already sorted here, else sort by this column. */
  toggleSort: (col: K) => void;
  /** Popover: sort explicitly. */
  setSort: (col: K, dir: SortDir) => void;
  filterFor: (col: K) => ReadonlySet<string>;
  /** An empty set removes the filter. */
  setFilter: (col: K, selected: ReadonlySet<string>) => void;
  clearFilter: (col: K) => void;
  clearAll: () => void;
  anyFilterActive: boolean;
  /** Changes whenever sort or filters change — key an offset reset on it. */
  signature: string;
  /** Spread onto SortableTh for a sortable column. */
  thProps: (col: K) => {
    sortKey: K; sortBy: '' | K; sortDir: SortDir;
    onSort: (k: K) => void; onSortDir: (k: K, dir: SortDir) => void;
  };
  /** The `filter` prop for SortableTh, bound to this column. */
  filterProps: (col: K, options: ColumnFilterOption[], extra?: Pick<SortableThFilter, 'searchable' | 'sortLabels' | 'ariaLabel'>) => SortableThFilter;
}

export function useColumnView<K extends string>(
  storageKey: `vibe:${string}:view`,
  opts: {
    sortKeys: readonly K[];
    /** null / omitted = the endpoint's default order. */
    defaultSort?: { col: K; dir: SortDir } | null;
    /** Direction a fresh click on a column uses. Default asc. */
    defaultDir?: (col: K) => SortDir;
    defaultFilters?: Partial<Record<K, string[]>>;
  },
): ColumnView<K> {
  const initial: ColumnViewState<K> = {
    sortCol: opts.defaultSort?.col ?? '',
    sortDir: opts.defaultSort?.dir ?? 'desc',
    filters: opts.defaultFilters ?? {},
  };
  const [raw, setRaw] = useSessionState<ColumnViewState<K>>(storageKey, initial);

  // Sanitise once per change: unknown keys (an older build's state) go.
  const state = useMemo<ColumnViewState<K>>(() => {
    const keys = new Set<string>(opts.sortKeys);
    const sortCol = raw?.sortCol && keys.has(raw.sortCol) ? raw.sortCol : '';
    const sortDir: SortDir = raw?.sortDir === 'asc' ? 'asc' : 'desc';
    const filters: Partial<Record<K, string[]>> = {};
    for (const [k, v] of Object.entries(raw?.filters ?? {})) {
      if (keys.has(k) && Array.isArray(v) && v.length > 0) filters[k as K] = v.filter((x): x is string => typeof x === 'string');
    }
    return { sortCol, sortDir, filters };
  }, [raw, opts.sortKeys]);

  const defaultDir = opts.defaultDir;
  const toggleSort = useCallback((col: K) => {
    setRaw((prev) => {
      const cur = prev ?? initial;
      if (cur.sortCol === col) return { ...cur, sortDir: cur.sortDir === 'asc' ? 'desc' : 'asc' };
      return { ...cur, sortCol: col, sortDir: defaultDir ? defaultDir(col) : 'asc' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRaw, defaultDir]);

  const setSort = useCallback((col: K, dir: SortDir) => {
    setRaw((prev) => ({ ...(prev ?? initial), sortCol: col, sortDir: dir }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRaw]);

  const setFilter = useCallback((col: K, selected: ReadonlySet<string>) => {
    setRaw((prev) => {
      const cur = prev ?? initial;
      const filters = { ...cur.filters };
      if (selected.size === 0) delete filters[col]; else filters[col] = [...selected];
      return { ...cur, filters };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRaw]);

  const clearFilter = useCallback((col: K) => setFilter(col, new Set()), [setFilter]);
  const clearAll = useCallback(() => {
    setRaw((prev) => ({ ...(prev ?? initial), filters: {} }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRaw]);

  const filterFor = useCallback((col: K): ReadonlySet<string> => new Set(state.filters[col] ?? []), [state.filters]);
  const anyFilterActive = Object.keys(state.filters).length > 0;
  const signature = JSON.stringify(state);

  const thProps = useCallback((col: K) => ({
    sortKey: col, sortBy: state.sortCol, sortDir: state.sortDir, onSort: toggleSort, onSortDir: setSort,
  }), [state.sortCol, state.sortDir, toggleSort, setSort]);

  const filterProps = useCallback((col: K, options: ColumnFilterOption[], extra?: Pick<SortableThFilter, 'searchable' | 'sortLabels' | 'ariaLabel'>): SortableThFilter => ({
    options,
    selected: filterFor(col),
    onApply: (sel) => setFilter(col, sel),
    ...extra,
  }), [filterFor, setFilter]);

  return {
    ...state,
    toggleSort, setSort, filterFor, setFilter, clearFilter, clearAll,
    anyFilterActive, signature, thProps, filterProps,
  };
}
