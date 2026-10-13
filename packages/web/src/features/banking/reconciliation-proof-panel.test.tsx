// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Reconcile screen — the bank-to-books panel (Section A of the professional
// reconciliation): statement balance → adjustments → adjusted bank balance →
// balance per books → adjusted book balance → unreconciled difference, the
// "Reconciled to books" verdict, stale badges on worksheet rows, and the
// warning banner (with discrepancy details) when the book-side proof fails.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks } from '../../test-mocks';
import { makeProof, makeDiscrepantProof } from '../reports/reconciliation/proofFixture';
import type { ReconProof } from '@kis-books/shared';

let currentProof: ReconProof = makeProof();

const inProgressRecon = {
  id: 'rec-1', accountId: 'acct-1', statementDate: '2026-09-30', statementEndingBalance: '25526.7900',
  beginningBalance: '54533.9500', status: 'in_progress', clearedBalance: 25526.79, difference: 0,
  statement: null, continuityWarning: null,
  lines: [
    {
      id: 'rl-1', journal_line_id: 'jl-pr1', transaction_id: 'txn-jl-pr1', is_cleared: false, cleared_at: null,
      debit: '0', credit: '1500.0000', description: '[AP:PR] payroll', txn_date: '2025-02-10', txn_type: 'journal_entry',
      txn_number: null, memo: null, check_number: null, payee_name_on_check: null, contact_id: null, contact_name: null,
      likely_duplicate: false, duplicate_of: null,
    },
    {
      id: 'rl-2', journal_line_id: 'jl-ok', transaction_id: 'txn-ok', is_cleared: true, cleared_at: null,
      debit: '200.0000', credit: '0', description: 'Cleared deposit', txn_date: '2026-09-15', txn_type: 'deposit',
      txn_number: null, memo: null, check_number: null, payee_name_on_check: null, contact_id: null, contact_name: null,
      likely_duplicate: false, duplicate_of: null,
    },
  ],
};

const statements = [{
  id: 'stmt-1', accountId: 'acct-1', accountName: 'Operating Checking', accountNumber: '1010',
  attachmentId: null, fileName: null, periodStart: '2026-09-01', periodEnd: '2026-09-30',
  openingBalance: '0.00', closingBalance: '25526.79', maskedAccountNumber: null, institutionName: null,
  statementType: null, goldenRuleStatus: 'verified', goldenRuleDelta: null,
  reconciliationId: 'rec-1', status: 'in_progress' as const, unpostedCount: 0,
  accountHasInProgress: true, continuityWarning: null, createdAt: '2026-10-01T00:00:00Z',
}];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankStatements: () => ({ data: { statements, total: 1, gaps: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useReconciliation: (id: string) => ({
    data: id ? { reconciliation: inProgressRecon } : undefined, isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useReconciliationProof: (id: string) => ({
    data: id ? { proof: currentProof } : undefined, isLoading: false, isError: false, refetch: vi.fn(),
  }),
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

function renderWorksheet() {
  const utils = renderRoute(<ReconciliationPage />);
  fireEvent.change(screen.getByLabelText('Filter by reconciliation status'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  return utils;
}

describe('Reconcile screen — bank-to-books panel', () => {
  beforeEach(() => {
    currentProof = makeProof();
    window.sessionStorage.clear();
  });

  it('shows statement → adjusted bank balance → balance per books → unreconciled difference, in order', () => {
    renderWorksheet();
    const panel = screen.getByTestId('recon-proof-panel');
    const rows = within(panel).getByTestId('recon-panel-lines').querySelectorAll('tr');
    const text = Array.from(rows).map((r) => r.textContent);
    expect(text).toEqual([
      'Balance per bank statement, 09/30/202625,526.79',
      'Add: Deposits in transit (1)781.72',
      'Less: Outstanding checks and payments (3)(4,633.33)',
      'Adjusted bank balance21,675.18',
      'Balance per books (general ledger), 09/30/202621,675.18',
      'Adjusted book balance21,675.18',
      'Unreconciled difference0.00',
    ]);
    expect(within(panel).getByTestId('recon-panel-verdict').textContent).toContain('Reconciled to books');
    expect(within(panel).getByText(/3 stale-dated \(over 180 days\)/)).toBeTruthy();
    expect(screen.queryByTestId('recon-proof-warning')).toBeNull();
    // The existing tiles are still there.
    expect(screen.getByText('Statement Balance')).toBeTruthy();
    expect(screen.getByText('Difference')).toBeTruthy();
  });

  it('flags the stale outstanding item in the worksheet list, not the cleared row', () => {
    renderWorksheet();
    const badges = screen.getAllByTestId('recon-flag');
    expect(badges).toHaveLength(1);
    expect(badges[0]!.textContent).toBe('Stale-dated (597 days) — review / void / escheat');
    expect(badges[0]!.closest('tr')!.textContent).toContain('[AP:PR] payroll');
  });

  it('warns when the book-side proof does not tie and reveals the discrepancy details', () => {
    currentProof = makeDiscrepantProof();
    renderWorksheet();
    const warn = screen.getByTestId('recon-proof-warning');
    expect(warn.textContent).toContain('discrepancy (10.00)');
    expect(screen.getByTestId('recon-panel-verdict').textContent).toContain('Unreconciled difference 10.00');
    fireEvent.click(within(warn).getByRole('button', { name: 'Show discrepancy details' }));
    const item = screen.getByTestId('recon-discrepancy-item');
    expect(item.textContent).toContain('Edited after it was reconciled');
    expect(within(item).getByRole('link', { name: '2026-08-10' }).getAttribute('href')).toBe('/transactions/txn-101');
  });

  it('uses credit-card wording for a liability account', () => {
    currentProof = makeProof({ orientation: 'liability', accountType: 'liability' });
    currentProof = { ...currentProof, labels: { ...currentProof.labels, ...{
      statementBalance: 'Balance per card statement (amount owed)',
      increases: 'Charges recorded in books, not yet on statement',
      decreases: 'Payments and credits recorded in books, not yet on statement',
      adjustedStatementBalance: 'Adjusted statement balance',
    } } };
    renderWorksheet();
    const panel = screen.getByTestId('recon-proof-panel');
    expect(panel.textContent).toContain('balances are shown as amounts owed');
    expect(panel.textContent).toContain('Balance per card statement (amount owed), 09/30/2026');
    expect(panel.textContent).toContain('Add: Charges recorded in books, not yet on statement (1)');
  });
});
