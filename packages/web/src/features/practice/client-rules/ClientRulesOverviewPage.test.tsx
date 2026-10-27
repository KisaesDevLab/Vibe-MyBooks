// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import type { ClientRulesOverviewRow } from '@kis-books/shared';
import { renderRoute } from '../../../test-utils';

const apiClient = vi.fn();
vi.mock('../../../api/client', () => ({
  apiClient: (...args: unknown[]) => apiClient(...args),
  setTokens: vi.fn(),
}));
vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ clearActiveCompany: vi.fn() }),
}));

import { ClientRulesOverviewPage } from './ClientRulesOverviewPage';

function row(overrides: Partial<ClientRulesOverviewRow>): ClientRulesOverviewRow {
  return {
    tenantId: 't0', tenantName: 'Client', firmId: 'f1', tieredRules: true, pendingItems: 0, truncated: false,
    rulesMatched: 0, matched: 0, ready: 0, needsMapping: 0, needsReview: 0,
    rules: [], unmappedAccounts: [],
    unreadDocuments: 0, openDocumentRequests: 0, overdueDocumentRequests: 0, openQuestions: 0,
    excluded: false,
    error: null,
    ...overrides,
  };
}

const ACME = row({
  tenantId: 't1', tenantName: 'Acme LLC', pendingItems: 50, rulesMatched: 2, matched: 40, ready: 37,
  needsMapping: 3,
  rules: [
    { ruleId: 'r1', ruleName: 'Adobe → Software', scope: 'global_firm', matched: 12, ready: 9, needsMapping: 3, needsReview: 0 },
    { ruleId: 'r2', ruleName: 'Bank fees', scope: 'tenant_firm', matched: 28, ready: 28, needsMapping: 0, needsReview: 0 },
  ],
  unmappedAccounts: [{ sourceAccountId: 'src1', sourceAccountName: 'Software & Subscriptions', sourceAccountNumber: '6420', sourceAccountType: 'expense', items: 3 }],
  unreadDocuments: 2, openDocumentRequests: 3, overdueDocumentRequests: 1, openQuestions: 4,
});
const BAKER = row({ tenantId: 't2', tenantName: 'Baker Dental', pendingItems: 12, rulesMatched: 1, matched: 12, ready: 12 });
const QUIET = row({ tenantId: 't3', tenantName: 'Quiet Co' });

const HELD = row({ tenantId: 't4', tenantName: 'Held Back Inc', pendingItems: 9, rulesMatched: 1, matched: 9, ready: 9, excluded: true });

function mockApi() {
  apiClient.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/practice/client-rules-overview?')) {
      const params = new URL(`http://x${path}`).searchParams;
      const data = params.get('includeExcluded') === 'true' ? [ACME, BAKER, QUIET, HELD] : [ACME, BAKER, QUIET];
      return Promise.resolve({ data, total: data.length, excludedTotal: 1, limit: Number(params.get('limit')), offset: 0 });
    }
    if (path.endsWith('/exclusion')) {
      return Promise.resolve(JSON.parse(String(init?.body)));
    }
    if (path === '/practice/client-rules-overview/post') {
      const body = JSON.parse(String(init?.body)) as { tenantIds: string[] };
      return Promise.resolve({
        results: body.tenantIds.map((id) => ({ tenantId: id, posted: 5, skipped: 0, failed: 0, failures: [], more: false, error: null })),
        posted: 5 * body.tenantIds.length,
        failed: 0,
      });
    }
    if (path.endsWith('/mapping-options')) {
      return Promise.resolve({
        accounts: [{ id: 'acct-a', name: 'Computer Expense', accountNumber: '6100', accountType: 'expense' }],
        mappings: [],
      });
    }
    if (path.endsWith('/mappings')) return Promise.resolve({ sourceAccountId: 'src1', accountId: 'acct-a' });
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

const rowFor = (name: string) => screen.getByText(name).closest('tr')!;
const confirmPost = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post' }));
const postCalls = () => apiClient.mock.calls.filter(([p]) => p === '/practice/client-rules-overview/post');
const lastListQuery = () => {
  const calls = apiClient.mock.calls.filter(([p]) => String(p).startsWith('/practice/client-rules-overview?'));
  return new URL(`http://x${String(calls[calls.length - 1]![0])}`).searchParams;
};

beforeEach(() => {
  apiClient.mockReset();
  mockApi();
});

describe('ClientRulesOverviewPage', () => {
  it('shows counts per client, not transactions', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    await screen.findByText('Acme LLC');
    const acme = rowFor('Acme LLC');
    const cells = within(acme).getAllByRole('cell').map((c) => c.textContent);
    // rules matched, matched, ready, needs mapping, unread docs, open requests, open questions
    expect(cells.slice(2, 9)).toEqual(['2', '40', '37', '3', '2', '31 overdue', '4']);
  });

  it('posts one client from its row after confirming', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    await screen.findByText('Acme LLC');
    fireEvent.click(within(rowFor('Baker Dental')).getByRole('button', { name: 'Post' }));
    expect(await screen.findByText(/12 ready transactions for Baker Dental/)).toBeTruthy();
    confirmPost();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(JSON.parse(String(postCalls()[0]![1]!.body))).toEqual({ tenantIds: ['t2'] });
  });

  it('posts selected clients one request per client', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    await screen.findByText('Acme LLC');
    // A client with nothing ready can't be selected.
    expect((screen.getByLabelText('Select Quiet Co') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Select all clients with ready transactions'));
    fireEvent.click(screen.getByRole('button', { name: 'Post selected (2)' }));
    expect(await screen.findByText(/49 ready transactions across 2 clients/)).toBeTruthy();
    confirmPost();
    await waitFor(() => expect(postCalls()).toHaveLength(2));
    expect(postCalls().map(([, init]) => JSON.parse(String(init!.body)).tenantIds)).toEqual([['t1'], ['t2']]);
  });

  it('expands a client to post a single rule and map an unmapped account', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acme LLC' }));
    expect(screen.getByText('Adobe → Software')).toBeTruthy();
    expect(screen.getByText('Global')).toBeTruthy();

    const select = await screen.findByLabelText('Account in Acme LLC for Software & Subscriptions');
    fireEvent.change(select, { target: { value: 'acct-a' } });
    fireEvent.click(within(select.closest('li')!).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const call = apiClient.mock.calls.find(([p]) => p === '/practice/client-rules-overview/tenants/t1/mappings');
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ sourceAccountId: 'src1', accountId: 'acct-a' });
    });

    const ruleRow = screen.getByText('Bank fees').closest('tr')!;
    fireEvent.click(within(ruleRow).getByRole('button', { name: 'Post' }));
    expect(await screen.findByText(/28 transactions matched by “Bank fees” for Acme LLC/)).toBeTruthy();
    confirmPost();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(JSON.parse(String(postCalls()[0]![1]!.body))).toEqual({ tenantIds: ['t1'], ruleIds: ['r2'] });
  });

  it('sorts server-side: counters open descending, a second click flips, name opens ascending', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    await screen.findByText('Acme LLC');
    expect(lastListQuery().get('sortBy')).toBe('tenantName');
    expect(lastListQuery().get('sortDir')).toBe('asc');

    const readyHeader = () => screen.getByRole('columnheader', { name: /ready to post/i });
    fireEvent.click(within(readyHeader()).getByRole('button'));
    await waitFor(() => expect(lastListQuery().get('sortBy')).toBe('ready'));
    expect(lastListQuery().get('sortDir')).toBe('desc');
    expect(readyHeader().getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(within(readyHeader()).getByRole('button'));
    await waitFor(() => expect(lastListQuery().get('sortDir')).toBe('asc'));
    expect(readyHeader().getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(screen.getByRole('button', { name: /^client/i }));
    await waitFor(() => expect(lastListQuery().get('sortBy')).toBe('tenantName'));
    expect(lastListQuery().get('sortDir')).toBe('asc');
    expect(lastListQuery().get('offset')).toBe('0');
  });

  it('lets the user pick the page size', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    await screen.findByText('Acme LLC');
    expect(lastListQuery().get('limit')).toBe('25');
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
    await waitFor(() => expect(lastListQuery().get('limit')).toBe('50'));
    expect(lastListQuery().get('offset')).toBe('0');
  });

  it('hides excluded clients until asked, then shows them without a way to post', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    await screen.findByText('Acme LLC');
    expect(screen.queryByText('Held Back Inc')).toBeNull();
    expect(lastListQuery().get('includeExcluded')).toBeNull();

    fireEvent.click(screen.getByLabelText('Show excluded clients (1)'));
    const held = (await screen.findByText('Held Back Inc')).closest('tr')!;
    expect(within(held).getByText('Excluded')).toBeTruthy();
    expect((within(held).getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Select Held Back Inc') as HTMLInputElement).disabled).toBe(true);

    // Bring it back from the detail panel.
    fireEvent.click(within(held).getByRole('button', { name: 'Held Back Inc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Include in bulk posting' }));
    await waitFor(() => {
      const call = apiClient.mock.calls.find(([p]) => p === '/practice/client-rules-overview/tenants/t4/exclusion');
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ excluded: false });
    });
  });

  it('excludes a client from its detail panel', async () => {
    renderRoute(<ClientRulesOverviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Baker Dental' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exclude from bulk posting' }));
    await waitFor(() => {
      const call = apiClient.mock.calls.find(([p]) => p === '/practice/client-rules-overview/tenants/t2/exclusion');
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ excluded: true });
    });
  });

  it('shows a friendly empty state', async () => {
    apiClient.mockImplementation(() => Promise.resolve({ data: [], total: 0, excludedTotal: 0, limit: 25, offset: 0 }));
    renderRoute(<ClientRulesOverviewPage />);
    expect(await screen.findByText(/don’t have access to any clients/)).toBeTruthy();
  });

  it('shows an error state with retry', async () => {
    apiClient.mockImplementation(() => Promise.reject(new Error('boom')));
    renderRoute(<ClientRulesOverviewPage />);
    expect(await screen.findByText('Could not load the client rules overview.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
