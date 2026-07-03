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

// Comparative fixture (previous-year mode) with per-section detail-type
// groups whose subtotal rows carry values for every column.
const compRevenueRow = { accountId: 'r1', account: 'Consulting', accountNumber: '4000', accountType: 'revenue', values: [8000, 6000, 2000, 33.3], detailType: 'service' };
const compExpenseRow = { accountId: 'e1', account: 'Rent', accountNumber: '6000', accountType: 'expense', values: [1500, 1500, 0, 0], detailType: 'rent_or_lease' };
const comparativePL = {
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  comparisonMode: 'previous_year',
  labels: undefined,
  footer: '',
  columns: [
    { label: 'Jan – Jun 2026', startDate: '2026-01-01', endDate: '2026-06-30' },
    { label: 'Jan – Jun 2025', startDate: '2025-01-01', endDate: '2025-06-30' },
    { label: '$ Change', type: 'variance' },
    { label: '% Change', type: 'percent_variance' },
  ],
  rows: [compRevenueRow, compExpenseRow],
  totalRevenue: [8000, 6000, 2000, 33.3],
  totalCogs: [0, 0, 0, null],
  totalExpenses: [1500, 1500, 0, 0],
  netIncome: [6500, 4500, 2000, 44.4],
};
const comparativeGroups = {
  revenue: [{ detailType: 'service', label: 'Service', rows: [compRevenueRow], values: [8000, 6000, 2000, 33.3] }],
  cogs: [],
  expenses: [{ detailType: 'rent_or_lease', label: 'Rent Or Lease', rows: [compExpenseRow], values: [1500, 1500, 0, 0] }],
  otherRevenue: [],
  otherExpenses: [],
};

let plResponse: Record<string, unknown> = basePL;
const apiClientMock = vi.fn(async (path: string) => {
  if (path.includes('compare=')) {
    return path.includes('group_by=detail_type')
      ? { ...comparativePL, groupBy: 'detail_type', groups: comparativeGroups }
      : comparativePL;
  }
  return plResponse;
});

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

describe('ProfitAndLossReport comparative grouping', () => {
  async function renderComparative() {
    renderRoute(<ProfitAndLossReport />);
    await waitFor(() => expect(screen.getByText('Total Revenue')).toBeTruthy());
    // Switch to a comparison mode; the option keeps grouping available.
    fireEvent.change(screen.getByDisplayValue('No Comparison'), { target: { value: 'previous_year' } });
    await waitFor(() => expect(screen.getByText('$ Change')).toBeTruthy());
  }

  it('keeps the grouping option in comparison mode and renders per-column group subtotals', async () => {
    await renderComparative();
    // Selector still present and functional with a comparison active.
    fireEvent.change(screen.getByLabelText('Report display mode'), { target: { value: 'grouped' } });
    await waitFor(() => expect(screen.getByText('Service')).toBeTruthy());
    // Group header + member account + per-column subtotal row.
    expect(screen.getByText(/Consulting/)).toBeTruthy();
    expect(screen.getByText('Total Service')).toBeTruthy();
    expect(screen.getByText('Total Rent Or Lease')).toBeTruthy();
    // Request carried the grouping param alongside compare.
    expect(apiClientMock.mock.calls.some(([p]) => String(p).includes('compare=previous_year') && String(p).includes('group_by=detail_type'))).toBe(true);
  });

  it('condensed comparison shows only group subtotal rows', async () => {
    await renderComparative();
    fireEvent.change(screen.getByLabelText('Report display mode'), { target: { value: 'condensed' } });
    await waitFor(() => expect(screen.getByText('Service')).toBeTruthy());
    // Account rows hidden; group + section totals remain.
    expect(screen.queryByText(/Consulting/)).toBeNull();
    expect(screen.queryByText(/4000/)).toBeNull();
    expect(screen.getByText('Rent Or Lease')).toBeTruthy();
    expect(screen.getByText('Total Revenue')).toBeTruthy();
    expect(screen.getByText('Total Expenses')).toBeTruthy();
  });
});
