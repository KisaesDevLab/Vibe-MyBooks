// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Per-row Category column on both Uncategorized tabs.
//
// The load-bearing assertion is that picking a category posts NOTHING. A row
// leaving the list the moment a dropdown closed would read as an accidental
// posting, and a mis-click would already be in the books. The pick is a draft
// until that row's Save is pressed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import {
  accountsMocks, companyMocks, contactsMocks, passthroughMutation,
} from '../../../test-mocks';

const clearMutate = vi.fn();
const bulkCategorizeMutate = vi.fn();
const postToSuspenseMutate = vi.fn();

const suspenseRow = {
  transactionId: 'txn-1',
  txnDate: '2026-08-28',
  txnType: 'expense',
  txnNumber: null,
  memo: 'Check 1814 - ELITE',
  contactName: null,
  checkNumber: 1814,
  payeeNameOnCheck: 'ELITE',
  amount: '3337.64',
  suspenseLineCount: 1,
  isSplit: false,
  source: 'bank_feed',
  attachmentCount: 0,
  attachableType: 'expense',
  bankFeedItemId: null,
};

const unpostedRow = {
  id: 'feed-1',
  feedDate: '2026-08-28',
  description: 'MYSTERY VENDOR',
  amount: '42.5000',
  checkNumber: 3607,
  payeeNameOnCheck: 'Acme Supply Co',
  assignedContactName: null,
  suggestedContactName: null,
  attachmentCount: 0,
};

vi.mock('../../../api/hooks/useUncategorized', () => ({
  useSuspenseSummary: () => ({ data: undefined, isLoading: false, isError: false }),
  useInSuspense: () => ({
    data: { rows: [suspenseRow], total: 1, suspenseAccountId: 'acct-suspense' },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useUnpostedFeed: () => ({
    data: { items: [unpostedRow], total: 1 },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useSuggestions: () => ({ data: { rows: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn() }),
  useClearSuspense: () => ({ ...passthroughMutation(), mutate: clearMutate }),
  usePostToSuspense: () => ({ ...passthroughMutation(), mutate: postToSuspenseMutate }),
  useApproveSuggestions: passthroughMutation,
  useRejectSuggestions: passthroughMutation,
  useMarkSuggestionsReviewed: passthroughMutation,
}));
vi.mock('../../../api/hooks/useBanking', () => ({
  useBulkCategorize: () => ({ ...passthroughMutation(), mutate: bulkCategorizeMutate }),
}));
// The picker needs something to find. No accountNumber, so the option's
// visible text is the plain name.
vi.mock('../../../api/hooks/useAccounts', () => ({
  ...accountsMocks(),
  useAccounts: () => ({
    data: {
      data: [{ id: 'acct-1', name: 'Rent', accountType: 'expense', accountNumber: null, isActive: true }],
      total: 1,
    },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('../../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../../api/hooks/useCompany', () => companyMocks());

import { InSuspenseTab } from './InSuspenseTab';
import { NotPostedTab } from './NotPostedTab';

beforeEach(() => {
  clearMutate.mockClear();
  bulkCategorizeMutate.mockClear();
  postToSuspenseMutate.mockClear();
});

/**
 * The picker is a SearchableDropdown, not a <select>, so drive it the way a
 * person does: type into it, then click the option.
 */
async function pickCategory(index = 0) {
  const inputs = screen.getAllByPlaceholderText(/search accounts/i);
  fireEvent.focus(inputs[index]!);
  fireEvent.change(inputs[index]!, { target: { value: 'Rent' } });
  const option = await waitFor(() => screen.getByText('Rent'));
  fireEvent.click(option);
}

describe('In suspense — per-row Category', () => {
  it('renders a Category column with the shared account picker', () => {
    renderRoute(<InSuspenseTab />);
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeTruthy();
    // One in the bulk toolbar, one on the row.
    expect(screen.getAllByPlaceholderText(/search accounts/i).length).toBeGreaterThan(1);
  });

  it('picking a category posts nothing and marks the row unsaved', async () => {
    renderRoute(<InSuspenseTab />);
    await pickCategory(1);
    expect(clearMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save this category/i })).toBeTruthy();
    expect(screen.getByText(/not saved until you press/i)).toBeTruthy();
  });

  it('Save sends just that one transaction', async () => {
    renderRoute(<InSuspenseTab />);
    await pickCategory(1);
    fireEvent.click(screen.getByRole('button', { name: /save this category/i }));
    await waitFor(() => expect(clearMutate).toHaveBeenCalledTimes(1));
    expect(clearMutate.mock.calls[0]![0].transactionIds).toEqual(['txn-1']);
    expect(clearMutate.mock.calls[0]![0].accountId).toBe('acct-1');
  });

  it('keeps the draft when the ledger refuses the move', async () => {
    clearMutate.mockImplementationOnce(
      (_args: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
        opts?.onSuccess?.({ updated: 0, skipped: [{ id: 'txn-1', reason: 'period locked' }] }),
    );
    renderRoute(<InSuspenseTab />);
    await pickCategory(1);
    fireEvent.click(screen.getByRole('button', { name: /save this category/i }));
    // Nothing moved, so the picker must not clear itself and hide the problem.
    await waitFor(() => expect(clearMutate).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /save this category/i })).toBeTruthy();
  });
});

describe('Not posted — per-row Category', () => {
  it('picking a category posts nothing until Save', async () => {
    renderRoute(<NotPostedTab />);
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeTruthy();
    await pickCategory(1);
    expect(bulkCategorizeMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /save this category/i }));
    await waitFor(() => expect(bulkCategorizeMutate).toHaveBeenCalledTimes(1));
    expect(bulkCategorizeMutate.mock.calls[0]![0].feedItemIds).toEqual(['feed-1']);
  });
});
