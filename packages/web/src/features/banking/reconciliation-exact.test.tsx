// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// kisaes-gl-engine reconcile changes (U-188 – U-197) in the web client:
// the worksheet reads the exact strings (clearedBalanceExact /
// differenceExact) and allows Finish only at exactly zero; a refused finish
// shows a plain message from its code; undo is shown to owners / super
// admins only and sends mode clear_checks; reconcile error codes map to
// plain messages.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks, passthroughMutation } from '../../test-mocks';
import { ApiError } from '../../api/client';
import { reconcileErrorMessage } from './reconcileErrors';

const completeMutate = vi.fn();
const undoMutate = vi.fn();
let recon: Record<string, unknown>;
let me: { user: { id: string; role: string; isSuperAdmin: boolean } };
let history: Array<Record<string, unknown>> = [];

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
    data: id ? { reconciliation: recon } : undefined,
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useCompleteReconciliation: () => ({ ...passthroughMutation(), mutate: completeMutate }),
  useReconciliations: () => ({
    data: { reconciliations: history }, isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useUndoReconciliation: () => ({ ...passthroughMutation(), mutate: undoMutate }),
}));
vi.mock('../../api/hooks/useAuth', () => ({ useMe: () => ({ data: me }) }));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../components/forms/AccountSelector', () => ({
  AccountSelector: ({ onChange }: { onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange('acct-1')}>pick account</button>
  ),
}));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({}) };
});

import { ReconciliationPage } from './ReconciliationPage';
import { ReconciliationHistoryPage } from './ReconciliationHistoryPage';

function inProgress(clearedBalanceExact: string, differenceExact: string, legacyDifference: number) {
  return {
    id: 'rec-1', accountId: 'acct-1', statementDate: '2026-04-30', statementEndingBalance: '170.0000',
    beginningBalance: '0.0000', status: 'in_progress', lines: [],
    clearedBalance: Number(clearedBalanceExact), difference: legacyDifference,
    clearedBalanceExact, differenceExact,
    statement: {
      id: 'stmt-1', periodStart: '2026-04-01', periodEnd: '2026-04-30',
      openingBalance: '0.0000', closingBalance: '170.0000', attachmentId: null, lineCount: 0,
    },
    continuityWarning: null,
  };
}

function renderWorksheet() {
  const utils = renderRoute(<ReconciliationPage />);
  fireEvent.change(screen.getByLabelText('Filter by reconciliation status'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  return utils;
}

const finishButton = () => screen.getByRole('button', { name: 'Complete Reconciliation' });

describe('Reconcile worksheet — exact difference', () => {
  beforeEach(() => {
    completeMutate.mockReset();
    me = { user: { id: 'u1', role: 'owner', isSuperAdmin: false } };
  });

  it('keeps Finish disabled for a difference that only rounds to 0.00', () => {
    // The legacy number is 0 (and the old < 0.01 test passed); the exact string is not zero.
    recon = inProgress('169.9960', '0.0040', 0);
    renderWorksheet();
    expect(finishButton()).toBeDisabled();
  });

  it('enables Finish at exactly zero', () => {
    recon = inProgress('170.0000', '0.0000', 0);
    renderWorksheet();
    expect(finishButton()).not.toBeDisabled();
    fireEvent.click(finishButton());
    expect(completeMutate).toHaveBeenCalledWith('rec-1', expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('shows the exact cleared balance and unsigned difference, not the legacy numbers', () => {
    recon = inProgress('1000.0000', '-1234.5650', -999);
    renderWorksheet();
    expect(screen.getByText('$1,234.57')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(finishButton()).toBeDisabled();
  });

  it('a refused finish shows a plain message', async () => {
    recon = inProgress('170.0000', '0.0000', 0);
    completeMutate.mockImplementation((_id: string, opts: { onError: (e: unknown) => void }) => {
      opts.onError(new ApiError('Cannot complete', 'RECONCILE_DIFFERENCE_NOT_ZERO', { difference: '-0.0100' }, 400));
    });
    renderWorksheet();
    fireEvent.click(finishButton());
    expect(await screen.findByText(/The difference is \$0\.01\./)).toBeInTheDocument();
  });
});

describe('Reconciliation history — undo is owner only', () => {
  const done = (id: string, statementDate: string) => ({
    id, accountId: 'acct-1', tenantId: 't1', statementDate, statementEndingBalance: '100.0000',
    beginningBalance: '0', clearedBalance: '100', difference: '0', status: 'complete',
    completedAt: `${statementDate}T12:00:00Z`, completedBy: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', signoffs: null,
  });

  beforeEach(() => {
    undoMutate.mockReset();
    history = [done('r2', '2026-02-28'), done('r1', '2026-01-31')];
  });

  it('hides Undo from a bookkeeper', () => {
    me = { user: { id: 'u2', role: 'bookkeeper', isSuperAdmin: false } };
    renderRoute(<ReconciliationHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'pick account' }));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByText('Locked')).toBeNull();
  });

  it('shows Undo on the latest only to the owner and sends clear_checks', () => {
    me = { user: { id: 'u1', role: 'owner', isSuperAdmin: false } };
    renderRoute(<ReconciliationHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'pick account' }));
    const undo = screen.getAllByRole('button', { name: 'Undo' });
    expect(undo).toHaveLength(1);
    expect(screen.getByText('Locked')).toBeInTheDocument();
    fireEvent.click(undo[0]!);
    expect(undoMutate).toHaveBeenCalledWith({ id: 'r2', mode: 'clear_checks' }, expect.anything());
  });

  it('shows Undo to a super admin', () => {
    me = { user: { id: 'sa', role: 'accountant', isSuperAdmin: true } };
    renderRoute(<ReconciliationHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'pick account' }));
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
  });
});

describe('reconcileErrorMessage', () => {
  const err = (code: string, details?: unknown, status = 409) => new ApiError('server text', code, details, status);

  it('maps every reconcile code to a plain message', () => {
    expect(reconcileErrorMessage(err('RECONCILIATION_IN_PROGRESS', { reconciliationId: 'x' }), 'f'))
      .toMatch(/already has a reconciliation in progress/);
    expect(reconcileErrorMessage(err('RECONCILIATION_NOT_IN_PROGRESS', { status: 'complete' }), 'f'))
      .toMatch(/already finished/);
    expect(reconcileErrorMessage(err('RECONCILIATION_NOT_IN_PROGRESS', { status: 'canceled' }), 'f'))
      .toMatch(/no longer in progress/);
    expect(reconcileErrorMessage(err('RECONCILE_STATEMENT_DATE_ORDER', { latestStatementDate: '2026-03-31' }), 'f'))
      .toMatch(/after 2026-03-31/);
    expect(reconcileErrorMessage(err('RECONCILE_CHARGE_POSTED', { kind: 'interest' }), 'f')).toMatch(/already posted/);
    expect(reconcileErrorMessage(err('RECONCILIATION_NOT_LATEST'), 'f')).toMatch(/most recent/);
    expect(reconcileErrorMessage(err('RECONCILIATION_NOT_COMPLETE', { status: 'in_progress' }), 'f')).toMatch(/Only a finished/);
    expect(reconcileErrorMessage(err('RECONCILE_ADMIN_REQUIRED', undefined, 403), 'f')).toMatch(/company owner/);
    expect(reconcileErrorMessage(err('TB_PERIOD_LOCKED', { lockDate: '2026-03-31' }, 423), 'f'))
      .toMatch(/closed through 2026-03-31/);
    expect(reconcileErrorMessage(err('RECONCILE_DIFFERENCE_NOT_ZERO', { difference: '12.3400' }, 400), 'f'))
      .toMatch(/The difference is \$12\.34\./);
  });

  it('names the reconciliation for RECONCILED_TRANSACTION', () => {
    expect(reconcileErrorMessage(err('RECONCILED_TRANSACTION', { action: 'void', statementDate: '2026-01-31' }), 'f'))
      .toBe("This transaction was cleared in the reconciliation of 2026-01-31, so it can't be voided. "
        + 'Undo that reconciliation first, or record a correcting entry instead.');
    expect(reconcileErrorMessage(err('RECONCILED_TRANSACTION', { action: 'update', field: 'txnDate' }), 'f'))
      .toMatch(/finished bank reconciliation, so its date can't change/);
  });

  it('falls back to the server message, then the fallback', () => {
    expect(reconcileErrorMessage(err('SOMETHING_ELSE'), 'f')).toBe('server text');
    expect(reconcileErrorMessage(new Error('plain'), 'f')).toBe('plain');
    expect(reconcileErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
