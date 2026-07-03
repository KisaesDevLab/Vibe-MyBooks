// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Balance Sheet rendering: the closing "Total Liabilities & Equity" row
// (task: "where is total of liabilities and equity?"), accounting-style
// parentheses for negatives, and the group-by-detail-type mode.

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  companyMocks, tagsMocks, companyProviderMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());

const baseBS = {
  asOfDate: '2026-06-30',
  labels: undefined,
  footer: '',
  assets: [
    { accountId: 'a1', accountNumber: '1000', name: 'Checking', balance: 48000, detailType: 'bank' },
  ],
  liabilities: [
    { accountId: 'l1', accountNumber: '20000', name: 'Bank Loan', balance: 8000, detailType: 'long_term_liability' },
  ],
  equity: [
    { accountId: 'e1', accountNumber: '30170', name: 'Owner Withdraw', balance: -10000, detailType: 'owners_equity' },
    { accountId: null, accountNumber: null, name: 'Net Income (Current Year)', balance: 50000 },
  ],
  totalAssets: 48000,
  totalLiabilities: 8000,
  totalEquity: 40000,
  totalLiabilitiesAndEquity: 48000,
};

const groupedBS = {
  ...baseBS,
  groupBy: 'detail_type',
  groups: {
    assets: [
      { detailType: 'bank', label: 'Bank', entries: baseBS.assets, subtotal: 48000 },
    ],
    liabilities: [
      { detailType: 'long_term_liability', label: 'Long Term Liability', entries: baseBS.liabilities, subtotal: 8000 },
    ],
    equity: [
      { detailType: 'owners_equity', label: 'Owners Equity', entries: [baseBS.equity[0]], subtotal: -10000 },
      { detailType: null, label: 'Equity (Calculated)', entries: [baseBS.equity[1]], subtotal: 50000 },
    ],
  },
};

const apiClientMock = vi.fn(async (path: string) =>
  path.includes('group_by=detail_type') ? groupedBS : baseBS);

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (path: string) => apiClientMock(path) };
});

import { BalanceSheetReport } from './BalanceSheetReport';

describe('BalanceSheetReport', () => {
  it('renders the Total Liabilities & Equity grand total with the correct sum', async () => {
    renderRoute(<BalanceSheetReport />);
    await waitFor(() => {
      expect(screen.getByText('Total Liabilities & Equity')).toBeTruthy();
    });
    // 8,000 liabilities + 40,000 equity = 48,000 — appears for both
    // Total Assets and the grand total.
    expect(screen.getAllByText('$48,000.00').length).toBeGreaterThanOrEqual(2);
  });

  it('renders negative balances in accounting parentheses', async () => {
    renderRoute(<BalanceSheetReport />);
    await waitFor(() => {
      expect(screen.getByText('($10,000.00)')).toBeTruthy();
    });
  });

  it('group-by-detail-type toggle renders group headers, subtotals, and Equity (Calculated)', async () => {
    renderRoute(<BalanceSheetReport />);
    await waitFor(() => expect(screen.getByText('Total Liabilities & Equity')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Group by detail type'));

    await waitFor(() => {
      expect(screen.getByText('Equity (Calculated)')).toBeTruthy();
    });
    expect(screen.getByText('Bank')).toBeTruthy();
    expect(screen.getByText('Total Equity (Calculated)')).toBeTruthy();
    // Section totals unchanged in grouped mode.
    expect(screen.getByText('Total Liabilities & Equity')).toBeTruthy();
    // The request actually carried the grouping param.
    expect(apiClientMock.mock.calls.some(([p]) => String(p).includes('group_by=detail_type'))).toBe(true);
  });
});
