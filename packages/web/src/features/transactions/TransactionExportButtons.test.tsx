// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  transactionsMocks, accountsMocks, contactsMocks, tagsMocks, companyMocks, companyProviderMocks,
} from '../../test-mocks';

const openReportPdf = vi.fn(async (..._args: unknown[]) => ({ skippedAttachments: 0 }));
const fetchWithSession = vi.fn(async (..._args: unknown[]): Promise<Response> => new Response('x'));
vi.mock('./openReportPdf', () => ({
  openReportPdf: (...args: unknown[]) => openReportPdf(...args),
  fetchWithSession: (...args: unknown[]) => fetchWithSession(...args),
}));
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());

import { TransactionExportButtons, transactionExportPath } from './TransactionExportButtons';
import { TransactionListPage } from './TransactionListPage';

function csvResponse(headers: Record<string, string> = {}) {
  return new Response('"Date"\r\n', {
    status: 200,
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="Transactions_2026-10-12.csv"', 'X-Export-Truncated': 'false', 'X-Export-Row-Count': '1', ...headers },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  openReportPdf.mockReset();
  openReportPdf.mockResolvedValue({ skippedAttachments: 0 });
  fetchWithSession.mockReset();
  fetchWithSession.mockResolvedValue(csvResponse());
  try { localStorage.clear(); } catch { /* ignore */ }
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  // jsdom cannot navigate to a download link.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('transactionExportPath', () => {
  it('passes every active filter and the sort, drops blanks and paging', () => {
    const p = transactionExportPath({
      txnType: 'expense', status: '', accountId: 'a1', contactId: 'c1', tagId: 't1', basis: 'cash',
      startDate: '2026-01-01', endDate: '2026-03-31', search: 'paper & ink', sortBy: 'amount', sortDir: 'asc', source: '',
    }, 'csv');
    const [path, qs] = p.split('?');
    expect(path).toBe('/transactions/export');
    const q = new URLSearchParams(qs);
    expect(Object.fromEntries(q)).toEqual({
      format: 'csv', txnType: 'expense', accountId: 'a1', contactId: 'c1', tagId: 't1', basis: 'cash',
      startDate: '2026-01-01', endDate: '2026-03-31', search: 'paper & ink', sortBy: 'amount', sortDir: 'asc',
    });
  });

  it('sends a direction only with a sort column, and the time zone for the PDF', () => {
    const q = new URLSearchParams(transactionExportPath({ sortDir: 'asc' }, 'pdf').split('?')[1]);
    expect(q.get('sortDir')).toBeNull();
    expect(q.get('format')).toBe('pdf');
    expect(q.get('tz')).toBeTruthy();
  });
});

describe('TransactionExportButtons', () => {
  it('opens the PDF for the current filters', async () => {
    renderRoute(<TransactionExportButtons filters={{ accountId: 'a1', sortBy: 'date', sortDir: 'asc' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Print \/ PDF/ }));
    await waitFor(() => expect(openReportPdf).toHaveBeenCalledTimes(1));
    const [path, opts] = openReportPdf.mock.calls[0]! as [string, { title: string }];
    expect(path).toMatch(/^\/transactions\/export\?format=pdf&accountId=a1&sortBy=date&sortDir=asc/);
    expect(opts.title).toBe('Transactions');
  });

  it('downloads the CSV and disables both buttons while it runs', async () => {
    let finish: (r: Response) => void = () => {};
    fetchWithSession.mockImplementationOnce(() => new Promise<Response>((r) => { finish = r; }));
    renderRoute(<TransactionExportButtons filters={{ txnType: 'deposit' }} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Print \/ PDF/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: /CSV/ })).toBeDisabled();
    expect(fetchWithSession.mock.calls[0]![0]).toBe('/transactions/export?format=csv&txnType=deposit');
    finish(csvResponse());
    await waitFor(() => expect(screen.getByRole('button', { name: /CSV/ })).not.toBeDisabled());
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the server error when the export fails', async () => {
    fetchWithSession.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'You do not have permission for this feature' } }), { status: 403 }));
    renderRoute(<TransactionExportButtons filters={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission for this feature');
    openReportPdf.mockRejectedValueOnce(new Error('Could not build the report (500)'));
    fireEvent.click(screen.getByRole('button', { name: /Print \/ PDF/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not build the report (500)'));
  });

  it('tells the operator when the CSV was capped', async () => {
    fetchWithSession.mockResolvedValueOnce(csvResponse({ 'X-Export-Truncated': 'true', 'X-Export-Row-Count': '50000' }));
    renderRoute(<TransactionExportButtons filters={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('capped at 50,000 transactions');
  });
});

describe('TransactionListPage export buttons', () => {
  it('export the list’s URL filters and sort, not just the visible page', async () => {
    renderRoute(<TransactionListPage />, {
      route: '/transactions?type=expense&status=posted&account=a1&tagId=t1&from=2026-01-01&to=2026-06-30&q=rent&sortBy=amount&sortDir=asc&offset=100&pageSize=50',
      path: '/transactions',
    });
    fireEvent.click(screen.getByRole('button', { name: /Print \/ PDF/ }));
    await waitFor(() => expect(openReportPdf).toHaveBeenCalledTimes(1));
    const q = new URLSearchParams(String(openReportPdf.mock.calls[0]![0]).split('?')[1]);
    expect(q.get('txnType')).toBe('expense');
    expect(q.get('status')).toBe('posted');
    expect(q.get('accountId')).toBe('a1');
    expect(q.get('tagId')).toBe('t1');
    expect(q.get('startDate')).toBe('2026-01-01');
    expect(q.get('endDate')).toBe('2026-06-30');
    expect(q.get('search')).toBe('rent');
    expect(q.get('sortBy')).toBe('amount');
    expect(q.get('sortDir')).toBe('asc');
    expect(q.get('offset')).toBeNull();
    expect(q.get('limit')).toBeNull();
  });
});
