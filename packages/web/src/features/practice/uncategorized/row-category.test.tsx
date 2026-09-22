// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Per-row Payee and Category columns on both Uncategorized tabs.
//
// The load-bearing assertion is that picking a category posts NOTHING. A row
// leaving the list the moment a dropdown closed would read as an accidental
// posting, and a mis-click would already be in the books. The pick is a draft
// until that row's Save is pressed. The payee follows the same rule, and the
// row's one Save commits the payee first, then the category.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import {
  accountsMocks, companyMocks, contactsMocks, passthroughMutation,
} from '../../../test-mocks';

const clearMutate = vi.fn();
const bulkCategorizeMutate = vi.fn();
const postToSuspenseMutate = vi.fn();
const setSuspensePayeeMutate = vi.fn();
const setFeedPayeeMutate = vi.fn();

const suspenseRow = {
  transactionId: 'txn-1',
  txnDate: '2026-08-28',
  txnType: 'expense',
  txnNumber: null,
  memo: 'Check 1814 - ELITE',
  contactId: null,
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
  assignedContactId: null,
  assignedContactName: null,
  suggestedContactId: null,
  suggestedContactName: null,
  attachmentCount: 0,
};

const suggestionRow = {
  id: 'sug-1',
  targetKind: 'bank_feed_item',
  targetId: 'feed-1',
  suggestedAccountId: null,
  suggestedLabel: 'Not sure',
  clientNote: 'Parts for the Henderson repair',
  isPersonal: false,
  status: 'pending',
  submittedAt: '2026-08-28T10:00:00.000Z',
  reviewedAt: null,
  contactName: 'Cli Ent',
  snapshotAmount: '42.50',
  snapshotDate: '2026-08-28',
  snapshotDescription: 'MYSTERY VENDOR',
  driftedFields: [],
  isStale: false,
};

vi.mock('../../../api/hooks/useUncategorized', () => ({
  useUncategorizedMode: () => ({ data: { mode: 'review', managedByFirm: true, firmName: 'Test Firm', canReview: true }, isLoading: false, isError: false }),
  useSuspenseSummary: () => ({ data: undefined, isLoading: false, isError: false }),
  useInSuspense: () => ({
    data: { rows: [suspenseRow], total: 1, suspenseAccountId: 'acct-suspense' },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useUnpostedFeed: () => ({
    data: { items: [unpostedRow], total: 1 },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useSuggestions: () => ({
    data: { rows: [suggestionRow], total: 1 },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useClearSuspense: () => ({ ...passthroughMutation(), mutate: clearMutate }),
  usePostToSuspense: () => ({ ...passthroughMutation(), mutate: postToSuspenseMutate }),
  useSetSuspensePayee: () => ({ ...passthroughMutation(), mutate: setSuspensePayeeMutate }),
  useSetFeedItemPayee: () => ({ ...passthroughMutation(), mutate: setFeedPayeeMutate }),
  useApproveSuggestions: passthroughMutation,
  useRejectSuggestions: passthroughMutation,
  useMarkSuggestionsReviewed: passthroughMutation,
  // The In suspense tab mounts the "Ask the client" modal closed; its hooks
  // are called (hooks always are) but disabled, so an inert stub is enough.
  useHelpRecipients: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendHelpRequest: passthroughMutation,
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
// The payee picker needs someone to find. A default expense account on the
// contact is what prefills the row's Category draft when it is picked.
vi.mock('../../../api/hooks/useContacts', () => ({
  ...contactsMocks(),
  useContacts: () => ({
    data: {
      data: [{ id: 'contact-1', displayName: 'Acme Supply Co', contactType: 'vendor', defaultExpenseAccountId: 'acct-1', defaultTagId: null }],
      total: 1,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../../api/hooks/useCompany', () => companyMocks());

import { InSuspenseTab } from './InSuspenseTab';
import { NotPostedTab } from './NotPostedTab';
import { ClientSuggestedTab } from './ClientSuggestedTab';

beforeEach(() => {
  clearMutate.mockClear();
  bulkCategorizeMutate.mockClear();
  postToSuspenseMutate.mockClear();
  setSuspensePayeeMutate.mockReset();
  setFeedPayeeMutate.mockReset();
});

/** Resolve a payee write the way the real mutation would: success, one row. */
function payeeSaveSucceeds(mock: ReturnType<typeof vi.fn>) {
  mock.mockImplementation(
    (_args: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
      opts?.onSuccess?.({ updated: 1, skipped: [] }),
  );
}

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

/** The row's payee picker is the only contact search on either tab. */
async function pickPayee() {
  const input = screen.getByPlaceholderText(/search contacts/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Acme' } });
  const option = await waitFor(() => screen.getByText('Acme Supply Co'));
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
    expect(screen.getByRole('button', { name: /save this row/i })).toBeTruthy();
    expect(screen.getByText(/not saved until you press/i)).toBeTruthy();
  });

  it('Save sends just that one transaction', async () => {
    renderRoute(<InSuspenseTab />);
    await pickCategory(1);
    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    // Nothing moved, so the picker must not clear itself and hide the problem.
    await waitFor(() => expect(clearMutate).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /save this row/i })).toBeTruthy();
  });
});

describe('In suspense — per-row Payee', () => {
  it('shows the check-image payee as a hint under an empty picker', () => {
    renderRoute(<InSuspenseTab />);
    expect(screen.getByRole('columnheader', { name: 'Payee' })).toBeTruthy();
    expect(screen.getByPlaceholderText(/search contacts/i)).toBeTruthy();
    expect(screen.getByText(/on the check: ELITE/i)).toBeTruthy();
  });

  it('picking a payee writes nothing until Save, then saves the payee alone and keeps the row', async () => {
    payeeSaveSucceeds(setSuspensePayeeMutate);
    renderRoute(<InSuspenseTab />);
    await pickPayee();
    expect(setSuspensePayeeMutate).not.toHaveBeenCalled();
    expect(clearMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/not saved until you press/i)).toBeTruthy();

    // Picking Acme prefilled its default expense account as the category
    // draft; drop it so this Save is a payee-only save.
    const inputs = screen.getAllByPlaceholderText(/search accounts/i);
    expect((inputs[1] as HTMLInputElement).value).toBe('Rent');
    fireEvent.change(inputs[1]!, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    await waitFor(() => expect(setSuspensePayeeMutate).toHaveBeenCalledTimes(1));
    expect(setSuspensePayeeMutate.mock.calls[0]![0]).toEqual({ transactionId: 'txn-1', contactId: 'contact-1' });
    // A payee is header-level: nothing posts, nothing leaves suspense.
    expect(clearMutate).not.toHaveBeenCalled();
  });

  it('with both picked, Save writes the payee first and then clears suspense', async () => {
    payeeSaveSucceeds(setSuspensePayeeMutate);
    renderRoute(<InSuspenseTab />);
    await pickPayee();
    // The contact's default expense account became the category draft.
    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    await waitFor(() => expect(clearMutate).toHaveBeenCalledTimes(1));
    expect(setSuspensePayeeMutate).toHaveBeenCalledTimes(1);
    expect(setSuspensePayeeMutate.mock.invocationCallOrder[0]!).toBeLessThan(clearMutate.mock.invocationCallOrder[0]!);
    expect(clearMutate.mock.calls[0]![0]).toEqual({ transactionIds: ['txn-1'], accountId: 'acct-1' });
  });

  it('a payee refusal stops before the category is posted', async () => {
    setSuspensePayeeMutate.mockImplementation(
      (_args: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
        opts?.onSuccess?.({ updated: 0, skipped: [{ id: 'txn-1', reason: 'voided' }] }),
    );
    renderRoute(<InSuspenseTab />);
    await pickPayee();
    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    await waitFor(() => expect(setSuspensePayeeMutate).toHaveBeenCalled());
    expect(clearMutate).not.toHaveBeenCalled();
    // Both drafts survive so the person can see what was refused.
    expect(screen.getByRole('button', { name: /save this row/i })).toBeTruthy();
  });
});

describe('Not posted — per-row Category', () => {
  it('picking a category posts nothing until Save', async () => {
    renderRoute(<NotPostedTab />);
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeTruthy();
    await pickCategory(1);
    expect(bulkCategorizeMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    await waitFor(() => expect(bulkCategorizeMutate).toHaveBeenCalledTimes(1));
    expect(bulkCategorizeMutate.mock.calls[0]![0].feedItemIds).toEqual(['feed-1']);
  });
});

describe('Not posted — per-row Payee', () => {
  it('saving a payee alone writes the feed line and posts nothing', async () => {
    payeeSaveSucceeds(setFeedPayeeMutate);
    renderRoute(<NotPostedTab />);
    expect(screen.getByText(/on the check: Acme Supply Co/i)).toBeTruthy();
    await pickPayee();
    expect(setFeedPayeeMutate).not.toHaveBeenCalled();

    // Drop the prefilled category so only the payee is saved.
    const inputs = screen.getAllByPlaceholderText(/search accounts/i);
    fireEvent.change(inputs[1]!, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    await waitFor(() => expect(setFeedPayeeMutate).toHaveBeenCalledTimes(1));
    expect(setFeedPayeeMutate.mock.calls[0]![0]).toEqual({ feedItemId: 'feed-1', contactId: 'contact-1' });
    expect(bulkCategorizeMutate).not.toHaveBeenCalled();
  });

  it('with both picked, the payee is written first and rides along on the categorize', async () => {
    payeeSaveSucceeds(setFeedPayeeMutate);
    renderRoute(<NotPostedTab />);
    await pickPayee();
    fireEvent.click(screen.getByRole('button', { name: /save this row/i }));
    await waitFor(() => expect(bulkCategorizeMutate).toHaveBeenCalledTimes(1));
    expect(setFeedPayeeMutate).toHaveBeenCalledTimes(1);
    expect(setFeedPayeeMutate.mock.invocationCallOrder[0]!).toBeLessThan(bulkCategorizeMutate.mock.invocationCallOrder[0]!);
    expect(bulkCategorizeMutate.mock.calls[0]![0]).toEqual({ feedItemIds: ['feed-1'], accountId: 'acct-1', contactId: 'contact-1' });
  });
});

describe('Client suggested — the client note', () => {
  it('gives the note its own column, in full', () => {
    renderRoute(<ClientSuggestedTab />);
    expect(screen.getByRole('columnheader', { name: 'Note' })).toBeTruthy();
    // Shown whole, not as grey subtext under the category.
    expect(screen.getByText('Parts for the Henderson repair')).toBeTruthy();
  });
});
