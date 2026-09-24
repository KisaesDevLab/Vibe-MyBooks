// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The dashboard's work-queue row: four counts of things waiting on a person.
// Each is the number its own screen shows, each card goes to that screen, and
// a count the tenant's features do not provide is hidden rather than shown as
// a zero that would read as "nothing to do".

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const apiClientMock = vi.fn();
vi.mock('../../api/client', () => ({ apiClient: (...args: unknown[]) => apiClientMock(...args) }));
vi.mock('../../hooks/usePracticeVisibility', () => ({
  usePracticeVisibility: () => ({
    ready: true, showGroup: false, items: [], sections: { 'close-cycle': [], 'client-communication': [] },
  }),
}));
vi.mock('../../api/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, permissions: undefined, ready: true }),
}));

import { DashboardPage } from './DashboardPage';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}<LocationProbe /></MemoryRouter>
    </QueryClientProvider>,
  );
}

let workQueue: unknown = {
  uncategorized: { notPosted: 5, inSuspense: 42, total: 47 },
  openQuestions: 3,
  openRequests: 2,
  statementsPendingReview: 1,
};

beforeEach(() => {
  apiClientMock.mockReset();
  apiClientMock.mockImplementation((path: string) =>
    String(path).startsWith('/dashboard/summary')
      ? Promise.resolve({
          snapshot: { mtd: { revenue: 0, expenses: 0, netIncome: 0 }, ytd: { revenue: 0, expenses: 0, netIncome: 0 } },
          trend: { data: [] }, cashPosition: null, receivables: null, payables: null,
          actionItems: null, budgetPerformance: null, bankingHealth: null, portalActivity: null,
          workQueue, errors: [],
        })
      : Promise.resolve({}));
});

describe('dashboard work queue', () => {
  it('shows each count and links to the screen that owns it', async () => {
    workQueue = {
      uncategorized: { notPosted: 5, inSuspense: 42, total: 47 },
      openQuestions: 3, openRequests: 2, statementsPendingReview: 1,
    };
    wrap(<DashboardPage />);
    expect(await screen.findByText('Uncategorized')).toBeTruthy();
    expect(screen.getByText('47')).toBeTruthy();
    expect(screen.getByText('5 not posted · 42 in suspense')).toBeTruthy();
    expect(screen.getByText('Open questions')).toBeTruthy();
    expect(screen.getByText('Open document requests')).toBeTruthy();

    fireEvent.click(screen.getByText('Uncategorized'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/practice/uncategorized'));
  });

  it('hides a count the tenant\'s features do not provide', async () => {
    workQueue = { uncategorized: null, openQuestions: null, openRequests: null, statementsPendingReview: 4 };
    wrap(<DashboardPage />);
    expect(await screen.findByText('Statements to review')).toBeTruthy();
    // A zero here would read as "nothing to do" rather than "not turned on".
    expect(screen.queryByText('Uncategorized')).toBeNull();
    expect(screen.queryByText('Open questions')).toBeNull();
    expect(screen.queryByText('Open document requests')).toBeNull();
  });

  it('renders no row at all when the panel failed', async () => {
    workQueue = null;
    wrap(<DashboardPage />);
    await waitFor(() => expect(screen.queryByText('Statements to review')).toBeNull());
    expect(screen.queryByText('Uncategorized')).toBeNull();
  });
});
