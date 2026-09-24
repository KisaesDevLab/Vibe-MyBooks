// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Invoices list: the page's column keys map onto the transactions
// endpoint's sort keys (Customer → payee); Status and Customer header
// popovers send sets, the Customer select mirrors a single pick.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { contactsMocks, tagsMocks, companyMocks, accountsMocks } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const row = { id: 'i1', txnNumber: 'INV-1', txnDate: '2026-09-01', dueDate: '2026-09-30', contactId: 'c1', contactName: 'Ann', total: '100.00', balanceDue: '100.00', invoiceStatus: 'sent', status: 'posted' };

vi.mock('../../api/hooks/useInvoices', () => ({
  useInvoices: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [row], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
}));
vi.mock('../../api/hooks/useContacts', () => ({
  ...contactsMocks(),
  useContacts: () => ({ data: { data: [{ id: 'c1', displayName: 'Ann', contactType: 'customer' }, { id: 'c2', displayName: 'Bob', contactType: 'customer' }], total: 2 }, isLoading: false, isError: false }),
}));
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());

import { InvoiceListPage } from './InvoiceListPage';

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); lastFilters = {}; });

describe('InvoiceListPage — sort and sets', () => {
  it('maps the Customer column onto the payee sort and Balance Due onto balanceDue', () => {
    renderRoute(<InvoiceListPage />);
    fireEvent.click(screen.getByRole('button', { name: /^customer$/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'payee', sortDir: 'asc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^balance due/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'balanceDue', sortDir: 'asc' });
  });

  it('Status and Customer popovers send sets; one customer mirrors into the select', () => {
    renderRoute(<InvoiceListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Paid'));
    fireEvent.click(screen.getByLabelText('Partially paid'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect((lastFilters['invoiceStatus'] as string[]).sort()).toEqual(['paid', 'partial']);

    fireEvent.click(screen.getByRole('button', { name: 'Filter Customer' }));
    fireEvent.click(screen.getByLabelText('Bob'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(lastFilters['contactId']).toEqual(['c2']);
    expect((screen.getByDisplayValue('Bob') as HTMLSelectElement).value).toBe('c2');
  });
});
