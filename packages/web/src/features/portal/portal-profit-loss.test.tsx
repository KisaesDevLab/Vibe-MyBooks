// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PortalProfitLossPage:
//   - loads the P&L for the selected range with BASE_URL-prefixed URLs
//   - an error shows Retry
//   - the unposted bank feed line is plain text (no drill-down), shows money
//     in and out apart, sits after the percentages note, and appears only
//     when the API sends it with something waiting
//   - an invalid date range hides the statement instead of leaving the old
//     one (or the skeleton) on screen
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
  unpostedBankFeed: { count: 3, moneyIn: 234.5, moneyOut: 1000, amount: 1234.5 },
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

  it('shows the unposted bank feed line as plain text, not a drill-down', async () => {
    routeFetch();
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Bank transactions not yet reviewed')).toBeTruthy());
    const line = screen.getByTestId('unposted-bank-feed');
    expect(line.textContent).toContain('3 transactions in this period');
    // Money in and out apart, never one figure that reads like a missing total.
    expect(line.textContent).toContain('Money in$234.50');
    expect(line.textContent).toContain('Money out$1,000.00');
    expect(line.textContent).not.toContain('$1,234.50');
    expect(line.querySelector('button')).toBeNull();
    expect(line.closest('button')).toBeNull();
    // Clicking it opens nothing.
    fireEvent.click(screen.getByText('Bank transactions not yet reviewed'));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The percentages note stays with the table it explains.
    const note = screen.getByText('Percentages are shares of total revenue.');
    expect(note.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('still shows the unposted line when the P&L is empty', async () => {
    fetchMock.mockImplementation(() => json({
      ...pl, revenue: [], totalRevenue: 0, netIncome: 0, unpostedBankFeed: { count: 1, moneyIn: 0, moneyOut: 75, amount: 75 },
    }));
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText(/No income or expenses were recorded/)).toBeTruthy());
    const line = screen.getByTestId('unposted-bank-feed');
    expect(line.textContent).toContain('$75.00');
    expect(line.textContent).toContain('1 transaction in this period');
  });

  it('shows one gross total when the API sends no in/out split', async () => {
    fetchMock.mockImplementation(() => json({ ...pl, unpostedBankFeed: { count: 2, amount: 310 } }));
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByTestId('unposted-bank-feed')).toBeTruthy());
    expect(screen.getByTestId('unposted-bank-feed').textContent).toContain('Total in and out$310.00');
  });

  it('shows no unposted line when the API leaves the field off', async () => {
    // An engine without the field, or a contact without banking access.
    const { unpostedBankFeed: _omitted, ...withoutField } = pl;
    fetchMock.mockImplementation(() => json(withoutField));
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
    expect(screen.queryByTestId('unposted-bank-feed')).toBeNull();
  });

  it('shows no unposted line when nothing is waiting', async () => {
    fetchMock.mockImplementation(() => json({
      ...pl, unpostedBankFeed: { count: 0, moneyIn: 0, moneyOut: 0, amount: 0 },
    }));
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
    expect(screen.queryByTestId('unposted-bank-feed')).toBeNull();
  });

  it('hides the statement while the date range is invalid, and brings it back', async () => {
    routeFetch();
    renderRoute(<PortalProfitLossPage />);
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
    const from = screen.getByLabelText('From') as HTMLInputElement;
    const valid = from.value;

    fireEvent.change(from, { target: { value: '2999-01-01' } });
    await waitFor(() => expect(screen.getByText('Choose a start date on or before the end date.')).toBeTruthy());
    expect(screen.queryByText('Sales')).toBeNull();
    expect(screen.queryByTestId('unposted-bank-feed')).toBeNull();
    expect(screen.queryByLabelText('Loading profit and loss')).toBeNull();

    fireEvent.change(from, { target: { value: valid } });
    await waitFor(() => expect(screen.getByText('Sales')).toBeTruthy());
  });

  it('does not stick on the skeleton when the range turns invalid mid-load', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    renderRoute(<PortalProfitLossPage />);
    expect(screen.getByLabelText('Loading profit and loss')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } });
    await waitFor(() => expect(screen.queryByLabelText('Loading profit and loss')).toBeNull());
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
