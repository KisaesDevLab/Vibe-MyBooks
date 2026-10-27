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
    tenantId: 't0', tenantName: 'Client', firmId: 'f1', pendingItems: 0, truncated: false,
    rulesMatched: 0, matched: 0, ready: 0, needsMapping: 0, needsReview: 0,
    rules: [], unmappedAccounts: [],
    unreadDocuments: 0, openDocumentRequests: 0, overdueDocumentRequests: 0, openQuestions: 0,
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
  unmappedAccounts: [{ sourceAccountId: 'src1', sourceAccountName: 'Software & Subscriptions', sourceAccountNumber: '6420', items: 3 }],
  unreadDocuments: 2, openDocumentRequests: 3, overdueDocumentRequests: 1, openQuestions: 4,
});
const BAKER = row({ tenantId: 't2', tenantName: 'Baker Dental', pendingItems: 12, rulesMatched: 1, matched: 12, ready: 12 });
const QUIET = row({ tenantId: 't3', tenantName: 'Quiet Co' });

function mockApi() {
  apiClient.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/practice/client-rules-overview?')) {
      return Promise.resolve({ data: [ACME, BAKER, QUIET], total: 3, limit: 25, offset: 0 });
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
    // rules matched, ready, needs mapping, unread docs, open requests, open questions
    expect(cells.slice(2, 8)).toEqual(['2', '37', '3', '2', '31 overdue', '4']);
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

  it('shows a friendly empty state', async () => {
    apiClient.mockImplementation(() => Promise.resolve({ data: [], total: 0, limit: 25, offset: 0 }));
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
