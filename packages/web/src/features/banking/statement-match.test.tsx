// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Statement Match Engine wave 1 UI: the "Match statement" button runs the
// matcher and shows the results banner; the suggestions panel renders the
// statement line vs candidate with evidence chips; Confirm posts the picked
// candidate's journal line; Reject posts the rejection; unmatched statement
// lines and the outstanding chip render from the persisted view.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks, passthroughMutation } from '../../test-mocks';
import type { StatementMatchResult, StatementMatchesView } from '../../api/hooks/useBanking';

const matchMutate = vi.fn();
const confirmMutate = vi.fn();
const rejectMutate = vi.fn();

const matchResult: StatementMatchResult = {
  autoCleared: 2,
  suggestions: [
    {
      statementLine: {
        id: 'sl-1', lineDate: '2026-04-05', description: 'OFFICE SUPPLIES STORE',
        amount: '-100.0000', checkNumber: null, payee: null, matchStatus: 'suggested',
      },
      candidates: [],
    },
  ],
  unmatchedLines: [
    {
      id: 'sl-2', lineDate: '2026-04-08', description: 'MYSTERY FEE',
      amount: '-5.0000', checkNumber: null, payee: null, matchStatus: 'unmatched',
    },
  ],
  outstandingCount: 3,
  skippedLines: 0,
  skippedAmbiguousGroups: 0,
};

const matchesView: StatementMatchesView = {
  statementId: 'stmt-1',
  counts: { auto: 2, confirmed: 0, suggested: 1, unmatched: 1, rejected: 0 },
  suggestions: [
    {
      statementLine: {
        id: 'sl-1', lineDate: '2026-04-05', description: 'OFFICE SUPPLIES STORE',
        amount: '-100.0000', checkNumber: null, payee: null, matchStatus: 'suggested',
      },
      candidates: [
        {
          journalLineId: 'jl-1', transactionId: 'txn-1', txnDate: '2026-04-04', txnType: 'expense',
          txnNumber: 'EXP-9', checkNumber: null, payee: 'Office Depot', amount: '-99.9900',
          description: 'Office supplies', composite: 0.82, amountScore: 0.85, dateScore: 1,
          nameScore: 0.92, pool: 'B', checkExact: false, amountDelta: -0.01, dateDiffDays: -1,
        },
        {
          journalLineId: 'jl-2', transactionId: 'txn-2', txnDate: '2026-04-05', txnType: 'expense',
          txnNumber: null, checkNumber: 1234, payee: 'Staples', amount: '-100.0000',
          description: 'Supplies run', composite: 0.8, amountScore: 1, dateScore: 1,
          nameScore: 0.1, pool: 'A', checkExact: false, amountDelta: 0, dateDiffDays: 0,
        },
      ],
    },
  ],
  unmatchedLines: [
    {
      id: 'sl-2', lineDate: '2026-04-08', description: 'MYSTERY FEE',
      amount: '-5.0000', checkNumber: null, payee: null, matchStatus: 'unmatched',
    },
  ],
  outstandingCount: 3,
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
    openingBalance: '0.0000', closingBalance: '170.0000', attachmentId: null, lineCount: 4,
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
  useMatchStatement: () => ({ ...passthroughMutation(), mutate: matchMutate }),
  useStatementMatches: () => ({
    data: matchesView, isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useConfirmStatementLine: () => ({ ...passthroughMutation(), mutate: confirmMutate }),
  useRejectStatementLine: () => ({ ...passthroughMutation(), mutate: rejectMutate }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({}) };
});

import { ReconciliationPage } from './ReconciliationPage';

// Enter the worksheet by resuming the in-progress statement reconciliation.
function renderWorksheet() {
  const utils = renderRoute(<ReconciliationPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  return utils;
}

describe('ReconciliationPage statement match UI', () => {
  beforeEach(() => {
    matchMutate.mockReset();
    confirmMutate.mockReset();
    rejectMutate.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Match statement button when the linked statement has lines, and runs the match', () => {
    renderWorksheet();
    const btn = screen.getByRole('button', { name: /Match statement/i });
    fireEvent.click(btn);
    expect(matchMutate).toHaveBeenCalledOnce();
    expect(matchMutate.mock.calls[0]![0]).toBe('rec-1');
  });

  it('shows the results banner after a match run', () => {
    matchMutate.mockImplementation((_id: string, opts?: { onSuccess?: (r: StatementMatchResult) => void }) => {
      opts?.onSuccess?.(matchResult);
    });
    renderWorksheet();
    fireEvent.click(screen.getByRole('button', { name: /Match statement/i }));
    // The full banner line (a toast also mentions the counts, so match the
    // banner's complete "a · b · c · d" text).
    expect(screen.getByText(/2 auto-cleared · 1 suggestion · 1 statement line unmatched · 3 outstanding items/)).toBeTruthy();
  });

  it('renders the suggestion with evidence chips and confirms the picked candidate', () => {
    renderWorksheet();
    // Statement line summary + both candidates render.
    expect(screen.getByText(/Suggested matches \(1\)/)).toBeTruthy();
    expect(screen.getByText('OFFICE SUPPLIES STORE')).toBeTruthy();
    expect(screen.getByText('Office Depot')).toBeTruthy();
    expect(screen.getByText('Staples')).toBeTruthy();
    // Evidence chips: near-amount delta on the pool-B candidate, exact amount
    // on the pool-A one, payee similarity, same-day.
    expect(screen.getByText('Amount differs by $0.01')).toBeTruthy();
    expect(screen.getByText('Exact amount')).toBeTruthy();
    expect(screen.getByText('Payee 92%')).toBeTruthy();
    expect(screen.getByText('Same day')).toBeTruthy();

    // Default pick is the top candidate (jl-1); confirm posts it.
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    expect(confirmMutate).toHaveBeenCalledOnce();
    expect(confirmMutate.mock.calls[0]![0]).toEqual({ lineId: 'sl-1', journalLineId: 'jl-1' });
  });

  it('confirms a different candidate after picking it', () => {
    renderWorksheet();
    const radios = screen.getAllByRole('radio');
    // Two mode radios never render here (worksheet, not upload) — these are
    // the candidate pickers. Pick the second candidate.
    fireEvent.click(radios[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    expect(confirmMutate.mock.calls[0]![0]).toEqual({ lineId: 'sl-1', journalLineId: 'jl-2' });
  });

  it('rejects a suggestion', () => {
    renderWorksheet();
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    expect(rejectMutate).toHaveBeenCalledOnce();
    expect(rejectMutate.mock.calls[0]![0]).toBe('sl-1');
  });

  it('lists unmatched statement lines and the outstanding chip', () => {
    renderWorksheet();
    expect(screen.getByText(/On the statement, not in your books \(1\)/)).toBeTruthy();
    expect(screen.getByText('MYSTERY FEE')).toBeTruthy();
    expect(screen.getByText(/3 outstanding items — in your books, not on the statement/)).toBeTruthy();
  });
});
