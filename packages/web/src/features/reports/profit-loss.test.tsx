// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// P&L "% of Revenue" toggle: percentages on account rows, section
// totals, and subtotals; em dash when total revenue is zero.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { companyMocks, tagsMocks, companyProviderMocks } from '../../test-mocks';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());

const basePL = {
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  basis: 'accrual',
  labels: undefined,
  footer: '',
  revenue: [
    { accountId: 'r1', accountNumber: '4000', name: 'Consulting', amount: 8000 },
    { accountId: 'r2', accountNumber: '4900', name: 'Refunds', amount: -2000 },
  ],
  totalRevenue: 6000,
  cogs: [],
  totalCogs: 0,
  grossProfit: null,
  expenses: [
    { accountId: 'e1', accountNumber: '6000', name: 'Rent', amount: 1500 },
  ],
  totalExpenses: 1500,
  operatingIncome: null,
  otherRevenue: [],
  totalOtherRevenue: 0,
  otherExpenses: [],
  totalOtherExpenses: 0,
  netIncome: 4500,
};

let plResponse: Record<string, unknown> = basePL;
const apiClientMock = vi.fn(async (_path: string) => plResponse);

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (path: string) => apiClientMock(path) };
});

import { ProfitAndLossReport } from './ProfitAndLossReport';

beforeEach(() => {
  window.sessionStorage.clear();
  plResponse = basePL;
});

describe('ProfitAndLossReport % of Revenue', () => {
  it('is off by default and shows percentages once toggled', async () => {
    renderRoute(<ProfitAndLossReport />);
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeTruthy());
    expect(screen.queryByText('100.0%')).toBeNull();

    fireEvent.click(screen.getByLabelText('% of Revenue'));

    // Total Revenue row = 100.0%; account rows scale to revenue;
    // negatives are negative; net income row gets one too.
    await waitFor(() => expect(screen.getByText('100.0%')).toBeTruthy());
    expect(screen.getByText('133.3%')).toBeTruthy();  // 8000 / 6000
    expect(screen.getByText('-33.3%')).toBeTruthy();  // -2000 / 6000
    expect(screen.getAllByText('25.0%').length).toBeGreaterThanOrEqual(1); // 1500 / 6000
    expect(screen.getByText('75.0%')).toBeTruthy();   // 4500 / 6000
  });

  it('renders an em dash for every percentage when total revenue is zero', async () => {
    plResponse = { ...basePL, revenue: [], totalRevenue: 0, netIncome: -1500 };
    renderRoute(<ProfitAndLossReport />);
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('% of Revenue'));
    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    });
    expect(screen.queryByText(/Infinity|NaN/)).toBeNull();
  });

  it('persists the toggle for the session (sessionStorage)', async () => {
    renderRoute(<ProfitAndLossReport />);
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('% of Revenue'));
    expect(window.sessionStorage.getItem('vibe:report-pl:showPct')).toBe('true');
  });
});
