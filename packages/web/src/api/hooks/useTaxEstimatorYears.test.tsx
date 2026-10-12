// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../client', () => ({
  apiClient: vi.fn(async (path: string) => { api.calls.push(path); return path.includes('/adjustments') ? { data: [], total: 0 } : { data: [] }; }),
}));

import { useAdjustments, useDeleteScenario } from './useTaxEstimatorYears';

describe('useDeleteScenario (QA D22)', () => {
  it('does not refetch the deleted scenario\'s adjustments after the delete', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const adj = renderHook(() => useAdjustments('s-del'), { wrapper });
    await waitFor(() => expect(adj.result.current.isSuccess).toBe(true));
    const del = renderHook(() => useDeleteScenario(), { wrapper });
    api.calls.length = 0;
    await del.result.current.mutateAsync('s-del');
    await new Promise((r) => setTimeout(r, 20));
    expect(api.calls.filter((p) => p.includes('s-del/'))).toEqual([]);
    expect(api.calls.some((p) => p.endsWith('/scenarios/s-del'))).toBe(true);
  });
});
