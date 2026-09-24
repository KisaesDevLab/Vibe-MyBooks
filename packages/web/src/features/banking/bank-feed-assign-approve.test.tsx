// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Two-phase workflow UI (Assign → Approve):
//   - an 'assigned' row shows its staged category and a per-row Approve
//     button that calls approve() (posts), not a categorize/post-on-assign.
//   - selecting rows and clicking the bulk Approve posts the staged items.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks, passthroughMutation,
} from '../../test-mocks';

const approveMutate = vi.fn();
const bulkApproveMutate = vi.fn();
// Inline category pick stages through assign(); resolve so the picker closes.
const assignMutate = vi.fn(
  (_input: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.(),
);
// Re-cleanse resolves successfully so the selection-persistence test can
// assert the checkboxes survive an in-place bulk action.
const bulkRecleanseMutate = vi.fn(
  (_ids: unknown, opts?: { onSuccess?: (r: unknown) => void }) => opts?.onSuccess?.({ cleansing: { aiFailed: 0 } }),
);

const feedItems = [
  // The pending row comes FIRST: existing tests click the LAST checkbox
  // and expect the assigned row.
  {
    // A pending row with a rule/AI suggestion — the inline click-to-edit
    // target. Carries a suggested contact and tag that a pick must keep.
    id: 'item-pending',
    tenantId: 't1',
    bankConnectionId: 'conn-1',
    feedDate: '2026-06-02',
    description: 'PENDING VENDOR',
    originalDescription: 'PENDING VENDOR 002',
    amount: '15.0000',
    status: 'pending',
    suggestedAccountId: 'acct-9',
    suggestedAccountName: 'Meals',
    suggestedContactId: 'c-sugg',
    suggestedContactName: 'Suggested Diner',
    confidenceScore: '0.80',
    matchedTransactionId: null,
    payeeNameOnCheck: null,
    checkNumber: null,
    memo: null,
    bankAccountName: 'Checking',
    institutionName: 'Test Bank',
    suggestedTagId: 'tag-sugg',
    suggestedTagName: 'Travel',
    lineTags: null,
    assignedAccountId: null,
    assignedAccountName: null,
    assignedContactId: null,
    assignedTagId: null,
    assignedTagName: null,
    assignedMemo: null,
  },
  {
    id: 'item-assigned',
    tenantId: 't1',
    bankConnectionId: 'conn-1',
    feedDate: '2026-06-01',
    description: 'STAGED VENDOR',
    originalDescription: 'STAGED VENDOR 001',
    amount: '40.0000',
    status: 'assigned',
    suggestedAccountId: null,
    suggestedAccountName: null,
    suggestedContactId: null,
    confidenceScore: null,
    matchedTransactionId: null,
    payeeNameOnCheck: null,
    checkNumber: null,
    memo: null,
    bankAccountName: 'Checking',
    institutionName: 'Test Bank',
    suggestedTagId: null,
    suggestedTagName: null,
    lineTags: null,
    // Staged assignment awaiting approval.
    assignedAccountId: 'acct-1',
    assignedAccountName: 'Office Expense',
    assignedContactId: null,
    assignedTagId: null,
    assignedTagName: null,
    assignedMemo: null,
  },
];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: () => ({
    data: { data: feedItems, total: 1 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useApproveFeedItem: () => ({ ...passthroughMutation(), mutate: approveMutate }),
  useAssignFeedItem: () => ({ ...passthroughMutation(), mutate: assignMutate }),
  useBulkApprove: () => ({ ...passthroughMutation(), mutate: bulkApproveMutate }),
  useBulkRecleanse: () => ({ ...passthroughMutation(), mutate: bulkRecleanseMutate }),
}));
// The inline picker needs an account to find; no accountNumber so the
// option's visible text is the plain name.
vi.mock('../../api/hooks/useAccounts', () => ({
  ...accountsMocks(),
  useAccounts: () => ({
    data: { data: [{ id: 'acct-1', name: 'Rent', accountType: 'expense', accountNumber: null, isActive: true }], total: 1 },
    isLoading: false,
    isError: false,
  }),
}));
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
  approveMutate.mockClear();
  bulkApproveMutate.mockClear();
  assignMutate.mockClear();
  sessionStorage.clear();
});

describe('BankFeedPage — inline category on click', () => {
  it('clicking a pending row\'s category opens a picker; picking stages via assign() with the row\'s contact and tag, and posts nothing', async () => {
    renderRoute(<BankFeedPage />);
    // The suggestion text is the click target.
    fireEvent.click(screen.getByRole('button', { name: 'Meals' }));
    const input = screen.getByPlaceholderText(/search accounts/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Rent' } });
    fireEvent.click(await waitFor(() => screen.getByText('Rent')));

    await waitFor(() => expect(assignMutate).toHaveBeenCalledTimes(1));
    expect(assignMutate.mock.calls[0]![0]).toEqual({
      id: 'item-pending', accountId: 'acct-1', contactId: 'c-sugg', tagId: 'tag-sugg', memo: null,
    });
    expect(approveMutate).not.toHaveBeenCalled();
    // The picker closes once the stage settles.
    await waitFor(() => expect(screen.queryByPlaceholderText(/search accounts/i)).toBeNull());
  });

  it('the staged pill re-opens the picker; cancel backs out without staging', () => {
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByRole('button', { name: /office expense/i }));
    expect(screen.getByPlaceholderText(/search accounts/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /cancel category edit/i }));
    expect(screen.queryByPlaceholderText(/search accounts/i)).toBeNull();
    expect(assignMutate).not.toHaveBeenCalled();
  });
});

describe('BankFeedPage — assigned row', () => {
  it('shows the staged category and status pill', () => {
    renderRoute(<BankFeedPage />);
    expect(screen.getByText('Office Expense')).toBeTruthy();
    expect(screen.getByText('Assigned')).toBeTruthy();
  });

  it('per-row Approve calls approve() with the item id (posts the staged assignment)', async () => {
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(approveMutate).toHaveBeenCalledTimes(1));
    expect(approveMutate.mock.calls[0]![0]).toBe('item-assigned');
  });

  it('selecting the row and clicking bulk Approve posts the staged item after confirm', async () => {
    renderRoute(<BankFeedPage />);
    // Select the assigned row (checkbox in the first cell).
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    // Bulk toolbar Approve appears once a row is selected — the toolbar
    // renders above the table, so it's the first Approve in DOM order.
    const approveButtons = screen.getAllByRole('button', { name: /^approve$/i });
    fireEvent.click(approveButtons[0]!);
    // Approve now confirms first (guards off-screen selections).
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(within(dialog).getByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(bulkApproveMutate).toHaveBeenCalledTimes(1));
    expect(bulkApproveMutate.mock.calls[0]![0]).toEqual(['item-assigned']);
  });

  it('selection survives an in-place bulk action (Re-cleanse)', async () => {
    renderRoute(<BankFeedPage />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    expect(screen.getByText('1 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /re-cleanse/i }));
    await waitFor(() => expect(bulkRecleanseMutate).toHaveBeenCalledTimes(1));
    // The bulk toolbar (and the row's checkbox) must still be there —
    // the action must not reset the selection and force starting over.
    expect(screen.getByText('1 selected')).toBeTruthy();
    const after = screen.getAllByRole('checkbox');
    expect((after[after.length - 1] as HTMLInputElement).checked).toBe(true);
  });

  it('bulk Approve unchecks the rows that posted', async () => {
    bulkApproveMutate.mockImplementationOnce(
      (_ids: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
        opts?.onSuccess?.({ approved: 1, skipped: 0, failed: 0, failures: [] }),
    );
    renderRoute(<BankFeedPage />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    const approveButtons = screen.getAllByRole('button', { name: /^approve$/i });
    fireEvent.click(approveButtons[0]!);
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(within(dialog).getByRole('button', { name: /^approve$/i }));
    // The assigned row posted, so it leaves the selection and the toolbar hides.
    await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  });
});
