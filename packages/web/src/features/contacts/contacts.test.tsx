// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { accountsMocks, companyMocks } from '../../test-mocks';

const useContactsMock = vi.fn();
const useContactMock = vi.fn();
const useCreateContactMock = vi.fn();
const useUpdateContactMock = vi.fn();
const useDeactivateContactMock = vi.fn();
const useExportContactsMock = vi.fn();
const useTransactionsMock = vi.fn();
const useContactTransactionsMock = vi.fn();
const passthroughMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock('../../api/hooks/useContacts', () => ({
  useContacts: (...a: unknown[]) => useContactsMock(...a),
  useContact: (...a: unknown[]) => useContactMock(...a),
  useCreateContact: (...a: unknown[]) => useCreateContactMock(...a),
  useUpdateContact: (...a: unknown[]) => useUpdateContactMock(...a),
  useDeactivateContact: (...a: unknown[]) => useDeactivateContactMock(...a),
  useExportContacts: (...a: unknown[]) => useExportContactsMock(...a),
  useBulkUpdateContactType: () => passthroughMutation,
  useMergeContacts: () => passthroughMutation,
  useImportContacts: () => passthroughMutation,
  useContactTransactions: (...a: unknown[]) => useContactTransactionsMock(...a),
}));
vi.mock('../../api/hooks/useTransactions', () => ({
  useTransactions: (...a: unknown[]) => useTransactionsMock(...a),
}));
// The Default category picker on the list is the shared AccountSelector;
// give it one expense account to find (no number → the plain name shows).
vi.mock('../../api/hooks/useAccounts', () => ({
  ...accountsMocks(),
  useAccounts: () => ({
    data: { data: [{ id: 'acct-rent', name: 'Rent', accountType: 'expense', accountNumber: null, isActive: true }], total: 1 },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('../../api/hooks/useCompany', () => companyMocks());

import { ContactsListPage } from './ContactsListPage';
import { ContactFormPage } from './ContactFormPage';
import { ContactDetailPage } from './ContactDetailPage';

function primeHooks() {
  useContactsMock.mockReturnValue({
    data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
  });
  useContactMock.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() });
  useCreateContactMock.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  useUpdateContactMock.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  useDeactivateContactMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useExportContactsMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useTransactionsMock.mockReturnValue({
    data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
  });
  useContactTransactionsMock.mockReturnValue({
    data: { transactions: [] }, isLoading: false, isError: false, refetch: vi.fn(),
  });
}

describe('contacts pages', () => {
  it('ContactsListPage shows the empty state', () => {
    primeHooks();
    renderRoute(<ContactsListPage />);
    expect(screen.getByRole('heading', { name: /^contacts$/i })).toBeInTheDocument();
    expect(screen.getByText(/no contacts found/i)).toBeInTheDocument();
  });

  it('ContactsListPage shows each vendor\'s default category and saves a new pick in place', async () => {
    primeHooks();
    const updateMutate = vi.fn();
    useUpdateContactMock.mockReturnValue({ mutate: updateMutate, mutateAsync: vi.fn(), isPending: false });
    const base = { email: null, phone: null, companyName: null, isActive: true, defaultExpenseAccountId: null, defaultExpenseAccountName: null, defaultExpenseAccountNumber: null };
    useContactsMock.mockReturnValue({
      data: {
        data: [
          { ...base, id: 'v1', displayName: 'Spire', contactType: 'vendor', defaultExpenseAccountId: 'acct-util', defaultExpenseAccountName: 'Utilities', defaultExpenseAccountNumber: '7021' },
          { ...base, id: 'v2', displayName: 'Blank Vendor', contactType: 'vendor' },
          { ...base, id: 'c1', displayName: 'Wallace', contactType: 'customer' },
        ],
        total: 3,
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderRoute(<ContactsListPage />);
    expect(screen.getByRole('columnheader', { name: /default category/i })).toBeInTheDocument();
    expect(screen.getByText('7021 · Utilities')).toBeInTheDocument();
    // A customer has no default expense category: a dash, not a picker.
    expect(screen.queryByRole('button', { name: /default category for wallace/i })).toBeNull();

    // Click the empty vendor cell → picker; pick → one-field update, row not navigated.
    fireEvent.click(screen.getByRole('button', { name: /default category for blank vendor/i }));
    const input = screen.getByPlaceholderText(/search accounts/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Rent' } });
    fireEvent.click(await waitFor(() => screen.getByText('Rent')));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0]![0]).toEqual({ id: 'v2', defaultExpenseAccountId: 'acct-rent' });
    expect(screen.getByRole('heading', { name: /^contacts$/i })).toBeInTheDocument();
  });

  it('ContactFormPage renders the new-contact form', () => {
    primeHooks();
    renderRoute(<ContactFormPage />, { route: '/contacts/new', path: '/contacts/new' });
    // The form always has a display-name / name input.
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('ContactDetailPage renders without crash given a loaded contact', () => {
    primeHooks();
    useContactMock.mockReturnValue({
      data: {
        contact: {
          id: 'c1', displayName: 'Alice', contactType: 'customer', email: 'a@x', phone: null,
          companyName: null, isActive: true,
        },
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderRoute(<ContactDetailPage />, { route: '/contacts/c1', path: '/contacts/:id' });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
