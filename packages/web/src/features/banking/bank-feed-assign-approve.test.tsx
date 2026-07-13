// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Two-phase workflow UI (Assign → Approve):
//   - an 'assigned' row shows its staged category and a per-row Approve
//     button that calls approve() (posts), not a categorize/post-on-assign.
//   - selecting rows and clicking the bulk Approve posts the staged items.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks, passthroughMutation,
} from '../../test-mocks';

const approveMutate = vi.fn();
const bulkApproveMutate = vi.fn();
// Re-cleanse resolves successfully so the selection-persistence test can
// assert the checkboxes survive an in-place bulk action.
const bulkRecleanseMutate = vi.fn(
  (_ids: unknown, opts?: { onSuccess?: (r: unknown) => void }) => opts?.onSuccess?.({ cleansing: { aiFailed: 0 } }),
);

const feedItems = [
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
  useBulkApprove: () => ({ ...passthroughMutation(), mutate: bulkApproveMutate }),
  useBulkRecleanse: () => ({ ...passthroughMutation(), mutate: bulkRecleanseMutate }),
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
  approveMutate.mockClear();
  bulkApproveMutate.mockClear();
  sessionStorage.clear();
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

  it('selecting the row and clicking bulk Approve posts the staged item', async () => {
    renderRoute(<BankFeedPage />);
    // Select the assigned row (checkbox in the first cell).
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    // Bulk toolbar Approve appears once a row is selected — the toolbar
    // renders above the table, so it's the first Approve in DOM order.
    const approveButtons = screen.getAllByRole('button', { name: /^approve$/i });
    fireEvent.click(approveButtons[0]!);
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
    // The assigned row posted, so it leaves the selection and the toolbar hides.
    await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  });
});
