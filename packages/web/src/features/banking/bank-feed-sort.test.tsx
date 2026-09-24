// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bank Feed "Sort by": the dropdown and the direction toggle drive the
// server-side sort (the list paginates, so ordering must be in the query),
// and the chosen order survives a remount within the tab session.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks,
} from '../../test-mocks';

let lastOpts: Record<string, unknown> = {};

// One row, so the table (and its sortable headers) renders.
const row = {
  id: 'item-1', tenantId: 't1', bankConnectionId: 'conn-1', feedDate: '2026-06-01', amount: '12.5000',
  status: 'pending', description: 'COFFEE SHOP', originalDescription: 'COFFEE SHOP 001',
  suggestedAccountId: null, suggestedAccountName: null, suggestedContactId: null, suggestedContactName: null,
  confidenceScore: null, matchedTransactionId: null, payeeNameOnCheck: null, checkNumber: null, memo: null,
  bankAccountName: 'Checking', institutionName: 'Test Bank', suggestedTagId: null, suggestedTagName: null, lineTags: null,
};

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: (opts: Record<string, unknown>) => {
    lastOpts = opts;
    return { data: { data: [row], total: 1 }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  },
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePlaid', () => plaidMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], connections: [] }) };
});

import { BankFeedPage } from './BankFeedPage';

beforeEach(() => {
  sessionStorage.clear();
  lastOpts = {};
});

describe('BankFeedPage — Sort by', () => {
  it('defaults to newest first', () => {
    renderRoute(<BankFeedPage />);
    expect(lastOpts).toMatchObject({ sortBy: 'feedDate', sortDir: 'desc' });
  });

  it('the dropdown picks the key with its natural direction; the toggle flips it; offset resets', () => {
    renderRoute(<BankFeedPage />);
    const select = screen.getByLabelText('Sort by');

    fireEvent.change(select, { target: { value: 'confidence' } });
    expect(lastOpts).toMatchObject({ sortBy: 'confidence', sortDir: 'desc', offset: 0 });

    fireEvent.change(select, { target: { value: 'originalDescription' } });
    expect(lastOpts).toMatchObject({ sortBy: 'originalDescription', sortDir: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: /switch to descending/i }));
    expect(lastOpts).toMatchObject({ sortBy: 'originalDescription', sortDir: 'desc' });

    fireEvent.change(select, { target: { value: 'name' } });
    expect(lastOpts).toMatchObject({ sortBy: 'name', sortDir: 'asc' });
  });

  it('a column header click sorts by that column and shares state with the dropdown', () => {
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(lastOpts).toMatchObject({ sortBy: 'amount', sortDir: 'asc', offset: 0 });
    expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe('amount');
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(lastOpts).toMatchObject({ sortBy: 'amount', sortDir: 'desc' });
  });

  it('remembers the order for the session', () => {
    const first = renderRoute(<BankFeedPage />);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'confidence' } });
    first.unmount();

    renderRoute(<BankFeedPage />);
    expect(lastOpts).toMatchObject({ sortBy: 'confidence', sortDir: 'desc' });
    expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe('confidence');
  });
});
