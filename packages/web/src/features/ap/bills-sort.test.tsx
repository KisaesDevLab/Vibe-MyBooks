// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bills list: server-side sort; the Status header popover sends a set and
// shares its entry with the Status select.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { apMocks, contactsMocks, accountsMocks, companyMocks, tagsMocks, aiMocks, paymentsMocks, transactionsMocks } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const row = { id: 'b1', txnNumber: 'BILL-1', txnDate: '2026-09-01', dueDate: '2026-09-30', contactId: 'v1', contactName: 'Spire', vendorInvoiceNumber: 'A-1', paymentTerms: null, total: '10.00', amountPaid: '0', creditsApplied: '0', balanceDue: '10.00', billStatus: 'unpaid', memo: null, status: 'posted', createdAt: '2026-09-01T00:00:00Z', daysOverdue: 0 };

vi.mock('../../api/hooks/useAp', () => ({
  ...apMocks(),
  useBills: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [row], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
}));
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePayments', () => paymentsMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());

import { BillListPage } from './BillListPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('BillListPage — sort and status set', () => {
  it('sends the header sort with the offset reset', () => {
    renderRoute(<BillListPage />);
    expect(lastFilters['sortBy']).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: /^vendor$/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'vendor', sortDir: 'asc', offset: 0 });
  });

  it('the Status popover sends a set; one pick mirrors into the select', () => {
    renderRoute(<BillListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Overdue'));
    fireEvent.click(screen.getByLabelText('Partial'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect((lastFilters['billStatus'] as string[]).sort()).toEqual(['overdue', 'partial']);
    const select = screen.getByDisplayValue(/all status/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'paid' } });
    expect(lastFilters['billStatus']).toEqual(['paid']);
  });
});
