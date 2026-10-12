// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// General Ledger — account filter: the dropdown offers every active
// account of every type (grouped by type, searchable), a selection feeds
// account_ids into BOTH the query and the CSV/PDF export URL, and the
// selection persists for the tab session.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { companyMocks, tagsMocks, companyProviderMocks } from '../../test-mocks';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());

const allAccounts = [
  { id: 'acc-rent', accountNumber: '6000', name: 'Rent', accountType: 'expense', isActive: true },
  { id: 'acc-bank', accountNumber: '1000', name: 'Checking', accountType: 'asset', isActive: true },
  { id: 'acc-ap', accountNumber: '2000', name: 'Accounts Payable', accountType: 'liability', isActive: true },
  { id: 'acc-eq', accountNumber: '3000', name: 'Owner Equity', accountType: 'equity', isActive: true },
  { id: 'acc-sales', accountNumber: '4000', name: 'Sales', accountType: 'revenue', isActive: true },
  { id: 'acc-cogs', accountNumber: '5000', name: 'Materials', accountType: 'cogs', isActive: true },
  { id: 'acc-oi', accountNumber: '7000', name: 'Interest Income', accountType: 'other_revenue', isActive: true },
  { id: 'acc-oe', accountNumber: '8000', name: 'Penalties', accountType: 'other_expense', isActive: true },
  { id: 'acc-old', accountNumber: '1999', name: 'Closed Savings', accountType: 'asset', isActive: false },
];

vi.mock('../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: { data: allAccounts, total: allAccounts.length }, isLoading: false, isError: false }),
}));

const glResponse = {
  title: 'General Ledger',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  fiscalYearStart: '2026-01-01',
  accounts: [
    {
      id: 'acc-bank', accountNumber: '1000', name: 'Checking', accountType: 'asset', normalBalance: 'debit',
      beginningBalance: 100, lines: [], periodDebits: 0, periodCredits: 0, endingBalance: 100,
    },
  ],
  totalDebits: 0,
  totalCredits: 0,
};

const apiClientMock = vi.fn(async (_path: string) => glResponse);

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (path: string) => apiClientMock(path) };
});

// Surface the export URL ReportShell receives so the test can assert it.
vi.mock('./ReportShell', () => ({
  ReportShell: ({ filters, children, exportBaseUrl }: { filters?: ReactNode; children?: ReactNode; exportBaseUrl?: string }) => (
    <div>
      <div data-testid="export-url">{exportBaseUrl}</div>
      {filters}
      {children}
    </div>
  ),
}));

import { GeneralLedgerReport } from './GeneralLedgerReport';

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  apiClientMock.mockClear();
});

const lastQuery = () => String(apiClientMock.mock.calls[apiClientMock.mock.calls.length - 1]![0]);

describe('GeneralLedgerReport account filter', () => {
  it('defaults to all accounts: no account_ids in the query or export URL', async () => {
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(apiClientMock).toHaveBeenCalled());
    expect(screen.getByText('All accounts')).toBeTruthy();
    expect(lastQuery()).not.toContain('account_ids');
    expect(screen.getByTestId('export-url').textContent).not.toContain('account_ids');
  });

  it('lists every active account of every type, grouped by type', async () => {
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(apiClientMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('All accounts'));

    for (const label of ['1000 — Checking', '2000 — Accounts Payable', '3000 — Owner Equity', '4000 — Sales',
      '5000 — Materials', '6000 — Rent', '7000 — Interest Income', '8000 — Penalties']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // Inactive accounts are not offered.
    expect(screen.queryByText(/Closed Savings/)).toBeNull();
    // Type headings, chart-of-accounts order.
    for (const heading of ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Cost of Goods Sold', 'Expenses', 'Other Revenue', 'Other Expenses']) {
      expect(screen.getByLabelText(`Select all ${heading}`)).toBeTruthy();
    }
  });

  it('search narrows the list by name or number', async () => {
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(apiClientMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('All accounts'));
    fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: 'rent' } });
    expect(screen.getByText('6000 — Rent')).toBeTruthy();
    expect(screen.queryByText('1000 — Checking')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: '20' } });
    expect(screen.getByText('2000 — Accounts Payable')).toBeTruthy();
    expect(screen.queryByText('6000 — Rent')).toBeNull();
  });

  it('a selection feeds account_ids into the query AND the export URL, and persists for the session', async () => {
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(apiClientMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('All accounts'));
    fireEvent.click(screen.getByText('1000 — Checking'));
    fireEvent.click(screen.getByText('6000 — Rent'));

    await waitFor(() => expect(lastQuery()).toContain('account_ids=acc-bank%2Cacc-rent'));
    expect(screen.getByTestId('export-url').textContent).toContain('account_ids=acc-bank%2Cacc-rent');
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(JSON.parse(window.sessionStorage.getItem('vibe:report-gl:accountIds')!)).toEqual(['acc-bank', 'acc-rent']);
  });

  it('a group heading selects every account of that type', async () => {
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(apiClientMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('All accounts'));
    fireEvent.click(screen.getByLabelText('Select all Expenses'));
    await waitFor(() => expect(lastQuery()).toContain('account_ids=acc-rent'));
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('hides account numbers in the options when the Account # option is off', async () => {
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(apiClientMock).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText(/Account #/));
    fireEvent.click(screen.getByText('All accounts'));
    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.queryByText('6000 — Rent')).toBeNull();
  });

  it('labels the totals as the selected accounts and skips the out-of-balance warning when filtered', async () => {
    apiClientMock.mockImplementation(async () => ({
      ...glResponse, totalDebits: 50, totalCredits: 0,
      accountFilter: { accounts: [{ id: 'acc-bank', accountNumber: '1000', name: 'Checking' }] },
    }));
    window.sessionStorage.setItem('vibe:report-gl:accountIds', JSON.stringify(['acc-bank']));
    renderRoute(<GeneralLedgerReport />);
    await waitFor(() => expect(screen.getByText('Total Activity (selected accounts)')).toBeTruthy());
    expect(screen.queryByText(/Out of balance/)).toBeNull();
    // The header lists the filtered accounts.
    expect(screen.getByText('Accounts: 1000 Checking')).toBeTruthy();
    apiClientMock.mockImplementation(async () => glResponse);
  });
});
