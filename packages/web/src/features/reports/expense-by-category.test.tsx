// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Expenses by Category — GL-style detail view: renders account groups
// from the detail response, the multi-account filter feeds account_ids
// into the query, and the Detail/Summary toggle switches response shape.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { companyMocks, tagsMocks, companyProviderMocks } from '../../test-mocks';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());

const expenseAccounts = [
  { id: 'acc-rent', accountNumber: '6000', name: 'Rent', accountType: 'expense', isActive: true },
  { id: 'acc-util', accountNumber: '6100', name: 'Utilities', accountType: 'expense', isActive: true },
  { id: 'acc-bank', accountNumber: '1000', name: 'Checking', accountType: 'asset', isActive: true },
];

vi.mock('../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({
    data: { data: expenseAccounts, total: expenseAccounts.length },
    isLoading: false,
    isError: false,
  }),
}));

const detailResponse = {
  title: 'Expenses by Category',
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  data: [
    { account_id: 'acc-rent', category: 'Rent', account_number: '6000', account_type: 'expense', total: '1500' },
  ],
  groups: [
    {
      accountId: 'acc-rent',
      accountNumber: '6000',
      name: 'Rent',
      accountType: 'expense',
      lines: [
        {
          lineId: 'l1', transactionId: 't1', date: '2026-01-15', txnType: 'expense',
          txnNumber: 'CHK-101', contactName: 'Landlord LLC', memo: 'January rent',
          debit: 1000, credit: 0, balance: 1000,
        },
        {
          lineId: 'l2', transactionId: 't2', date: '2026-03-20', txnType: 'journal_entry',
          txnNumber: null, contactName: null, memo: 'Rent refund',
          debit: 0, credit: 100, balance: 900,
        },
      ],
      totalDebits: 1000,
      totalCredits: 100,
      subtotal: 900,
    },
    {
      accountId: 'acc-util',
      accountNumber: '6100',
      name: 'Utilities',
      accountType: 'expense',
      lines: [],
      totalDebits: 0,
      totalCredits: 0,
      subtotal: 0,
    },
  ],
  grandTotal: 900,
};

const summaryResponse = {
  title: 'Expenses by Category',
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  data: [
    { account_id: 'acc-rent', category: 'Rent', account_number: '6000', account_type: 'expense', total: '1500' },
    { account_id: 'acc-util', category: 'Utilities', account_number: '6100', account_type: 'expense', total: '200' },
  ],
};

const apiClientMock = vi.fn(async (path: string) =>
  path.includes('display=detail') ? detailResponse : summaryResponse,
);

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (path: string) => apiClientMock(path) };
});

import { ExpensesByCategoryReport } from './ExpensesByCategoryReport';

beforeEach(() => {
  window.sessionStorage.clear();
  apiClientMock.mockClear();
});

describe('ExpensesByCategoryReport', () => {
  it('defaults to the GL-style detail view: groups, lines, netted subtotals, grand total', async () => {
    renderRoute(<ExpensesByCategoryReport />);
    await waitFor(() => expect(screen.getByText('Rent')).toBeTruthy());

    // Requested with display=detail by default.
    expect(apiClientMock.mock.calls.some(([p]) => String(p).includes('display=detail'))).toBe(true);

    // Transaction line fields.
    expect(screen.getByText('2026-01-15')).toBeTruthy();
    expect(screen.getByText('CHK-101')).toBeTruthy();
    expect(screen.getByText('Landlord LLC')).toBeTruthy();
    expect(screen.getByText('January rent')).toBeTruthy();

    // Refund credit shows and the subtotal nets it (1000 − 100 = 900).
    expect(screen.getByText('Rent refund')).toBeTruthy();
    expect(screen.getByText('Total 6000 — Rent')).toBeTruthy();
    expect(screen.getAllByText('$900.00').length).toBeGreaterThanOrEqual(2); // subtotal + grand total

    // Zero-activity group renders an empty section.
    expect(screen.getByText('Utilities')).toBeTruthy();
    expect(screen.getByText('No activity in period')).toBeTruthy();
    expect(screen.getByText('Total Expenses')).toBeTruthy();
  });

  it('multi-account filter sends account_ids in the query', async () => {
    renderRoute(<ExpensesByCategoryReport />);
    await waitFor(() => expect(screen.getByText('Rent')).toBeTruthy());

    fireEvent.click(screen.getByText('All expense accounts'));
    // Only expense-side accounts are offered — the asset never shows.
    expect(screen.queryByText(/Checking/)).toBeNull();

    fireEvent.click(screen.getByText('6000 — Rent'));
    await waitFor(() =>
      expect(apiClientMock.mock.calls.some(([p]) => String(p).includes('account_ids=acc-rent'))).toBe(true));

    // Button label reflects the selection.
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('toggling to Summary drops display=detail and renders the flat table', async () => {
    renderRoute(<ExpensesByCategoryReport />);
    await waitFor(() => expect(screen.getByText('Rent')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Report view mode'), { target: { value: 'summary' } });

    await waitFor(() => expect(screen.getByText('Utilities')).toBeTruthy());
    // The summary request omits display=detail.
    const lastCall = String(apiClientMock.mock.calls[apiClientMock.mock.calls.length - 1]![0]);
    expect(lastCall.includes('display=detail')).toBe(false);
    // Flat rows with formatted totals.
    expect(screen.getByText('$1,500.00')).toBeTruthy();
    expect(screen.getByText('$200.00')).toBeTruthy();
    // GL-style section chrome is gone.
    expect(screen.queryByText('Total Expenses')).toBeNull();
  });
});
