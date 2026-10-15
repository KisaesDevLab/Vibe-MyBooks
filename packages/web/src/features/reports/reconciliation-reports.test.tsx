// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Reconciliation Detail and Bank Reconciliation Summary report pages render
// the professional reconciliation: Section A (statement to books) first,
// then the cleared roll, schedules (detail: every item; summary: totals and
// the oldest items), the cleared list (detail only), subsequent activity,
// book-side proof and the sign-off block.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { companyProviderMocks } from '../../test-mocks';
import { makeProof, makeDiscrepantProof } from './reconciliation/proofFixture';
import type { ReconProof } from '@kis-books/shared';

const apiClient = vi.fn();
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClient(...args) };
});

import { ReconciliationDetailReport } from './ReconciliationDetailReport';
import { BankReconciliationSummaryReport } from './BankReconciliationSummaryReport';

function detailResponse(proof: ReconProof) {
  return {
    title: 'Reconciliation Detail',
    reconciliation: {
      id: 'rec-1', accountId: 'acct-1', accountName: proof.accountName, accountNumber: '10100',
      statementDate: '2026-09-30', beginningBalance: 54533.95, statementEndingBalance: 25526.79,
      clearedBalance: 25526.79, difference: 0, status: 'complete', completedAt: '2026-10-05T15:00:00Z', completedBy: 'Kurt',
    },
    statement: null,
    cleared: [{ txnDate: '2026-09-02', txnType: 'deposit', txnNumber: null, description: 'Customer deposit', payment: null, deposit: 1200 }],
    uncleared: [],
    totals: { clearedPayments: 290662.15, clearedDeposits: 261654.99, unclearedPayments: 4633.33, unclearedDeposits: 781.72 },
    proof,
  };
}

function headingsInOrder(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
}

describe('Reconciliation Detail report', () => {
  beforeEach(() => apiClient.mockReset());

  it('leads with the bank-to-books summary and follows the professional section order', async () => {
    apiClient.mockResolvedValue(detailResponse(makeProof()));
    renderRoute(<ReconciliationDetailReport />, { route: '/reports/reconciliation-detail?reconciliation_id=rec-1' });
    await waitFor(() => expect(screen.getByTestId('recon-summary')).toBeTruthy());
    expect(apiClient).toHaveBeenCalledWith('/reports/reconciliation-detail?reconciliation_id=rec-1');

    const lines = Array.from(screen.getByTestId('recon-summary-lines').querySelectorAll('tr')).map((r) => r.getAttribute('data-line'));
    expect(lines).toEqual(['statement', 'increases', 'decreases', 'adjusted_statement', 'books', 'adjusted_books', 'unreconciled']);
    expect(screen.getByTestId('recon-verdict').textContent).toContain('Reconciled to books');

    const h = headingsInOrder();
    const idx = (t: string) => h.findIndex((x) => x.startsWith(t));
    expect(idx('Reconciliation summary')).toBeLessThan(idx('Cleared activity'));
    expect(idx('Cleared activity')).toBeLessThan(idx('Supporting schedules'));
    expect(idx('Supporting schedules')).toBeLessThan(idx('Cleared Transactions'));
    expect(idx('Cleared Transactions')).toBeLessThan(idx('Subsequent activity'));
    expect(idx('Subsequent activity')).toBeLessThan(idx('Book-side proof'));
    expect(idx('Book-side proof')).toBeLessThan(idx('Sign-off'));

    // Every outstanding item is listed with its stale flag.
    const schedules = screen.getByTestId('recon-schedules');
    expect(within(schedules).getAllByTestId('recon-flag')).toHaveLength(4);
    expect(schedules.textContent).toContain('Total outstanding checks and payments (3)');
    expect(screen.getByTestId('recon-subsequent').textContent).toContain('Register balance as of 10/13/2026');
    expect(screen.getByTestId('recon-signoff').textContent).toContain('Reviewed by');
    expect(screen.getByRole('link', { name: 'Reconciliation summary' }).getAttribute('href'))
      .toBe('/reports/bank-reconciliation-summary?reconciliation_id=rec-1');
  });

  it('explains a book-side discrepancy with drill-down links', async () => {
    apiClient.mockResolvedValue(detailResponse(makeDiscrepantProof()));
    renderRoute(<ReconciliationDetailReport />, { route: '/reports/reconciliation-detail?reconciliation_id=rec-1' });
    await waitFor(() => expect(screen.getByTestId('recon-book-proof')).toBeTruthy());
    expect(screen.getByTestId('recon-verdict').textContent).toContain('Not reconciled to books');
    const proof = screen.getByTestId('recon-book-proof');
    expect(proof.textContent).toContain('Changes to previously reconciled transactions');
    expect(within(proof).getByRole('link', { name: '2026-08-31' }).getAttribute('href'))
      .toBe('/reports/reconciliation-detail?reconciliation_id=rec-aug');
    expect(within(proof).getByRole('link', { name: '2026-08-10' }).getAttribute('href')).toBe('/transactions/txn-101');
  });
});

describe('Bank Reconciliation Summary report', () => {
  beforeEach(() => apiClient.mockReset());

  const summaryResponse = (proofs: ReconProof[]) => ({
    title: 'Bank Reconciliation Summary',
    accounts: [{
      accountId: 'acct-1', accountNumber: '10100', name: 'Checking - First National #6893',
      lastReconciledDate: '2026-09-30', lastReconciledBalance: 25526.79, latestStatementEnd: '2026-09-30',
      statementCount: 9, statementGapCount: 0, unclearedCount: 4, oldestUnclearedDate: '2025-02-10', staleCheckCount: 0,
    }],
    staleChecks: [],
    proofs,
  });

  it('shows each account\'s bank-to-books reconciliation with schedule totals and the oldest items', async () => {
    apiClient.mockResolvedValue(summaryResponse([makeProof()]));
    renderRoute(<BankReconciliationSummaryReport />, { route: '/reports/bank-reconciliation-summary' });
    await waitFor(() => expect(screen.getByTestId('recon-proof-block')).toBeTruthy());
    expect(apiClient).toHaveBeenCalledWith('/reports/bank-reconciliation-summary');
    const block = screen.getByTestId('recon-proof-block');
    expect(block.textContent).toContain('10100 · Checking - First National #6893 — reconciliation as of 2026-09-30');
    expect(within(block).getByTestId('recon-summary-lines').textContent).toContain('Balance per books (general ledger), 09/30/2026');
    expect(within(block).getByTestId('recon-book-proof')).toBeTruthy();
    expect(within(block).getByTestId('recon-subsequent')).toBeTruthy();
    expect(within(block).getByTestId('recon-signoff')).toBeTruthy();
    // Summary mode: no cleared list.
    expect(block.textContent).not.toContain('Cleared Transactions');
  });

  it('summarizes one reconciliation when reconciliation_id is in the URL', async () => {
    apiClient.mockResolvedValue(summaryResponse([makeProof()]));
    renderRoute(<BankReconciliationSummaryReport />, { route: '/reports/bank-reconciliation-summary?reconciliation_id=rec-1' });
    await waitFor(() => expect(screen.getByTestId('recon-proof-block')).toBeTruthy());
    expect(apiClient).toHaveBeenCalledWith('/reports/bank-reconciliation-summary?reconciliation_id=rec-1');
  });

  it('says so when no account has a completed reconciliation', async () => {
    apiClient.mockResolvedValue(summaryResponse([]));
    renderRoute(<BankReconciliationSummaryReport />, { route: '/reports/bank-reconciliation-summary' });
    await waitFor(() => expect(screen.getByText(/No completed reconciliations yet/)).toBeTruthy());
  });
});
