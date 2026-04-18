// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

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
  useMergeContacts: () => passthroughMutation,
  useImportContacts: () => passthroughMutation,
  useContactTransactions: (...a: unknown[]) => useContactTransactionsMock(...a),
}));
vi.mock('../../api/hooks/useTransactions', () => ({
  useTransactions: (...a: unknown[]) => useTransactionsMock(...a),
}));

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
