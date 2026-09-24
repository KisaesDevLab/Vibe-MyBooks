// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { booleanSetToParam, distinctOptions, selectRows, viewToQuery } from './columnView';

type Row = { name: string; amount: number; status: string | null };
type K = 'name' | 'amount' | 'status';
const rows: Row[] = [
  { name: 'beta', amount: 10, status: 'paid' },
  { name: 'Alpha', amount: 200, status: null },
  { name: 'gamma', amount: 5, status: 'unpaid' },
  { name: 'alpha 2', amount: 5, status: 'paid' },
];
const cfg = {
  filterValue: { status: (r: Row) => r.status },
  sortValue: { name: (r: Row) => r.name, amount: (r: Row) => r.amount },
};

describe('selectRows', () => {
  it('sorts text case-insensitively and numbers numerically, stable on ties, nulls last', () => {
    expect(selectRows(rows, { sortCol: 'name' as K, sortDir: 'asc', filters: {} }, cfg).map((r) => r.name))
      .toEqual(['Alpha', 'alpha 2', 'beta', 'gamma']);
    expect(selectRows(rows, { sortCol: 'amount' as K, sortDir: 'asc', filters: {} }, cfg).map((r) => r.name))
      .toEqual(['gamma', 'alpha 2', 'beta', 'Alpha']);
    expect(selectRows(rows, { sortCol: 'amount' as K, sortDir: 'desc', filters: {} }, cfg).map((r) => r.name))
      .toEqual(['Alpha', 'beta', 'gamma', 'alpha 2']);
  });

  it('filters by an IN-set on the mapped column', () => {
    const out = selectRows<Row, K>(rows, { sortCol: '', sortDir: 'desc', filters: { status: ['paid'] } }, cfg);
    expect(out.map((r) => r.name)).toEqual(['beta', 'alpha 2']);
  });
});

describe('viewToQuery', () => {
  it('sends sortBy/sortDir only when sorted, and comma-joined sets for mapped filters', () => {
    expect(viewToQuery<K>({ sortCol: '', sortDir: 'desc', filters: {} })).toEqual({});
    expect(viewToQuery<K>(
      { sortCol: 'name', sortDir: 'asc', filters: { status: ['a', 'b'], amount: ['1'] } },
      { sortMap: { name: 'displayName' }, filterMap: { status: 'status' } },
    )).toEqual({ sortBy: 'displayName', sortDir: 'asc', status: 'a,b' });
  });
});

describe('helpers', () => {
  it('distinctOptions dedupes, drops empties, sorts by label', () => {
    expect(distinctOptions(['b', null, 'a', 'b', ''], (v) => v.toUpperCase()))
      .toEqual([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]);
  });
  it('booleanSetToParam maps one pick to a boolean and both/none to undefined', () => {
    const v = { trueValue: 'active', falseValue: 'inactive' };
    expect(booleanSetToParam(new Set(['active']), v)).toBe(true);
    expect(booleanSetToParam(new Set(['inactive']), v)).toBe(false);
    expect(booleanSetToParam(new Set(['active', 'inactive']), v)).toBeUndefined();
    expect(booleanSetToParam(new Set(), v)).toBeUndefined();
  });
});
