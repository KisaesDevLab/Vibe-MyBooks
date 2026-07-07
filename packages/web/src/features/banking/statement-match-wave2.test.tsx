// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Statement Match Engine wave 2 UI:
//   - grouped suggestions render distinctly ("1 deposit ↔ 3 receipts") with
//     member rows, exact-sum evidence chips, and a single Confirm for the set
//   - the confirm payload carries the full set (journalLineIds for
//     one-to-many; journalLineId + memberStatementLineIds for many-to-one)
//   - a set picker appears when the engine returned multiple exact-sum sets
//   - "Add to books" opens the create-transaction modal from an unmatched
//     line and fires the create call with the picked category account

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks, passthroughMutation } from '../../test-mocks';
import type { StatementMatchesView } from '../../api/hooks/useBanking';

const confirmMutate = vi.fn();
const createMutate = vi.fn();

const matchesView: StatementMatchesView = {
  statementId: 'stmt-1',
  counts: { auto: 0, confirmed: 0, suggested: 2, unmatched: 1, rejected: 0, excluded: 0 },
  excludedLines: [],
  suggestions: [
    {
      // A1: one deposit ↔ 3 receipts, TWO exact-sum sets → picker.
      statementLine: {
        id: 'sl-g1', lineDate: '2026-04-07', description: 'BRANCH DEPOSIT',
        amount: '60.0000', checkNumber: null, payee: null, matchStatus: 'suggested',
      },
      candidates: [],
      groupCandidates: [
        {
          kind: 'one_to_many',
          journalLines: [
            { journalLineId: 'jl-a', transactionId: 't-a', txnDate: '2026-04-05', txnType: 'deposit', txnNumber: null, checkNumber: null, payee: 'Receipt Alpha', amount: '10.0000', description: null, dateDiffDays: -2 },
            { journalLineId: 'jl-b', transactionId: 't-b', txnDate: '2026-04-06', txnType: 'deposit', txnNumber: null, checkNumber: null, payee: 'Receipt Bravo', amount: '20.0000', description: null, dateDiffDays: -1 },
            { journalLineId: 'jl-c', transactionId: 't-c', txnDate: '2026-04-07', txnType: 'deposit', txnNumber: null, checkNumber: null, payee: 'Receipt Charlie', amount: '30.0000', description: null, dateDiffDays: 0 },
          ],
          memberStatementLines: [],
          sum: '60.0000',
          dateSpanDays: 2,
        },
        {
          kind: 'one_to_many',
          journalLines: [
            { journalLineId: 'jl-d', transactionId: 't-d', txnDate: '2026-04-06', txnType: 'deposit', txnNumber: null, checkNumber: null, payee: 'Receipt Delta', amount: '25.0000', description: null, dateDiffDays: -1 },
            { journalLineId: 'jl-e', transactionId: 't-e', txnDate: '2026-04-07', txnType: 'deposit', txnNumber: null, checkNumber: null, payee: 'Receipt Echo', amount: '35.0000', description: null, dateDiffDays: 0 },
          ],
          memberStatementLines: [],
          sum: '60.0000',
          dateSpanDays: 1,
        },
      ],
    },
    {
      // A2: 3 statement charges ↔ 1 booked monthly total.
      statementLine: {
        id: 'sl-m1', lineDate: '2026-04-05', description: 'SAAS CHARGE 1',
        amount: '-25.0000', checkNumber: null, payee: null, matchStatus: 'suggested',
      },
      candidates: [],
      groupCandidates: [
        {
          kind: 'many_to_one',
          journalLines: [
            { journalLineId: 'jl-100', transactionId: 't-100', txnDate: '2026-04-05', txnType: 'expense', txnNumber: null, checkNumber: null, payee: 'SaaS Vendor', amount: '-75.0000', description: 'Monthly SaaS total', dateDiffDays: 0 },
          ],
          memberStatementLines: [
            { id: 'sl-m1', lineDate: '2026-04-05', description: 'SAAS CHARGE 1', amount: '-25.0000', checkNumber: null, payee: null, matchStatus: 'unmatched' },
            { id: 'sl-m2', lineDate: '2026-04-06', description: 'SAAS CHARGE 2', amount: '-25.0000', checkNumber: null, payee: null, matchStatus: 'unmatched' },
            { id: 'sl-m3', lineDate: '2026-04-07', description: 'SAAS CHARGE 3', amount: '-25.0000', checkNumber: null, payee: null, matchStatus: 'unmatched' },
          ],
          sum: '-75.0000',
          dateSpanDays: 2,
        },
      ],
    },
  ],
  unmatchedLines: [
    {
      id: 'sl-u1', lineDate: '2026-04-08', description: 'MYSTERY FEE',
      amount: '-5.0000', checkNumber: null, payee: null, matchStatus: 'unmatched',
    },
  ],
  outstandingCount: 0,
};

const inProgressRecon = {
  id: 'rec-1',
  accountId: 'acct-1',
  statementDate: '2026-04-30',
  statementEndingBalance: '170.0000',
  beginningBalance: '0.0000',
  status: 'in_progress',
  lines: [],
  clearedBalance: 0,
  difference: 170,
  statement: {
    id: 'stmt-1', periodStart: '2026-04-01', periodEnd: '2026-04-30',
    openingBalance: '0.0000', closingBalance: '170.0000', attachmentId: null, lineCount: 5,
  },
  continuityWarning: null,
};

const statements = [{
  id: 'stmt-1', accountId: 'acct-1', accountName: 'Operating Checking', accountNumber: '1010',
  attachmentId: null, fileName: null, periodStart: '2026-04-01', periodEnd: '2026-04-30',
  openingBalance: '0.00', closingBalance: '170.00', maskedAccountNumber: null, institutionName: null,
  statementType: null, goldenRuleStatus: 'verified', goldenRuleDelta: null,
  reconciliationId: 'rec-1', status: 'in_progress' as const, unpostedCount: 0,
  accountHasInProgress: true, continuityWarning: null, createdAt: '2026-05-01T00:00:00Z',
}];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankStatements: () => ({
    data: { statements, total: 1, gaps: [] },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useReconciliation: (id: string) => ({
    data: id ? { reconciliation: inProgressRecon } : undefined,
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useStatementMatches: () => ({
    data: matchesView, isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useConfirmStatementLine: () => ({ ...passthroughMutation(), mutate: confirmMutate }),
  useCreateFromStatementLine: () => ({ ...passthroughMutation(), mutate: createMutate }),
}));
vi.mock('../../api/hooks/useAccounts', () => ({
  ...accountsMocks(),
  useAccounts: () => ({
    data: {
      data: [
        { id: 'acc-exp', name: 'Supplies', accountType: 'expense', accountNumber: '6000' },
        { id: 'acc-rev', name: 'Revenue', accountType: 'revenue', accountNumber: '4000' },
      ],
      total: 2,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({}) };
});

import { ReconciliationPage } from './ReconciliationPage';

// Enter the worksheet by resuming the in-progress statement reconciliation.
// The statements table defaults to the "not reconciled" filter, so switch it
// to "All statuses" to reveal the in-progress statement's Resume button.
function renderWorksheet() {
  const utils = renderRoute(<ReconciliationPage />);
  fireEvent.change(screen.getByLabelText('Filter by reconciliation status'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  return utils;
}

describe('ReconciliationPage statement match wave 2 UI', () => {
  beforeEach(() => {
    confirmMutate.mockReset();
    createMutate.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a one-to-many group suggestion with member rows and exact-sum chips', () => {
    renderWorksheet();
    expect(screen.getByText(/1 deposit ↔ 3 receipts/)).toBeTruthy();
    expect(screen.getByText('Receipt Alpha')).toBeTruthy();
    expect(screen.getByText('Receipt Bravo')).toBeTruthy();
    expect(screen.getByText('Receipt Charlie')).toBeTruthy();
    expect(screen.getAllByText('Sums exactly').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 items').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2-day span').length).toBeGreaterThan(0);
  });

  it('confirming the set posts the FULL journalLineIds payload', () => {
    renderWorksheet();
    const buttons = screen.getAllByRole('button', { name: /Confirm set/i });
    fireEvent.click(buttons[0]!);
    expect(confirmMutate).toHaveBeenCalledOnce();
    expect(confirmMutate.mock.calls[0]![0]).toEqual({
      lineId: 'sl-g1',
      journalLineIds: ['jl-a', 'jl-b', 'jl-c'],
    });
  });

  it('shows the set picker when multiple exact-sum sets exist and confirms the picked one', () => {
    renderWorksheet();
    expect(screen.getByText(/Multiple exact-sum sets found/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set 2' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Confirm set/i })[0]!);
    expect(confirmMutate.mock.calls[0]![0]).toEqual({
      lineId: 'sl-g1',
      journalLineIds: ['jl-d', 'jl-e'],
    });
  });

  it('renders a many-to-one suggestion and confirms with journalLineId + memberStatementLineIds', () => {
    renderWorksheet();
    expect(screen.getByText(/3 statement lines ↔ 1 book transaction/)).toBeTruthy();
    expect(screen.getByText('SAAS CHARGE 2')).toBeTruthy();
    expect(screen.getByText('SaaS Vendor')).toBeTruthy(); // the one book line
    const buttons = screen.getAllByRole('button', { name: /Confirm set/i });
    fireEvent.click(buttons[1]!);
    expect(confirmMutate).toHaveBeenCalledOnce();
    expect(confirmMutate.mock.calls[0]![0]).toEqual({
      lineId: 'sl-m1',
      journalLineId: 'jl-100',
      memberStatementLineIds: ['sl-m2', 'sl-m3'],
    });
  });

  it('Add to books opens the modal with the line prefilled and fires the create call', () => {
    renderWorksheet();
    fireEvent.click(screen.getByRole('button', { name: /Add to books/i }));

    // Modal shows the read-only line facts and the prefilled memo.
    expect(screen.getByRole('heading', { name: 'Add to books' })).toBeTruthy();
    // Date + amount render in the unmatched row AND read-only in the modal.
    expect(screen.getAllByText('2026-04-08').length).toBeGreaterThan(1);
    expect(screen.getAllByText(/-\$5\.00/).length).toBeGreaterThan(1);
    const create = screen.getByRole('button', { name: /Create transaction/i }) as HTMLButtonElement;
    expect(create.disabled).toBe(true); // no category picked yet

    // Pick the expense category through the account dropdown. The option now
    // renders two lines (number on top, name below), so click the name.
    const accountInput = screen.getByPlaceholderText('Search accounts...');
    fireEvent.focus(accountInput);
    fireEvent.click(screen.getByText('Supplies'));

    fireEvent.click(screen.getByRole('button', { name: /Create transaction/i }));
    expect(createMutate).toHaveBeenCalledOnce();
    expect(createMutate.mock.calls[0]![0]).toEqual({
      lineId: 'sl-u1',
      accountId: 'acc-exp',
      memo: 'MYSTERY FEE',
    });
  });

  it('Confirm all confirms every suggestion at once (top set per group)', () => {
    renderWorksheet();
    fireEvent.click(screen.getByRole('button', { name: /Confirm all/i }));
    expect(confirmMutate).toHaveBeenCalledTimes(2);
    const payloads = confirmMutate.mock.calls.map((c) => c[0]);
    // one_to_many → the FIRST exact-sum set; many_to_one → the anchor line +
    // the other member statement lines.
    expect(payloads).toContainEqual({ lineId: 'sl-g1', journalLineIds: ['jl-a', 'jl-b', 'jl-c'] });
    expect(payloads).toContainEqual({ lineId: 'sl-m1', journalLineId: 'jl-100', memberStatementLineIds: ['sl-m2', 'sl-m3'] });
  });
});
