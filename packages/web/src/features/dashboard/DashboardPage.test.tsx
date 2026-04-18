// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock the API client so every /dashboard/summary request flows through
// a controllable vi.fn(). The dashboard previously made 9 requests; these
// tests verify the consolidated endpoint + its error handling.
const apiClientMock = vi.fn();
vi.mock('../../api/client', () => ({
  apiClient: (...args: unknown[]) => apiClientMock(...args),
}));

import { DashboardPage } from './DashboardPage';

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

// Pick distinct values for every numeric field so getByText assertions
// below don't false-match when two panels happen to share a formatted total.
const fullSummary = {
  snapshot: {
    mtd: { revenue: 1111, expenses: 444, netIncome: 667 },
    ytd: { revenue: 12345, expenses: 6789, netIncome: 5556 },
  },
  trend: { data: [
    { month: 'Jan 26', revenue: 1000, expenses: 500 },
    { month: 'Feb 26', revenue: 1200, expenses: 600 },
  ] },
  cashPosition: { bankAccounts: [{ name: 'Main Checking', balance: 8888 }], creditCards: [], totalBank: 8888, totalCC: 0 },
  receivables: { totalOutstanding: 2000, overdueCount: 1, overdueAmount: 500, invoiceCount: 3 },
  payables: {
    totalOwed: 800, billCount: 2, overdueCount: 0, overdueAmount: 0,
    dueThisWeekCount: 1, dueThisWeekAmount: 400,
    creditCount: 0, creditAmount: 0, apBalance: 800,
  },
  actionItems: {
    pendingFeedCount: 0, overdueInvoiceCount: 1, staleReconciliations: [],
    pendingDepositCount: 0, pendingDepositAmount: 0,
    printQueueCount: 0, printQueueAmount: 0,
  },
  budgetPerformance: null,
  bankingHealth: { totalConnections: 1, needsAttention: 0, needsAttentionItems: [], pendingFeedItems: 0 },
  errors: [],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('renders stat cards with formatted totals when the summary succeeds', async () => {
    apiClientMock.mockResolvedValueOnce(fullSummary);
    wrap(<DashboardPage />);
    // Wait for initial load to complete — the tile title appears only
    // after the spinner resolves.
    expect(await screen.findByText('Net Income (YTD)')).toBeInTheDocument();
    expect(screen.getByText('$5,556.00')).toBeInTheDocument(); // ytd.netIncome
    expect(screen.getByText('$12,345.00')).toBeInTheDocument(); // ytd.revenue
    expect(screen.getByText('$6,789.00')).toBeInTheDocument(); // ytd.expenses
    // totalBank appears in the stat card + in the bank-account list below,
    // so accept >=1 match.
    expect(screen.getAllByText('$8,888.00').length).toBeGreaterThanOrEqual(1);
    // Error banner absent.
    expect(screen.queryByText(/couldn't load part of the dashboard/i)).not.toBeInTheDocument();
  });

  it('surfaces the server-reported per-panel error labels in the banner', async () => {
    apiClientMock.mockResolvedValueOnce({
      ...fullSummary,
      receivables: null,
      errors: ['Receivables'],
    });
    wrap(<DashboardPage />);
    // Scope the assertion to the banner — "Receivables" appears as a
    // stat / panel label elsewhere on the page.
    const banner = (await screen.findByText(/couldn't load part of the dashboard/i)).closest('div');
    expect(banner).not.toBeNull();
    expect(within(banner!.parentElement!).getByText('Receivables')).toBeInTheDocument();
    expect(within(banner!.parentElement!).getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows placeholder em-dashes in stat cards when the summary request itself fails', async () => {
    apiClientMock.mockRejectedValueOnce(new Error('network down'));
    wrap(<DashboardPage />);
    // The page still renders, with — in place of zeros and the banner shown.
    expect(await screen.findByText(/couldn't load part of the dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('Dashboard summary')).toBeInTheDocument();
    // Every stat value should be —.
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('re-fires the consolidated query when Retry is clicked', async () => {
    const user = userEvent.setup();
    // React concurrent scheduling occasionally double-renders a component
    // before reaching a stable state; we only care that Retry produces
    // strictly more fetches than the initial render, not an exact count.
    apiClientMock.mockImplementation(async () => ({
      ...fullSummary, receivables: null, errors: ['Receivables'],
    }));
    wrap(<DashboardPage />);
    expect(await screen.findByText(/couldn't load part of the dashboard/i)).toBeInTheDocument();
    const callsBeforeRetry = apiClientMock.mock.calls.length;
    // Swap to a successful response for the retry.
    apiClientMock.mockImplementation(async () => ({ ...fullSummary, errors: [] }));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText('$5,556.00');
    expect(apiClientMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});
