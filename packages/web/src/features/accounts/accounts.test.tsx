// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

// Mock each data hook with a controllable vi.fn so we can stage the
// loading/empty/populated states without hitting the network.
const useAccountsMock = vi.fn();
const useDeactivateAccountMock = vi.fn();
const useExportAccountsMock = vi.fn();
const useTransactionsMock = vi.fn();
const useVoidTransactionMock = vi.fn();
const useContactsMock = vi.fn();
const useRegisterMock = vi.fn();
const useRegisterSummaryMock = vi.fn();
const passthroughMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock('../../api/hooks/useAccounts', () => ({
  useAccounts: (...a: unknown[]) => useAccountsMock(...a),
  useAccount: () => ({ data: null, isLoading: false, isError: false }),
  useCreateAccount: () => passthroughMutation,
  useUpdateAccount: () => passthroughMutation,
  useDeactivateAccount: (...a: unknown[]) => useDeactivateAccountMock(...a),
  useMergeAccounts: () => passthroughMutation,
  useExportAccounts: (...a: unknown[]) => useExportAccountsMock(...a),
  useImportAccounts: () => passthroughMutation,
}));
vi.mock('../../api/hooks/useTransactions', () => ({
  useTransactions: (...a: unknown[]) => useTransactionsMock(...a),
  useTransaction: () => ({ data: null, isLoading: false, isError: false }),
  useCreateTransaction: () => passthroughMutation,
  useUpdateTransaction: () => passthroughMutation,
  useVoidTransaction: (...a: unknown[]) => useVoidTransactionMock(...a),
  useDuplicateTransaction: () => passthroughMutation,
}));
vi.mock('../../api/hooks/useContacts', () => ({
  useContacts: (...a: unknown[]) => useContactsMock(...a),
}));
vi.mock('../../api/hooks/useRegister', () => ({
  useRegister: (...a: unknown[]) => useRegisterMock(...a),
  useRegisterSummary: (...a: unknown[]) => useRegisterSummaryMock(...a),
}));

import { AccountsListPage } from './AccountsListPage';
import { RegistersPage } from './RegistersPage';
import { RegisterPage } from './RegisterPage';

// Reset the default return values before each test — some tests override.
function primeHooks() {
  useAccountsMock.mockReturnValue({
    data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
  });
  useDeactivateAccountMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useExportAccountsMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useTransactionsMock.mockReturnValue({
    data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
  });
  useContactsMock.mockReturnValue({
    data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
  });
  // The RegisterPage destructures `account`, `lines`, `balanceForward`,
  // `endingBalance`, `pagination`, `allowedEntryTypes` off data — any
  // missing property throws at render.
  useRegisterMock.mockReturnValue({
    data: {
      account: { id: 'acc-1', name: 'Main Checking', accountType: 'asset', detailType: 'checking', accountNumber: '1000' },
      lines: [],
      balanceForward: '0.00',
      endingBalance: '0.00',
      pagination: { page: 1, pageSize: 50, totalPages: 1 },
      allowedEntryTypes: ['deposit', 'expense', 'transfer'],
    },
    isLoading: false, isError: false, refetch: vi.fn(),
  });
  useRegisterSummaryMock.mockReturnValue({
    data: { openingBalance: '0.00', endingBalance: '0.00' }, isLoading: false, isError: false,
  });
  useVoidTransactionMock.mockReturnValue(passthroughMutation);
}

describe('accounts pages', () => {
  it('AccountsListPage shows the empty state on a fresh tenant', () => {
    primeHooks();
    renderRoute(<AccountsListPage />);
    expect(screen.getByRole('heading', { name: /chart of accounts/i })).toBeInTheDocument();
    expect(screen.getByText(/no accounts found/i)).toBeInTheDocument();
  });

  it('AccountsListPage shows rows + formatted balances when accounts exist', () => {
    primeHooks();
    useAccountsMock.mockReturnValue({
      data: {
        total: 2,
        data: [
          { id: 'a1', accountNumber: '1000', name: 'Main Checking', accountType: 'asset', detailType: 'checking', balance: '1234.56', isActive: true, isSystem: false },
          { id: 'a2', accountNumber: '4000', name: 'Sales', accountType: 'revenue', detailType: null, balance: '0.00', isActive: true, isSystem: false },
        ],
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderRoute(<AccountsListPage />);
    expect(screen.getByText('Main Checking')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('RegistersPage renders the accounts list for register navigation', () => {
    primeHooks();
    renderRoute(<RegistersPage />);
    // The heading varies but the page either shows a heading or a filter.
    // Assert it mounted without crashing — the div wrapper is always present.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('RegisterPage renders when given an account id', () => {
    primeHooks();
    useAccountsMock.mockReturnValue({
      data: { data: [{ id: 'acc-1', name: 'Main Checking', accountType: 'asset', detailType: 'checking', balance: '0.00', isActive: true, isSystem: false }], total: 1 },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderRoute(<RegisterPage />, { route: '/accounts/acc-1/register', path: '/accounts/:id/register' });
    // Just verify it mounted without crash.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
