// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnView } from './useColumnView';

type K = 'name' | 'date' | 'status';
const KEYS = ['name', 'date', 'status'] as const;

beforeEach(() => sessionStorage.clear());

describe('useColumnView', () => {
  it('toggles: a fresh column uses its default direction, a repeat click flips', () => {
    const { result } = renderHook(() => useColumnView<K>('vibe:test:view', {
      sortKeys: KEYS, defaultDir: (c) => (c === 'date' ? 'desc' : 'asc'),
    }));
    expect(result.current.sortCol).toBe('');
    act(() => result.current.toggleSort('date'));
    expect(result.current).toMatchObject({ sortCol: 'date', sortDir: 'desc' });
    act(() => result.current.toggleSort('date'));
    expect(result.current.sortDir).toBe('asc');
    act(() => result.current.toggleSort('name'));
    expect(result.current).toMatchObject({ sortCol: 'name', sortDir: 'asc' });
  });

  it('filters: set, read back as a Set, empty removes, signature changes, persisted', () => {
    const { result } = renderHook(() => useColumnView<K>('vibe:test:view', { sortKeys: KEYS }));
    const before = result.current.signature;
    act(() => result.current.setFilter('status', new Set(['paid', 'unpaid'])));
    expect([...result.current.filterFor('status')].sort()).toEqual(['paid', 'unpaid']);
    expect(result.current.anyFilterActive).toBe(true);
    expect(result.current.signature).not.toBe(before);
    expect(JSON.parse(sessionStorage.getItem('vibe:test:view')!).filters.status).toEqual(['paid', 'unpaid']);
    act(() => result.current.setFilter('status', new Set()));
    expect(result.current.anyFilterActive).toBe(false);
  });

  it('drops a persisted sort key or filter column the current build does not know', () => {
    sessionStorage.setItem('vibe:test:view', JSON.stringify({
      sortCol: 'gone', sortDir: 'asc', filters: { gone: ['x'], status: ['paid'] },
    }));
    const { result } = renderHook(() => useColumnView<K>('vibe:test:view', { sortKeys: KEYS }));
    expect(result.current.sortCol).toBe('');
    expect(result.current.filters).toEqual({ status: ['paid'] });
  });

  it('thProps / filterProps bind a column to the view', () => {
    const { result } = renderHook(() => useColumnView<K>('vibe:test:view', { sortKeys: KEYS }));
    const th = result.current.thProps('name');
    expect(th).toMatchObject({ sortKey: 'name', sortBy: '', sortDir: 'desc' });
    act(() => th.onSortDir('name', 'desc'));
    expect(result.current).toMatchObject({ sortCol: 'name', sortDir: 'desc' });
    const fp = result.current.filterProps('status', [{ value: 'paid', label: 'Paid' }]);
    act(() => fp.onApply(new Set(['paid'])));
    expect(result.current.filters.status).toEqual(['paid']);
  });
});
