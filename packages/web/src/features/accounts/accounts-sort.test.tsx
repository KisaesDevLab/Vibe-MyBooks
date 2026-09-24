// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Chart of Accounts: server-side sort, a multi-value Type filter that the
// toolbar select mirrors (one value ↔ the select; several ↔ "All Types"),
// and a Status filter shared with its select.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { accountsMocks, contactsMocks, companyMocks, transactionsMocks } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const row = { id: 'a1', name: 'Rent', accountNumber: '7010', accountType: 'expense', detailType: null, balance: '9.00', isActive: true, isSystem: false };

vi.mock('../../api/hooks/useAccounts', () => ({
  ...accountsMocks(),
  useAccounts: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [row], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
}));
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());

import { AccountsListPage } from './AccountsListPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('AccountsListPage — sort and filter', () => {
  it('sends the header sort to the server with the offset reset', () => {
    renderRoute(<AccountsListPage />);
    expect(lastFilters).toMatchObject({ isActive: true, offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^balance/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'balance', sortDir: 'asc', offset: 0 });
  });

  it('the Type popover sends a set; the select mirrors a single pick', () => {
    renderRoute(<AccountsListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Type' }));
    fireEvent.click(screen.getByLabelText('Expense'));
    fireEvent.click(screen.getByLabelText('Revenue'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(lastFilters['accountType']).toEqual(['expense', 'revenue']);
    // Two picked → the select shows All Types.
    expect((screen.getByDisplayValue('All Types') as HTMLSelectElement).value).toBe('');
    fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'asset' } });
    expect(lastFilters['accountType']).toEqual(['asset']);
    expect((screen.getByDisplayValue('Asset') as HTMLSelectElement).value).toBe('asset');
  });
});
