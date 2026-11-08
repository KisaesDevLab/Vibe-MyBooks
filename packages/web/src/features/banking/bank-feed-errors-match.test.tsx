// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bank Feed refusals are shown, not swallowed:
//   - approve / assign / exclude / bulk categorize / bulk approve show the
//     engine's reason, with specific wording for FEED_ITEM_NOT_PENDING (and
//     a feed refresh), SPLITS_DONT_BALANCE and a locked period (423).
//   - the Match modal lists one row per journal line, sends journalLineId
//     with transactionId, and keeps itself open on LINE_REQUIRED.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks, passthroughMutation,
} from '../../test-mocks';
import { ApiError } from '../../api/client';

type MutateOpts = { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void; onSettled?: () => void };

const refetch = vi.fn();
const approveMutate = vi.fn();
const assignMutate = vi.fn();
const excludeMutate = vi.fn();
const bulkAssignMutate = vi.fn();
const bulkApproveMutate = vi.fn();
const matchMutate = vi.fn();
let candidates: Array<Record<string, unknown>> = [];

const baseItem = {
  tenantId: 't1',
  bankConnectionId: 'conn-1',
  confidenceScore: null,
  matchedTransactionId: null,
  payeeNameOnCheck: null,
  checkNumber: null,
  memo: null,
  bankAccountName: 'Checking',
  institutionName: 'Test Bank',
  suggestedAccountId: null,
  suggestedAccountName: null,
  suggestedContactId: null,
  suggestedTagId: null,
  suggestedTagName: null,
  lineTags: null,
  assignedContactId: null,
  assignedTagId: null,
  assignedTagName: null,
  assignedMemo: null,
};

const feedItems = [
  {
    ...baseItem,
    id: 'item-pending',
    feedDate: '2026-06-02',
    description: 'PAYROLL DEBIT',
    originalDescription: 'PAYROLL DEBIT',
    amount: '500.0000',
    status: 'pending',
    assignedAccountId: null,
    assignedAccountName: null,
    matchCandidateCount: 0,
  },
  {
    ...baseItem,
    id: 'item-assigned',
    feedDate: '2026-06-01',
    description: 'STAGED VENDOR',
    originalDescription: 'STAGED VENDOR 001',
    amount: '40.0000',
    status: 'assigned',
    assignedAccountId: 'acct-1',
    assignedAccountName: 'Office Expense',
  },
];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: () => ({
    data: { data: feedItems, total: 2 },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
  }),
  useApproveFeedItem: () => ({ ...passthroughMutation(), mutate: approveMutate }),
  useAssignFeedItem: () => ({ ...passthroughMutation(), mutate: assignMutate }),
  useExcludeFeedItem: () => ({ ...passthroughMutation(), mutate: excludeMutate }),
  useBulkAssign: () => ({ ...passthroughMutation(), mutate: bulkAssignMutate }),
  useBulkApprove: () => ({ ...passthroughMutation(), mutate: bulkApproveMutate }),
  useMatchFeedItem: () => ({ ...passthroughMutation(), mutate: matchMutate }),
  useMatchCandidates: () => ({
    data: { candidates },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
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

/** A mocked mutate that fails with `err`. */
const failWith = (err: unknown) => (_input: unknown, opts?: MutateOpts) => { opts?.onError?.(err); opts?.onSettled?.(); };

const notPending = () => new ApiError('Feed item is not pending', 'FEED_ITEM_NOT_PENDING', { status: 'categorized' }, 409);

beforeEach(() => {
  for (const m of [refetch, approveMutate, assignMutate, excludeMutate, bulkAssignMutate, bulkApproveMutate, matchMutate]) m.mockReset();
  candidates = [];
  sessionStorage.clear();
});

describe('BankFeedPage — engine refusals are shown', () => {
  it('Approve on a row already handled: explains it and refreshes the feed', async () => {
    approveMutate.mockImplementation(failWith(notPending()));
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText(/already handled/i)).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it('Approve with a split that does not add up: says so, with the server detail', async () => {
    approveMutate.mockImplementation(failWith(
      new ApiError('The split percentages add up to 99.99%, not 100%.', 'SPLITS_DONT_BALANCE', { kind: 'percent' }, 400),
    ));
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText(/split doesn.t add up/i)).toBeTruthy();
    expect(screen.getByText('The split percentages add up to 99.99%, not 100%.')).toBeTruthy();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('Approve into a locked period (423): explains the lock', async () => {
    approveMutate.mockImplementation(failWith(new ApiError('Period is closed', 'TB_PERIOD_LOCKED', undefined, 423)));
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText(/locked period/i)).toBeTruthy();
  });

  it('Exclude: an unrecognised refusal shows the server message', async () => {
    excludeMutate.mockImplementation(failWith(new ApiError('Something specific went wrong', 'OTHER', undefined, 400)));
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getAllByTitle('Exclude')[0]!);
    expect(await screen.findByText('Something specific went wrong')).toBeTruthy();
  });

  it('bulk Categorize: a refusal is shown', async () => {
    bulkAssignMutate.mockImplementation(failWith(notPending()));
    renderRoute(<BankFeedPage />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    fireEvent.click(screen.getByRole('button', { name: /^categorize$/i }));
    const input = screen.getByPlaceholderText(/search accounts/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Rent' } });
    fireEvent.click(await waitFor(() => screen.getByText('Rent')));
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await waitFor(() => expect(bulkAssignMutate).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/already handled/i)).toBeTruthy();
  });

  it('bulk Approve: counts stay, and the first failure says why', async () => {
    bulkApproveMutate.mockImplementation((_ids: unknown, opts?: MutateOpts) => opts?.onSuccess?.({
      approved: 0, skipped: 0, failed: 1,
      failures: [{ id: 'item-assigned', error: 'Period is closed', code: 'TB_PERIOD_LOCKED' }],
    }));
    renderRoute(<BankFeedPage />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    fireEvent.click(screen.getAllByRole('button', { name: /^approve$/i })[0]!);
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(within(dialog).getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText('0 approved · 1 failed')).toBeTruthy();
    expect(screen.getByText(/locked period/i)).toBeTruthy();
  });

  it('bulk Approve: a whole-request failure is shown', async () => {
    bulkApproveMutate.mockImplementation(failWith(new ApiError('Bulk approve is limited to 500 items per request', undefined, undefined, 400)));
    renderRoute(<BankFeedPage />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]!);
    fireEvent.click(screen.getAllByRole('button', { name: /^approve$/i })[0]!);
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(within(dialog).getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText('Bulk approve is limited to 500 items per request')).toBeTruthy();
  });
});

describe('BankFeedPage — Match picks a journal line', () => {
  // One payroll entry with two bank lines of the same amount: two rows, same
  // entry id, different journal lines.
  const twoLines = () => [
    { id: 'txn-1', journalLineId: 'jl-net', txnType: 'journal_entry', txnNumber: 'JE-7', txnDate: '2026-06-02', total: '1500.0000', amount: '500.00', memo: null, lineDescription: 'Net pay', checkNumber: null, printStatus: null, source: null, contactName: null },
    { id: 'txn-1', journalLineId: 'jl-tax', txnType: 'journal_entry', txnNumber: 'JE-7', txnDate: '2026-06-02', total: '1500.0000', amount: '500.00', memo: null, lineDescription: 'Payroll taxes', checkNumber: null, printStatus: null, source: null, contactName: null },
  ];

  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleError.mockRestore(); });

  const openModal = () => {
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByTitle('Find existing transaction to match'));
    return screen.getByText('Match to Existing Transaction').closest('div.bg-white') as HTMLElement;
  };

  it('lists each line, and sends journalLineId with transactionId', async () => {
    candidates = twoLines();
    const modal = openModal();
    expect(within(modal).getByText('Net pay')).toBeTruthy();
    expect(within(modal).getByText('Payroll taxes')).toBeTruthy();
    // No duplicate-key warning from rows that share the entry id.
    expect(consoleError.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
    const buttons = within(modal).getAllByRole('button', { name: /^match$/i });
    fireEvent.click(buttons[1]!);
    await waitFor(() => expect(matchMutate).toHaveBeenCalledTimes(1));
    expect(matchMutate.mock.calls[0]![0]).toEqual({ id: 'item-pending', transactionId: 'txn-1', journalLineId: 'jl-tax' });
  });

  it('LINE_REQUIRED: keeps the modal open, says to pick the line, and dims lines not offered', async () => {
    candidates = twoLines();
    matchMutate.mockImplementation(failWith(new ApiError(
      'This entry has more than one line that fits this bank line. Pick the line.', 'LINE_REQUIRED', { journalLineIds: ['jl-net'] }, 400,
    )));
    const modal = openModal();
    fireEvent.click(within(modal).getAllByRole('button', { name: /^match$/i })[1]!);
    const alert = await within(modal).findByRole('alert');
    expect(alert.textContent).toMatch(/pick the line/i);
    expect(screen.getByText('Match to Existing Transaction')).toBeTruthy();
    const buttons = within(modal).getAllByRole('button', { name: /^match$/i });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('a row already handled: closes the modal, explains it and refreshes', async () => {
    candidates = twoLines();
    matchMutate.mockImplementation(failWith(notPending()));
    const modal = openModal();
    fireEvent.click(within(modal).getAllByRole('button', { name: /^match$/i })[0]!);
    expect(await screen.findByText(/already handled/i)).toBeTruthy();
    expect(screen.queryByText('Match to Existing Transaction')).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });
});
