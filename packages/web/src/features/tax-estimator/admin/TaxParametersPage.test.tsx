// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { TaxParametersDTO } from '@kis-books/shared';

interface QState<T> { data: T | undefined; isLoading: boolean; isError: boolean; refetch: ReturnType<typeof vi.fn> }

const h = vi.hoisted(() => ({
  years: { data: { years: [2025, 2026], shippedYears: [2025, 2026] }, isLoading: false, isError: false, refetch: vi.fn() } as QState<unknown>,
  params: { data: undefined, isLoading: false, isError: false, refetch: vi.fn() } as QState<unknown>,
  mutate: vi.fn(),
  revert: vi.fn(),
  create: vi.fn(),
  verify: vi.fn(),
  verifyAll: vi.fn(),
}));

vi.mock('../../../api/hooks/useTaxParameters', () => ({
  useTaxParameterYears: () => h.years,
  useTaxParameters: () => h.params,
  useTaxParameterDiff: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useTaxParameterChanges: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSetTaxParameterOverride: () => ({ mutate: h.mutate, isPending: false, isError: false, reset: vi.fn() }),
  useRevertTaxParameter: () => ({ mutate: h.revert, isPending: false }),
  useCreateTaxYearFromPrior: () => ({ mutate: h.create, isPending: false }),
  useAdoptShippedParameters: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyTaxParameter: () => ({ mutate: h.verify, isPending: false, isError: false, reset: vi.fn() }),
  useVerifyAllTaxParameters: () => ({ mutate: h.verifyAll, isPending: false, isError: false, reset: vi.fn() }),
}));

vi.mock('../../../api/hooks/useTaxStateRules', () => ({
  useStateRuleSummaries: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useStateRules: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useStateRuleDiff: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useStateRuleChanges: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSetStateRuleOverride: () => ({ mutate: vi.fn(), isPending: false, isError: false, reset: vi.fn() }),
  useRevertStateRule: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStateYearFromPrior: () => ({ mutate: vi.fn(), isPending: false }),
  useAdoptShippedStateRules: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { TaxParametersPage } from './TaxParametersPage';
import { formatValue } from './format';

const fixture = (over: Partial<TaxParametersDTO> = {}): TaxParametersDTO => ({
  year: 2026, isFallback: false, fallbackYear: null,
  completeness: { total: 3, present: 2, missing: ['se.min_nese'] },
  parameters: [
    { key: 'se.ss_wage_base', label: 'Social Security wage base', group: 'Self-employment', type: 'money', unit: 'usd', value: 184500, status: 'verified', source: 'seed', citation: 'SSA 2026 fact sheet' },
    { key: 'se.nese_factor', label: 'Net earnings from SE factor', group: 'Self-employment', type: 'rate', unit: 'rate', value: 0.9235, status: 'unverified', source: 'override', citation: 'IRC 1402', reason: 'testing', shippedValue: 0.92 },
    { key: 'brackets.mfj', label: 'Ordinary income brackets', group: 'Brackets and capital gains', type: 'bracket_table', unit: 'table', value: [[24800, 0.1], [null, 0.37]], status: 'provisional', source: 'provisional', citation: 'Rev. Proc.' },
  ],
  ...over,
});

const render = () => renderRoute(<TaxParametersPage />);

beforeEach(() => {
  vi.clearAllMocks();
  h.years.data = { years: [2025, 2026], shippedYears: [2025, 2026] };
  h.years.isLoading = false; h.years.isError = false;
  h.params = { data: fixture(), isLoading: false, isError: false, refetch: vi.fn() };
});

describe('TaxParametersPage', () => {
  it('renders groups, formatted values and badges', async () => {
    render();
    expect(await screen.findByText('Self-employment')).toBeInTheDocument();
    expect(screen.getByText('Brackets and capital gains')).toBeInTheDocument();
    expect(screen.getByText('$184,500')).toBeInTheDocument();
    expect(screen.getByText('92.35%')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByText('unverified')).toBeInTheDocument();
    expect(screen.getAllByText('provisional').length).toBeGreaterThan(0);
    expect(screen.getByText('override')).toBeInTheDocument();
    expect(screen.getByText('2/3 complete')).toBeInTheDocument();
    expect(screen.getByText('Shipped:')).toBeInTheDocument();
  });

  it('lists missing keys when the completeness chip is clicked', async () => {
    render();
    fireEvent.click(await screen.findByText('2/3 complete'));
    expect(screen.getByLabelText('Missing keys')).toHaveTextContent('se.min_nese');
  });

  it('R6-02: fallback rows show no Override button, only the create hint', async () => {
    h.params = { data: fixture({ isFallback: true, fallbackYear: 2025, parameters: fixture().parameters.map((p) => ({ ...p, source: 'fallback' as const, status: 'provisional' as const, fallbackYear: 2025 })) }), isLoading: false, isError: false, refetch: vi.fn() };
    render();
    await screen.findByText(/No 2026 parameters shipped/);
    expect(screen.queryByLabelText(/^Override /)).toBeNull();
    expect(screen.getAllByText('Create 2026 from prior to edit')).toHaveLength(3);
    expect(screen.queryByLabelText(/Mark .* verified/)).toBeNull();
  });

  it('shows the fallback banner', async () => {
    h.params = { ...h.params, data: fixture({ isFallback: true, fallbackYear: 2025 }) };
    render();
    expect(await screen.findByText(/No 2026 parameters shipped — showing 2025 as provisional/)).toBeInTheDocument();
  });

  it('override modal validates by type and requires a reason', async () => {
    render();
    fireEvent.click(await screen.findByLabelText('Override se.ss_wage_base'));
    const value = screen.getByLabelText(/Value \(money\)/);
    fireEvent.change(value, { target: { value: '-5' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('expected a non-negative number')).toBeInTheDocument();
    expect(screen.getByText(/reason of at least 3/)).toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();

    fireEvent.change(value, { target: { value: '190000' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'new SSA notice' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(h.mutate).toHaveBeenCalledWith({ key: 'se.ss_wage_base', value: 190000, reason: 'new SSA notice' }, expect.anything());
  });

  it('validates JSON bracket tables', async () => {
    render();
    fireEvent.click(await screen.findByLabelText('Override brackets.mfj'));
    fireEvent.change(screen.getByLabelText(/Value \(bracket_table\)/), { target: { value: '[[100, 0.1]]' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'because' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('last bracket must have a null upper bound')).toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('revert asks for confirmation', async () => {
    render();
    fireEvent.click(await screen.findByLabelText('Revert se.nese_factor'));
    expect(screen.getByText('Revert parameter')).toBeInTheDocument();
    expect(h.revert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    await waitFor(() => expect(h.revert).toHaveBeenCalledWith('se.nese_factor', expect.anything()));
  });

  it('offers to create the next year only when it has no rows', async () => {
    render();
    expect(await screen.findByText('Create 2027 from 2026')).toBeInTheDocument();
  });

  it('hides create-year when the next year exists', async () => {
    h.years.data = { years: [2025, 2026, 2027], shippedYears: [2025, 2026] };
    render();
    await screen.findByText('Self-employment');
    expect(screen.queryByText(/^Create 2028/)).toBeInTheDocument();
    expect(screen.queryByText('Create 2027 from 2026')).not.toBeInTheDocument();
  });

  it('States switch shows the States view and hides the federal create-year button', async () => {
    render();
    fireEvent.click(await screen.findByText('States'));
    expect(screen.getByText('No jurisdictions are available.')).toBeInTheDocument();
    expect(screen.queryByText('Create 2027 from 2026')).not.toBeInTheDocument();
  });

  it('shows error with retry and loading and empty states', async () => {
    h.params = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    const r = render();
    fireEvent.click(await screen.findByText('Try again'));
    expect(h.params.refetch).toHaveBeenCalled();
    r.unmount();

    h.params = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    const r2 = render();
    expect(await screen.findByLabelText('Loading tax parameters')).toBeInTheDocument();
    r2.unmount();

    h.params = { data: fixture({ parameters: [], completeness: { total: 0, present: 0, missing: [] } }), isLoading: false, isError: false, refetch: vi.fn() };
    render();
    expect(await screen.findByText(/No parameters for 2026/)).toBeInTheDocument();
  });
});

describe('TaxParametersPage — R7 in-app Verify', () => {
  it('offers Mark verified only on rows that are not verified, with an optional note', async () => {
    render();
    expect(await screen.findByLabelText('Mark se.nese_factor verified')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark brackets.mfj verified')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mark se.ss_wage_base verified')).toBeNull();
    fireEvent.click(screen.getByLabelText('Mark se.nese_factor verified'));
    // QA2-06: the dialog shows the value being signed, not only the key.
    expect(within(screen.getByRole('dialog')).getByTestId('verify-value')).toHaveTextContent(formatValue('rate', 0.9235));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'IRC 1402(a)(12)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark verified' }));
    // R6-04: the dialog signs the value it showed, so a concurrent override is refused by the server.
    expect(h.verify).toHaveBeenCalledWith({ key: 'se.nese_factor', note: 'IRC 1402(a)(12)', expectedValue: 0.9235 }, expect.anything());
  });

  it('bulk verify counts the unverified rows and asks for confirmation before calling the API', async () => {
    render();
    fireEvent.click(await screen.findByText('Verify all unverified in 2026 (2)'));
    expect(h.verifyAll).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Verify all unverified in 2026' })).toHaveTextContent(/all 2 federal parameter/);
    fireEvent.click(screen.getByRole('button', { name: 'Verify 2' }));
    expect(h.verifyAll).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it('shows who verified a row in-app; a fallback year has nothing to verify; overrides stay available on verified rows', async () => {
    h.params = { data: fixture({ parameters: [{ ...fixture().parameters[0]!, verifiedAt: '2026-10-12T15:00:00Z', verifiedByEmail: 'kurt@example.com', verificationNote: 'SSA' }] }), isLoading: false, isError: false, refetch: vi.fn() };
    render();
    expect(await screen.findByTestId('verified-line')).toHaveTextContent(/Verified by kurt@example.com on .* — SSA/);
    expect(screen.getByLabelText('Override se.ss_wage_base')).toBeInTheDocument();
    expect(screen.queryByText(/Verify all unverified/)).toBeNull();
  });
});
