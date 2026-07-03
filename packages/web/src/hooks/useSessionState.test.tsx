// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionState } from './useSessionState';
import { useDebouncedValue, useDebouncedDate, isCompleteDate } from './useDebouncedValue';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('useSessionState', () => {
  it('falls back to the default when storage is empty', () => {
    const { result } = renderHook(() => useSessionState('vibe:test:field', 'dflt'));
    expect(result.current[0]).toBe('dflt');
  });

  it('persists updates to sessionStorage and restores on remount', () => {
    const first = renderHook(() => useSessionState('vibe:test:date', '2026-01-01'));
    act(() => first.result.current[1]('2026-06-30'));
    expect(first.result.current[0]).toBe('2026-06-30');
    expect(window.sessionStorage.getItem('vibe:test:date')).toBe('"2026-06-30"');
    first.unmount();

    const second = renderHook(() => useSessionState('vibe:test:date', '2026-01-01'));
    expect(second.result.current[0]).toBe('2026-06-30');
  });

  it('supports functional updates and non-string values', () => {
    const { result } = renderHook(() => useSessionState('vibe:test:n', 1));
    act(() => result.current[1]((n) => n + 41));
    expect(result.current[0]).toBe(42);
    expect(window.sessionStorage.getItem('vibe:test:n')).toBe('42');
  });

  it('survives a corrupted storage entry', () => {
    window.sessionStorage.setItem('vibe:test:bad', '{not json');
    const { result } = renderHook(() => useSessionState('vibe:test:bad', 'safe'));
    expect(result.current[0]).toBe('safe');
  });

  it('keeps working in memory when setItem throws (quota/disabled)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useSessionState('vibe:test:q', 'a'));
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('b');
    spy.mockRestore();
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('only updates after the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 400), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(399); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('abc');
  });

  it('resets the timer on every keystroke', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 400), {
      initialProps: { v: '' },
    });
    rerender({ v: 'x' });
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ v: 'xy' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(''); // never idle for 400ms yet
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('xy');
  });
});

describe('useDebouncedDate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds the last complete date while a partial date is typed', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedDate(v, 400), {
      initialProps: { v: '2026-01-01' },
    });
    // Native date inputs emit per-segment values like year 0002.
    rerender({ v: '0002-01-01' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe('2026-01-01');
    rerender({ v: '2027-03-15' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe('2027-03-15');
  });
});

describe('isCompleteDate', () => {
  it('accepts real calendar days and rejects partials/impossible dates', () => {
    expect(isCompleteDate('2026-06-30')).toBe(true);
    expect(isCompleteDate('0002-01-01')).toBe(false); // per-segment typing artifact
    expect(isCompleteDate('2026-02-30')).toBe(false); // not a real day
    expect(isCompleteDate('2026-6-3')).toBe(false);
    expect(isCompleteDate('')).toBe(false);
  });
});
