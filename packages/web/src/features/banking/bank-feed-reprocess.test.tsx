// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Bank Feed "Reprocess Rules" bulk action:
//   - with rows selected, the bulk-bar button fires the mutation with the
//     selected ids and surfaces the result toast built from the counts
//   - with nothing selected, the header button opens a confirm dialog and
//     confirming fires the allPending variant

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks, passthroughMutation,
} from '../../test-mocks';
import type { ReprocessRulesResultDto } from '../../api/hooks/useBanking';

const reprocessMutate = vi.fn(
  (_input: unknown, opts?: { onSuccess?: (r: ReprocessRulesResultDto) => void }) => {
    opts?.onSuccess?.({
      processed: 2,
      matched: 1,
      autoCategorized: 1,
      suggestionsUpdated: 0,
      untouched: 1,
    });
  },
);

const feedItems = [
  {
    id: 'item-1',
    tenantId: 't1',
    bankConnectionId: 'conn-1',
    feedDate: '2026-06-01',
    description: 'COFFEE SHOP',
    originalDescription: 'COFFEE SHOP 001',
    amount: '12.5000',
    status: 'pending',
    suggestedAccountId: null,
    suggestedContactId: null,
    confidenceScore: null,
    matchedTransactionId: null,
    payeeNameOnCheck: null,
    checkNumber: null,
    memo: null,
    bankAccountName: 'Checking',
    institutionName: 'Test Bank',
  },
  {
    id: 'item-2',
    tenantId: 't1',
    bankConnectionId: 'conn-1',
    feedDate: '2026-06-02',
    description: 'UTILITY BILL',
    originalDescription: 'UTILITY BILL 002',
    amount: '80.0000',
    status: 'pending',
    suggestedAccountId: null,
    suggestedContactId: null,
    confidenceScore: null,
    matchedTransactionId: null,
    payeeNameOnCheck: null,
    checkNumber: null,
    memo: null,
    bankAccountName: 'Checking',
    institutionName: 'Test Bank',
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
  useBulkReprocessRules: () => ({ ...passthroughMutation(), mutate: reprocessMutate }),
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
  reprocessMutate.mockClear();
  sessionStorage.clear();
});

describe('BankFeedPage — Reprocess Rules', () => {
  it('fires the mutation with the selected ids and shows the result toast', () => {
    renderRoute(<BankFeedPage />);

    // Select the first pending row (last two checkboxes are the row
    // checkboxes; earlier ones are "Hide processed" + select-all).
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 2]!);

    fireEvent.click(screen.getByRole('button', { name: /reprocess rules/i }));

    expect(reprocessMutate).toHaveBeenCalledTimes(1);
    expect(reprocessMutate.mock.calls[0]![0]).toEqual({ feedItemIds: ['item-1'] });

    // Result toast built from the returned counts.
    expect(screen.getByText(/Rules matched 1 of 2 — 1 auto-categorized, 0 suggestions updated\./)).toBeTruthy();
  });

  it('with no selection, confirms then fires the allPending variant', () => {
    renderRoute(<BankFeedPage />);

    fireEvent.click(screen.getByRole('button', { name: /reprocess rules/i }));

    // Confirm dialog opens (no exact N — the pending filter is not active).
    expect(screen.getByText(/Reprocess rules for all pending items\?/)).toBeTruthy();
    expect(reprocessMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^reprocess$/i }));

    expect(reprocessMutate).toHaveBeenCalledTimes(1);
    expect(reprocessMutate.mock.calls[0]![0]).toEqual({
      allPending: true,
      bankConnectionId: undefined,
    });
  });
});
