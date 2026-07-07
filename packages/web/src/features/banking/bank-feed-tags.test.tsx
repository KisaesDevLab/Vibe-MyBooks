// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Bank Feed tagging surface:
//   - the Tag column shows a "suggested" pill for a PENDING item that
//     carries a rule-staged suggestedTagName, and the actual applied tag
//     for a CATEGORIZED item (from lineTags).
//   - expanding a pending row renders the line tag picker and, on Assign
//     (two-phase workflow — stages, no post), includes the tagId (pre-filled
//     from the item's suggested tag) in the assign mutation payload.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks, passthroughMutation,
} from '../../test-mocks';

const assignMutate = vi.fn();

const feedItems = [
  {
    id: 'item-pending',
    tenantId: 't1',
    bankConnectionId: 'conn-1',
    feedDate: '2026-06-01',
    description: 'COFFEE SHOP',
    originalDescription: 'COFFEE SHOP 001',
    amount: '12.5000',
    status: 'pending',
    suggestedAccountId: 'acct-1',
    suggestedAccountName: 'Office Expense',
    suggestedContactId: null,
    confidenceScore: null,
    matchedTransactionId: null,
    payeeNameOnCheck: null,
    checkNumber: null,
    memo: null,
    bankAccountName: 'Checking',
    institutionName: 'Test Bank',
    // Rule-staged suggested tag → renders as the amber "suggested" pill.
    suggestedTagId: 'tag-travel',
    suggestedTagName: 'Travel',
    lineTags: null,
  },
  {
    id: 'item-categorized',
    tenantId: 't1',
    bankConnectionId: 'conn-1',
    feedDate: '2026-06-02',
    description: 'AIRLINE TICKET',
    originalDescription: 'AIRLINE TICKET 002',
    amount: '80.0000',
    status: 'categorized',
    suggestedAccountId: null,
    suggestedAccountName: null,
    suggestedContactId: null,
    confidenceScore: null,
    matchedTransactionId: 'txn-1',
    payeeNameOnCheck: null,
    checkNumber: null,
    memo: null,
    bankAccountName: 'Checking',
    institutionName: 'Test Bank',
    suggestedTagId: null,
    suggestedTagName: null,
    // Actual applied tag from the posted transaction's journal lines.
    lineTags: ['Marketing'],
  },
];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: () => ({
    data: { data: feedItems, total: 2 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useAssignFeedItem: () => ({ ...passthroughMutation(), mutate: assignMutate }),
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
  assignMutate.mockClear();
  sessionStorage.clear();
});

describe('BankFeedPage — Tag column', () => {
  it('shows a suggested pill for a pending item and the applied tag for a categorized item', () => {
    renderRoute(<BankFeedPage />);
    // Pending item's rule-staged suggested tag.
    expect(screen.getByText('Travel')).toBeTruthy();
    // Categorized item's actual applied tag.
    expect(screen.getByText('Marketing')).toBeTruthy();
  });
});

describe('BankFeedPage — assign with a tag', () => {
  it('renders the tag picker in the expanded row and sends tagId in the assign payload (stages, no post)', async () => {
    renderRoute(<BankFeedPage />);

    // Expand the pending row (double-click is wired to expandItem).
    fireEvent.dblClick(screen.getByText('COFFEE SHOP'));

    // The line tag picker renders in the expanded category column.
    expect(screen.getByLabelText('Tag')).toBeTruthy();

    // Assign — catAccountId + catTagId were pre-filled from the item's
    // suggestions, so the mutate payload carries the tag. This STAGES the
    // assignment (no ledger post); Approve is a separate step.
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }));

    await waitFor(() => expect(assignMutate).toHaveBeenCalledTimes(1));
    expect(assignMutate.mock.calls[0]![0]).toMatchObject({
      id: 'item-pending',
      accountId: 'acct-1',
      tagId: 'tag-travel',
    });
  });
});
