// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { passthroughMutation } from '../../../test-mocks';

const submitMutate = vi.fn();
const withdrawMutate = vi.fn();
const rowsState: { rows: unknown[] } = { rows: [] };

const row = (over: Record<string, unknown> = {}) => ({
  transactionId: 'txn-1', txnDate: '2026-05-01', txnType: 'expense', txnNumber: null, memo: 'Mystery charge',
  contactName: null, checkNumber: null, payeeNameOnCheck: null, amount: '10.00', suspenseLineCount: 1, isSplit: false,
  source: null, attachmentCount: 0, attachableType: 'expense', bankFeedItemId: null, pendingSuggestion: null, ...over,
});

vi.mock('../../../api/hooks/useAuth', () => ({ useMe: () => ({ data: { user: { id: 'me', role: 'accountant' } } }) }));
vi.mock('../../../api/hooks/useUncategorized', () => ({
  useSuspenseSummary: () => ({ data: { balance: '10.00', transactionCount: 1, unpostedCount: 0, suspenseAccountId: 'sus' }, isLoading: false, isError: false }),
  useSuggestions: () => ({ data: { rows: [], total: 0 }, isLoading: false, isError: false }),
  useInSuspense: () => ({ data: { rows: rowsState.rows, total: rowsState.rows.length, suspenseAccountId: 'sus' }, isLoading: false, isError: false, refetch: vi.fn() }),
  useTeamCategories: () => ({ data: { categories: [{ id: 'acct-1', label: 'Office Supplies', group: 'Money out', hint: null }] } }),
  useSubmitTeamSuggestions: () => ({ ...passthroughMutation(), mutate: submitMutate, isPending: false }),
  useWithdrawTeamSuggestion: () => ({ ...passthroughMutation(), mutate: withdrawMutate, isPending: false }),
}));
vi.mock('../../attachments/AttachFileButton', () => ({ AttachFileButton: () => null }));
vi.mock('../../practice/uncategorized/RowAttachmentsModal', () => ({ RowAttachmentsModal: () => null }));
vi.mock('../../practice/uncategorized/ClientSuggestedTab', () => ({ ClientSuggestedTab: () => <p>suggested tab</p> }));

const { TeamUncategorizedPage } = await import('./TeamUncategorizedPage');

const suggest = { mode: 'suggest' as const, managedByFirm: true, firmName: 'Acme CPA', canReview: false };
const review = { mode: 'review' as const, managedByFirm: false, canReview: true };

beforeEach(() => { submitMutate.mockReset(); withdrawMutate.mockReset(); rowsState.rows = [row()]; });

describe('TeamUncategorizedPage', () => {
  it('names the reviewer, and sends a pick + note as one batch', async () => {
    renderRoute(<TeamUncategorizedPage mode={suggest} />);
    expect(screen.getByText(/Acme CPA/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull(); // no Suggested tab in suggest mode
    const send = screen.getByRole('button', { name: /Send 0 answers/ });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Category for Mystery charge'), { target: { value: 'acct-1' } });
    fireEvent.change(screen.getByLabelText('Note for Mystery charge'), { target: { value: 'paper' } });
    fireEvent.click(screen.getByRole('button', { name: /Send 1 answer$/ }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalledTimes(1));
    expect(submitMutate.mock.calls[0]?.[0]).toEqual({ items: [{ targetId: 'txn-1', categoryId: 'acct-1', note: 'paper' }] });
  });

  it('refuses "Not sure" without a note before sending', () => {
    renderRoute(<TeamUncategorizedPage mode={suggest} />);
    fireEvent.change(screen.getByLabelText('Category for Mystery charge'), { target: { value: 'not_sure' } });
    fireEvent.click(screen.getByRole('button', { name: /Send 1 answer$/ }));
    expect(submitMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/add a note/);
  });

  it('a note alone sends as "not sure"', async () => {
    renderRoute(<TeamUncategorizedPage mode={suggest} />);
    fireEvent.change(screen.getByLabelText('Note for Mystery charge'), { target: { value: 'ask Sam' } });
    fireEvent.click(screen.getByRole('button', { name: /Send 1 answer$/ }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    expect(submitMutate.mock.calls[0]?.[0]).toEqual({ items: [{ targetId: 'txn-1', categoryId: 'not_sure', note: 'ask Sam' }] });
  });

  it('a pending row shows awaiting review; Withdraw only for your own answer', () => {
    rowsState.rows = [
      row({ transactionId: 'mine', memo: 'Mine', pendingSuggestion: { id: 's1', label: 'Office Supplies', note: null, isPersonal: false, submittedBy: 'team_member', submittedByUserId: 'me', submittedByName: 'Me' } }),
      row({ transactionId: 'theirs', memo: 'Theirs', pendingSuggestion: { id: 's2', label: 'Meals', note: 'lunch', isPersonal: false, submittedBy: 'team_member', submittedByUserId: 'u9', submittedByName: 'Sam' } }),
    ];
    renderRoute(<TeamUncategorizedPage mode={suggest} />);
    expect(screen.getAllByText(/Sent · awaiting review/)).toHaveLength(2);
    expect(screen.getByText(/Answered by Sam/)).toBeInTheDocument();
    const withdraws = screen.getAllByRole('button', { name: /Withdraw/ });
    expect(withdraws).toHaveLength(1);
    fireEvent.click(withdraws[0]!);
    expect(withdrawMutate).toHaveBeenCalledWith('s1', expect.anything());
    expect(screen.queryByLabelText('Category for Mine')).toBeNull();
  });

  it('reviewers (self-managed owners) get the Suggested tab', () => {
    renderRoute(<TeamUncategorizedPage mode={review} />, { route: '/banking/uncategorized?tab=suggested' });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByText('suggested tab')).toBeInTheDocument();
  });
});
