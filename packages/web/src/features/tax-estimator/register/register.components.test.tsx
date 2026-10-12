// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { ApiError } from '../../../api/client';

type Q = { data?: unknown; isLoading?: boolean; isError?: boolean; error?: unknown; refetch: () => void };
const q = (over: Partial<Q> = {}): Q => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over });
const h = vi.hoisted(() => ({
  vis: { ready: true, showGroup: true, items: [] as unknown[] },
  txn: null as unknown,
  company: null as unknown,
  enabledSeen: [] as boolean[],
  mutate: vi.fn(),
  set: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock('../../../hooks/useTaxEstimatorVisibility', () => ({ useTaxEstimatorVisibility: () => h.vis }));
vi.mock('../../../api/hooks/useTaxEstimatorRegister', () => ({
  useRegisterTransactionFlag: (_id: string, enabled: boolean) => { h.enabledSeen.push(enabled); return h.txn; },
  useSetRegisterTransactionFlag: () => ({ ...h.set, mutate: h.mutate }),
  useRegisterCompanyFlags: (enabled: boolean) => { h.enabledSeen.push(enabled); return h.company; },
}));

import { NonRecurringFlagCard } from './NonRecurringFlagCard';
import { useRegisterNonRecurringIds } from './useRegisterNonRecurring';

const flag = (over: Record<string, unknown> = {}) => ({
  transactionId: 't1', companyId: 'c1', linked: true, taxpayers: [{ id: 'tp1', displayName: 'Rivera household', years: [2026] }],
  nonRecurring: false, canEdit: true, updatedAt: null, ...over,
});
const render = () => renderRoute(<NonRecurringFlagCard transactionId="t1" />);

beforeEach(() => {
  vi.clearAllMocks();
  h.vis = { ready: true, showGroup: true, items: [] };
  h.txn = q({ data: flag() });
  h.company = q({ data: { companyId: 'c1', linked: true, canEdit: true, transactionIds: ['t1', 't9'], total: 2, limit: 500 } });
  h.enabledSeen = [];
  h.set = { isPending: false, isError: false, error: null };
});

describe('NonRecurringFlagCard (transaction detail)', () => {
  it('hidden, without a request, when the Tax Estimator is not available to the caller (flag off, not firm staff …)', () => {
    h.vis = { ready: true, showGroup: false, items: [] };
    render();
    expect(screen.queryByLabelText('Tax Estimator')).toBeNull();
    expect(h.enabledSeen.every((e) => e === false)).toBe(true);
  });

  it('loading: a quiet placeholder', () => {
    h.txn = q({ isLoading: true });
    render();
    expect(screen.getByLabelText('Tax Estimator')).toHaveTextContent('Checking the Tax Estimator');
  });

  it('error: 404 (not available here) renders nothing; any other error offers a retry', () => {
    h.txn = q({ isError: true, error: new ApiError('Feature not available', undefined, undefined, 404) });
    const { unmount } = render();
    expect(screen.queryByLabelText('Tax Estimator')).toBeNull();
    unmount();
    const refetch = vi.fn();
    h.txn = q({ isError: true, error: new ApiError('boom', undefined, undefined, 500), refetch });
    render();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the Tax Estimator flag');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty: a company not linked to any taxpayer shows nothing', () => {
    h.txn = q({ data: flag({ linked: false, taxpayers: [] }) });
    render();
    expect(screen.queryByLabelText('Tax Estimator')).toBeNull();
  });

  it('data: shows Recurring and marks the transaction non-recurring', () => {
    render();
    const card = screen.getByLabelText('Tax Estimator');
    expect(card).toHaveTextContent('Recurring');
    expect(card).toHaveTextContent('Linked taxpayer: Rivera household.');
    fireEvent.click(screen.getByRole('button', { name: 'Mark non-recurring' }));
    expect(h.mutate).toHaveBeenCalledWith(true);
  });

  it('data: a flagged transaction shows Non-recurring and can be unflagged; save errors are shown', () => {
    h.txn = q({ data: flag({ nonRecurring: true, updatedAt: '2026-10-12T00:00:00Z' }) });
    h.set = { isPending: false, isError: true, error: new Error('This company is not linked to a taxpayer in the Tax Estimator') };
    render();
    expect(screen.getByLabelText('Tax Estimator')).toHaveTextContent('Non-recurring');
    expect(screen.getByLabelText('Tax Estimator')).toHaveTextContent('left out of the run-rate');
    fireEvent.click(screen.getByRole('button', { name: 'Mark recurring' }));
    expect(h.mutate).toHaveBeenCalledWith(false);
    expect(screen.getByRole('alert')).toHaveTextContent('not linked to a taxpayer');
  });

  it('read-only firm members see the state without the toggle', () => {
    h.txn = q({ data: flag({ canEdit: false }) });
    render();
    expect(screen.getByLabelText('Tax Estimator')).toHaveTextContent('Recurring');
    expect(screen.queryByRole('button', { name: /Mark/ })).toBeNull();
  });
});

describe('useRegisterNonRecurringIds (register badge)', () => {
  it('returns the flagged ids of a linked company', () => {
    const { result } = renderHook(() => useRegisterNonRecurringIds());
    expect([...result.current]).toEqual(['t1', 't9']);
    expect(h.enabledSeen).toContain(true);
  });

  it('is empty for an unlinked company, while loading, on error, or without access', () => {
    h.company = q({ data: { companyId: 'c1', linked: false, canEdit: true, transactionIds: [], total: 0, limit: 500 } });
    expect(renderHook(() => useRegisterNonRecurringIds()).result.current.size).toBe(0);
    h.company = q({ isLoading: true });
    expect(renderHook(() => useRegisterNonRecurringIds()).result.current.size).toBe(0);
    h.company = q({ isError: true, error: new ApiError('x', undefined, undefined, 404) });
    expect(renderHook(() => useRegisterNonRecurringIds()).result.current.size).toBe(0);
    h.enabledSeen = [];
    h.vis = { ready: false, showGroup: false, items: [] };
    h.company = q({});
    expect(renderHook(() => useRegisterNonRecurringIds()).result.current.size).toBe(0);
    expect(h.enabledSeen).toEqual([false]);
  });
});
