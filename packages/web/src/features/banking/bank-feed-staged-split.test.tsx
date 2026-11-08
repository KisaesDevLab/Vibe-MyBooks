// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Owner decision E1 (engine QA 2026-11-08): Accept suggestion, Assign, a
// category pick and bulk Categorize post one line and drop a split a rule
// staged (U-164). A row that carries one (`hasStagedSplit` on the list row)
// says so; other rows show nothing.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks,
} from '../../test-mocks';
import { STAGED_SPLIT_NOTICE } from './stagedSplit';

const row = (p: Record<string, unknown>) => ({
  tenantId: 't1', bankConnectionId: 'conn-1', feedDate: '2026-06-02', originalDescription: null,
  amount: '-90.0000', status: 'pending', suggestedAccountId: 'acct-9', suggestedAccountName: 'Utilities',
  suggestedContactId: null, confidenceScore: null, matchType: 'rule', matchedTransactionId: null,
  payeeNameOnCheck: null, checkNumber: null, memo: null, bankAccountName: 'Checking', institutionName: 'Test Bank',
  suggestedTagId: null, suggestedTagName: null, lineTags: null, assignedAccountId: null, assignedAccountName: null,
  assignedContactId: null, assignedTagId: null, assignedTagName: null, assignedMemo: null, ...p,
});

const feedItems = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: () => ({
    data: { data: feedItems.current, total: feedItems.current.length },
    isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
  }),
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

describe('BankFeedPage — rule-staged split notice (E1)', () => {
  it('shows the notice only on the row whose rule staged a split', () => {
    feedItems.current = [
      row({ id: 'split', description: 'POWER CO', hasStagedSplit: true }),
      row({ id: 'plain', description: 'WATER CO', hasStagedSplit: false }),
    ];
    renderRoute(<BankFeedPage />);
    const notes = screen.getAllByRole('note');
    expect(notes).toHaveLength(1);
    expect(notes[0]!.textContent).toBe(STAGED_SPLIT_NOTICE);
    expect(screen.getByTitle(`Accept suggestion (stages it). ${STAGED_SPLIT_NOTICE}`)).toBeTruthy();
    expect(screen.getByTitle('Accept suggestion (stages it)')).toBeTruthy();
  });

  it('shows nothing while the engine does not send hasStagedSplit', () => {
    feedItems.current = [row({ id: 'old', description: 'POWER CO' })];
    renderRoute(<BankFeedPage />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
