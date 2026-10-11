// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

type Q = { data: unknown; isLoading: boolean; isError: boolean; refetch: () => void; dataUpdatedAt?: number };
const ok = (data: unknown): Q => ({ data, isLoading: false, isError: false, refetch: vi.fn(), dataUpdatedAt: 1 });
const h = vi.hoisted(() => ({ role: 'firm_readonly', settings: null as unknown, q: {} as { year?: unknown; treat?: unknown; sugg?: unknown; ready?: unknown; pl?: unknown } }));
const mut = { mutate: vi.fn(), isPending: false, isError: false, error: null };

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxEstimatorScope: () => ({ data: { firmRole: h.role } }),
  useTaxpayers: () => ({ data: { data: [] } }),
  useTaxpayer: () => ({ data: undefined }),
}));
vi.mock('../../../api/hooks/useTaxEstimatorEntities', () => ({
  useEntitySettings: () => h.settings,
  useEntityYearInputs: () => h.q.year,
  useEntityTreatments: () => h.q.treat,
  useTreatmentSuggestions: () => h.q.sugg,
  useEntityReadiness: () => h.q.ready,
  useTaxBasisPl: () => h.q.pl,
  useSaveEntitySettings: () => mut, useSaveEntityYearInputs: () => mut, useSaveEntityTreatments: () => mut,
}));

import { EntityTaxSetupPage } from './EntityTaxSetupPage';

const settingsData = {
  settings: { tenantId: 't', companyId: 'c', taxEntityType: null, taxMethod: null, isSstb: false, largeCorporation: false, farmerOverride: null, rentalQbiTradeOrBusiness: false, stateSourcing: null, updatedAt: null },
  resolved: { companyName: 'Rivera Plumbing LLC', entityType: 's_corp', entityTypeSource: 'tb_profile', tbReturnForm: '1120S', taxMethod: 'cash', taxMethodSource: 'company_accounting_method', booksMethod: 'cash', warnings: [] },
};
const render = () => renderRoute(<EntityTaxSetupPage />, { path: '/e/:tenantId/:companyId', route: '/e/t/c' });

beforeEach(() => {
  h.role = 'firm_readonly';
  h.settings = ok(settingsData);
  h.q = {
    year: ok({ w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, updatedAt: null }),
    treat: ok({ items: [], total: 0, limit: 500, offset: 0 }),
    sugg: ok([]),
    ready: ok({ lastClosedMonth: null, throughIsOpen: false, unreconciledAccounts: [], suspense: { balance: '0', transactionCount: 0, unpostedFeedCount: 0 }, unmappedAccounts: [], entity: { warnings: [] }, warnings: [] }),
    pl: ok({ accounts: [{ accountId: 'a2', accountNumber: '6900', name: 'Misc', accountType: 'expense', taxCode: null, treatment: null, pct: null, accountNonRecurring: false, bookAmount: '-5.0000', taxAmount: '-5.0000' }], w2Wages: { booksYtd: '0' }, bookNetIncome: '0', taxBasisProfit: '0', byCharacter: {}, trace: [], warnings: [] }),
  };
});

describe('EntityTaxSetupPage', () => {
  it('shows resolved values with their source and a read-only banner that disables controls', () => {
    render();
    expect(screen.getByTestId('resolved-type')).toHaveTextContent('S corporation');
    expect(screen.getByText('From Trial Balance return form 1120S')).toBeInTheDocument();
    expect(screen.getByText('Company accounting method')).toBeInTheDocument();
    expect(screen.getByText(/Read-only access/)).toBeInTheDocument();
    expect(screen.getByLabelText('Treatment for Misc')).toBeDisabled();
    expect(screen.getByLabelText('UBIA')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save tax profile' })).toBeNull();
  });

  it('shows an error state with retry when settings fail', () => {
    h.settings = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    render();
    expect(screen.getByText('Could not load entity tax setup.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the empty treatment state', () => {
    (h.q.pl as Q).data = { ...((h.q.pl as Q).data as object), accounts: [] };
    render();
    expect(screen.getByText(/No P&L accounts/)).toBeInTheDocument();
  });
});
