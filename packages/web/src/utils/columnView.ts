// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Pure helpers around a ColumnView (see hooks/useColumnView): apply it to a
// loaded array (client-side lists that hold every row), or turn it into
// query params for a server-side list (which must sort in SQL — the page
// paginates, so sorting the visible page alone would lie).

import type { ColumnFilterOption } from '../components/ui/ColumnFilter';

export interface ViewLike<K extends string> {
  sortCol: '' | K;
  sortDir: 'asc' | 'desc';
  filters: Partial<Record<K, string[]>>;
}

export interface SelectRowsConfig<T, K extends string> {
  /** How to read each filterable column's value off a row. */
  filterValue?: Partial<Record<K, (row: T) => string | null | undefined>>;
  /** How to read each sortable column's value off a row (string or number). */
  sortValue?: Partial<Record<K, (row: T) => string | number | null | undefined>>;
}

/** Filter, then sort, a fully loaded list. Stable for equal keys. */
export function selectRows<T, K extends string>(rows: T[], view: ViewLike<K>, cfg: SelectRowsConfig<T, K>): T[] {
  let out = rows;
  for (const [col, values] of Object.entries(view.filters) as Array<[K, string[] | undefined]>) {
    const read = cfg.filterValue?.[col];
    if (!read || !values || values.length === 0) continue;
    const allowed = new Set(values);
    out = out.filter((r) => allowed.has(read(r) ?? ''));
  }
  const readSort = view.sortCol ? cfg.sortValue?.[view.sortCol] : undefined;
  if (readSort) {
    const dir = view.sortDir === 'asc' ? 1 : -1;
    out = out.map((r, i) => ({ r, i })).sort((a, b) => {
      const av = readSort(a.r);
      const bv = readSort(b.r);
      const cmp = compareValues(av, bv);
      return cmp !== 0 ? cmp * dir : a.i - b.i;
    }).map((x) => x.r);
  }
  return out;
}

// Null/undefined sort last regardless of direction; numbers numerically,
// everything else as text.
function compareValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const aNull = a === null || a === undefined || a === '';
  const bNull = b === null || b === undefined || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Query params for a server-side list: `sortBy`/`sortDir` (only when a
 * column is sorted) plus one comma-joined IN-set param per filtered column,
 * named by `filterMap` (a column with no mapping is not sent).
 */
export function viewToQuery<K extends string>(
  view: ViewLike<K>,
  maps: { sortMap?: Partial<Record<K, string>>; filterMap?: Partial<Record<K, string>> } = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  if (view.sortCol) {
    out['sortBy'] = maps.sortMap?.[view.sortCol] ?? view.sortCol;
    out['sortDir'] = view.sortDir;
  }
  for (const [col, values] of Object.entries(view.filters) as Array<[K, string[] | undefined]>) {
    if (!values || values.length === 0) continue;
    const param = maps.filterMap?.[col];
    if (param) out[param] = values.join(',');
  }
  return out;
}

/** Distinct non-empty values as options, sorted by label. */
export function distinctOptions(values: Array<string | null | undefined>, labelFor?: (v: string) => string): ColumnFilterOption[] {
  const seen = new Set<string>();
  for (const v of values) if (v) seen.add(v);
  return [...seen]
    .map((v) => ({ value: v, label: labelFor ? labelFor(v) : v }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * A two-valued filter (active/inactive, yes/no) into the single boolean
 * param an existing endpoint takes: one value picked → that boolean, both
 * or neither → undefined (no filter).
 */
export function booleanSetToParam(
  set: ReadonlySet<string>,
  values: { trueValue: string; falseValue: string },
): boolean | undefined {
  const t = set.has(values.trueValue);
  const f = set.has(values.falseValue);
  if (t === f) return undefined;
  return t;
}
