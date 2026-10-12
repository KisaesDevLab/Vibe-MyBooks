// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { makeEstimate } from './test-fixtures';

type Q = { data?: unknown; isLoading?: boolean; isError?: boolean; error?: unknown; refetch: () => void };
const q = (over: Partial<Q> = {}): Q => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over });
const h = vi.hoisted(() => ({ role: 'firm_staff', taxpayer: null as unknown, year: null as unknown, estimates: null as unknown, clone: vi.fn(), rename: vi.fn(), del: vi.fn() }));
const idle = { isPending: false, isError: false, error: null };

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxEstimatorScope: () => ({ data: { firmRole: h.role } }),
  useTaxpayer: () => h.taxpayer,
}));
vi.mock('../../../api/hooks/useTaxEstimatorYears', () => ({
  useYear: () => h.year,
  useCloneScenario: () => ({ mutate: h.clone, ...idle }),
  useRenameScenario: () => ({ mutate: h.rename, ...idle }),
  useDeleteScenario: () => ({ mutate: h.del, ...idle }),
}));
vi.mock('../../../api/hooks/useTaxEstimatorEstimate', () => ({
  useEstimates: () => h.estimates,
  downloadEstimatePdf: vi.fn(),
}));

import { ScenarioComparePage } from './ScenarioComparePage';

const base = makeEstimate();
const truck = makeEstimate({ scenarioId: 's2', scenarioName: 'Buy truck', summary: { ...base.summary, total: '24199', marginalRate: '0.24' } });
const tp = { taxpayer: { id: 'tp1', displayName: 'Rivera' }, persons: [] };
const scen = (id: string, name: string, isBase = false) => ({ id, name, isBase, taxpayerId: 'tp1', taxYear: 2026, sortOrder: 0, sourceScenarioId: null, createdAt: '', updatedAt: '' });
const render = () => renderRoute(<ScenarioComparePage />, { path: '/tp/:id/scenarios', route: '/tp/tp1/scenarios?year=2026' });

beforeEach(() => {
  vi.clearAllMocks();
  h.role = 'firm_staff';
  h.taxpayer = q({ data: tp });
  h.year = q({ data: { exists: true, year: {}, scenarios: [scen('s1', 'Base', true), scen('s2', 'Buy truck')] } });
  h.estimates = q({ data: [base, truck] });
});

describe('ScenarioComparePage', () => {
  it('loading, year error, and year-not-set-up empty states', () => {
    h.year = q({ isLoading: true });
    const { unmount } = render();
    expect(screen.queryByLabelText('Line comparison')).toBeNull();
    unmount();
    h.year = q({ isError: true });
    const r2 = render();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    r2.unmount();
    h.year = q({ data: { exists: false, year: null, scenarios: [] } });
    render();
    expect(screen.getByLabelText('Year not set up')).toBeInTheDocument();
  });

  it('estimates loading and error states', () => {
    h.estimates = q({ isLoading: true });
    const { unmount } = render();
    expect(screen.queryByLabelText('Line comparison')).toBeNull();
    unmount();
    h.estimates = q({ isError: true, error: new Error('TE_PARAM_MISSING: qbi.rate') });
    render();
    expect(screen.getByText(/qbi\.rate/)).toBeInTheDocument();
  });

  it('data: cards with totals and change vs the first, marginal-rate and safe-harbor rows', () => {
    render();
    const cards = screen.getByLabelText('Scenarios being compared');
    expect(cards).toHaveTextContent('$43,731');
    expect(cards).toHaveTextContent('$24,199');
    expect(cards).toHaveTextContent('−19,532');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Marginal federal rate')).toBeInTheDocument();
    expect(within(table).getByText('Federal safe harbor: required annual payment')).toBeInTheDocument();
    expect(within(table).getByText('24%')).toBeInTheDocument();
    expect(within(table).getAllByText(/capped at limit/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText(/Show change vs/));
    expect(table).not.toHaveTextContent('−19,532');
  });

  it('manages scenarios: clone, rename and delete a non-base scenario', () => {
    render();
    const manage = screen.getByLabelText('Manage scenarios');
    fireEvent.click(within(manage).getByRole('button', { name: 'Clone' }));
    expect(h.clone).toHaveBeenCalledWith('s1', expect.anything());
    fireEvent.click(within(manage).getByRole('tab', { name: /Buy truck/ }));
    fireEvent.click(within(manage).getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Scenario name'), { target: { value: 'Truck Dec' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(h.rename).toHaveBeenCalledWith({ id: 's2', name: 'Truck Dec' });
    fireEvent.click(within(manage).getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);
    expect(h.del).toHaveBeenCalledWith('s2', expect.anything());
  });

  it('read-only members get no clone / rename / delete', () => {
    h.role = 'firm_readonly';
    render();
    expect(screen.queryByRole('button', { name: 'Clone' })).toBeNull();
  });
});
