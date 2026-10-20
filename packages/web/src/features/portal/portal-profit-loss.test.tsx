// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PortalProfitLossPage:
//   - loads the P&L for the selected range with BASE_URL-prefixed URLs
//   - an error shows Retry
//   - clicking a row opens the account's transactions
//   - "Ask a question" posts the transactionId to the existing ask endpoint
//   - no ask button without questionsForUsAccess

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

let questionsForUsAccess = true;

vi.mock('./PortalLayout', () => ({
  usePortal: () => ({
    me: {
      contact: {
        id: 'c1', email: 'client@example.com', firstName: 'Cli', lastName: 'Ent',
        companies: [{ companyId: 'co1', companyName: 'Co', questionsForUsAccess, profitLossAccess: true }],
      },
      preview: null,
    },
    activeCompanyId: 'co1',
    fullName: 'Cli Ent',
    refresh: async () => {},
  }),
}));

import { PortalProfitLossPage } from './PortalProfitLossPage';

const labels = {
  revenue: 'Revenue', cogs: 'Cost of Goods Sold', grossProfit: 'Gross Profit', expenses: 'Expenses',
  operatingIncome: 'Operating Income', otherRevenue: 'Other Revenue', otherExpenses: 'Other Expenses', netIncome: 'Net Income',
};

const pl = {
  startDate: '2026-01-01', endDate: '2026-01-31', basis: 'accrual', labels,
  revenue: [{ accountId: 'a-sales', name: 'Sales', accountNumber: null, amount: 150 }], totalRevenue: 150,
  cogs: [], totalCogs: 0,
  expenses: [], totalExpenses: 0,
  otherRevenue: [], totalOtherRevenue: 0,
  otherExpenses: [], totalOtherExpenses: 0,
  grossProfit: null, operatingIncome: null, netIncome: 150,
};

const txns = {
  account: { id: 'a-sales', name: 'Sales', accountNumber: null },
  items: [{
    transactionId: 't1', date: '2026-01-05', type: 'deposit', number: null,
    payee: 'Acme Co', memo: 'January work', amount: 150,
  }],
  total: 1, sum: 150, page: 1, perPage: 50,
};

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
}

beforeEach(() => {
  questionsForUsAccess = true;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BASE_URL', '/mb/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function routeFetch(askResult?: () => Promise<Response>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/transactions')) return json(txns);
    if (url.includes('/questions/ask')) return askResult ? askResult() : json({ id: 'q1' }, 201);
    expect(init?.method ?? 'GET').toBe('GET');
    return json(pl);
  });
}

describe('PortalProfitLossPage', () => {
  it('loads the P&L with a BASE_URL-prefixed URL and shows totals', async () => {
    routeFetch();
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toMatch(/^\/mb\/api\/portal\/profit-loss\?companyId=co1&start_date=\d{4}-\d{2}-\d{2}&end_date=\d{4}-\d{2}-\d{2}$/);
    expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0);
  });

  it('shows an error with a working Retry', async () => {
    fetchMock.mockImplementationOnce(() => json({ error: { message: 'Boom' } }, 500));
    routeFetch();
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Boom')).toBeTruthy());
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
  });

  it('clicking a row lists its transactions and ask posts the transactionId', async () => {
    routeFetch();
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());

    fireEvent.click(screen.getByText('Sales'));
    await waitFor(() => expect(screen.getByText('Acme Co')).toBeTruthy());
    const drillUrl = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/transactions'));
    expect(drillUrl).toContain('/mb/api/portal/profit-loss/accounts/a-sales/transactions?companyId=co1');

    fireEvent.click(screen.getByText('Ask a question'));
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'What was this?' } });
    fireEvent.click(screen.getByText('Send question'));

    await waitFor(() => expect(screen.getByText(/Question sent/)).toBeTruthy());
    const ask = fetchMock.mock.calls.find((c) => String(c[0]).includes('/questions/ask'));
    expect(ask?.[0]).toBe('/mb/api/portal/questions/ask');
    expect(JSON.parse(String((ask?.[1] as RequestInit).body))).toEqual({
      companyId: 'co1', body: 'What was this?', transactionId: 't1',
    });
  });

  it('hides Ask a question without questionsForUsAccess', async () => {
    questionsForUsAccess = false;
    routeFetch();
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
    fireEvent.click(screen.getByText('Sales'));
    await waitFor(() => expect(screen.getByText('Acme Co')).toBeTruthy());
    expect(screen.queryByText('Ask a question')).toBeNull();
  });
});
