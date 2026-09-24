// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Contacts list: sorting and the Status value filter are server-side (the
// list paginates), so a header click and a popover Apply must reach the list
// hook as query args with the offset back at 0, and the view persists.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { contactsMocks, accountsMocks, companyMocks, passthroughMutation } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const row = { id: 'c1', displayName: 'Spire', contactType: 'vendor', email: null, phone: null, companyName: null, isActive: true, defaultExpenseAccountId: null, defaultExpenseAccountName: null, defaultExpenseAccountNumber: null };

vi.mock('../../api/hooks/useContacts', () => ({
  ...contactsMocks(),
  useBulkUpdateContactType: passthroughMutation,
  useContacts: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [row], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());

import { ContactsListPage } from './ContactsListPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('ContactsListPage — sort and filter', () => {
  it('sends the header sort to the server and resets the offset', () => {
    renderRoute(<ContactsListPage />);
    expect(lastFilters).toMatchObject({ isActive: true, offset: 0 });
    expect(lastFilters['sortBy']).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: /^email/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'email', sortDir: 'asc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^email/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'email', sortDir: 'desc' });
    expect(JSON.parse(sessionStorage.getItem('vibe:contacts:view')!)).toMatchObject({ sortCol: 'email', sortDir: 'desc' });
  });

  it('the Status popover and the Status select share one filter', () => {
    renderRoute(<ContactsListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Active'));   // untick the default
    fireEvent.click(screen.getByLabelText('Inactive'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(lastFilters['isActive']).toBe(false);
    expect((screen.getByDisplayValue('Inactive') as HTMLSelectElement).value).toBe('inactive');
    fireEvent.change(screen.getByDisplayValue('Inactive'), { target: { value: 'all' } });
    expect(lastFilters['isActive']).toBeUndefined();
  });
});
