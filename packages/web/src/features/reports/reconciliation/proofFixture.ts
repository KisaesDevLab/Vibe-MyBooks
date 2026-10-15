// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Test fixture: a completed checking reconciliation shaped like the
// ROCA LLC September sample (statement 25,526.79, one deposit in transit,
// three stale-dated [AP:PR] journal entries outstanding). Used by the
// Reconcile-screen and report-page component tests.

import { emptyReconSignoffEntry, reconLabels, type ReconProof } from '@kis-books/shared';

export function makeProof(over: Partial<ReconProof> = {}): ReconProof {
  const item = (id: string, date: string, desc: string, amount: number, age: number, flag: ReconProof['schedules']['decreases']['items'][number]['flag'], label: string | null) => ({
    journalLineId: id, transactionId: `txn-${id}`, txnDate: date, txnType: 'journal_entry', number: null,
    payee: null, description: desc, amount, ageDays: age, flag, flagLabel: label,
  });
  return {
    reconciliationId: 'rec-1', accountId: 'acct-1', accountName: 'Checking - First National #6893', accountNumber: '10100',
    accountType: 'asset', orientation: 'asset', status: 'complete', statementDate: '2026-09-30', asOfToday: '2026-10-13',
    labels: reconLabels('asset'),
    summary: {
      statementBalance: 25526.79, increases: { count: 1, total: 781.72 }, decreases: { count: 3, total: 4633.33 },
      adjustedStatementBalance: 21675.18, bookBalance: 21675.18, unrecorded: null, unrecordedNote: null,
      adjustedBookBalance: 21675.18, unreconciledDifference: 0, reconciledToBooks: true, explanations: [],
    },
    clearedRoll: {
      beginningBalance: 54533.95, clearedIncreases: { count: 60, total: 261654.99 }, clearedDecreases: { count: 80, total: 290662.15 },
      clearedBalance: 25526.79, statementBalance: 25526.79, difference: 0,
    },
    schedules: {
      increases: { label: 'Deposits in transit', count: 1, total: 781.72, items: [item('jl-dit', '2026-09-12', 'AMEX expense deposit', 781.72, 18, 'investigate', 'Investigate (18 days in transit)')] },
      decreases: { label: 'Outstanding checks and payments', count: 3, total: 4633.33, items: [
        item('jl-pr1', '2025-02-10', '[AP:PR] payroll', 1500, 597, 'stale_dated', 'Stale-dated (597 days) — review / void / escheat'),
        item('jl-pr2', '2025-12-29', '[AP:PR] payroll', 2000, 275, 'stale_dated', 'Stale-dated (275 days) — review / void / escheat'),
        item('jl-pr3', '2025-12-29', '[AP:PR] payroll', 1133.33, 275, 'stale_dated', 'Stale-dated (275 days) — review / void / escheat'),
      ] },
      unrecorded: [],
    },
    flagCounts: { stale: 0, staleDated: 3, investigate: 1 },
    subsequent: {
      afterStatement: { count: 12, total: -3200.5 }, unclearedAfterStatement: { count: 12, total: -3200.5 },
      registerBalanceToday: 18474.68, futureDated: { count: 0, total: 0 }, endingRegisterBalance: 18474.68,
    },
    bookProof: {
      beginningBalance: 54533.95, clearedThisReconciliation: -29007.16, outstandingNet: -3851.61,
      expectedBookBalance: 21675.18, bookBalance: 21675.18, discrepancy: 0, ties: true,
      components: { changesToPriorReconciled: 0, priorReconciledNowAfterStatement: 0, clearedOutOfPeriod: 0, beginningBalanceVariance: 0 },
      priorChanges: [], items: [], explanations: [],
    },
    signOff: {
      preparedBy: 'Kurt', preparedAt: '2026-10-05T15:00:00Z', reviewedBy: null, reviewedAt: null,
      completedBy: 'Kurt', completedAt: '2026-10-05T14:00:00Z',
      signoffs: {
        signable: true,
        preparer: {
          ...emptyReconSignoffEntry('preparer'), state: 'signed', signoffId: 'so-1', userId: 'u-kurt',
          signerName: 'Kurt', signedAt: '2026-10-05T15:00:00Z',
        },
        reviewer: emptyReconSignoffEntry('reviewer'),
      },
      statementFileName: 'sept.pdf', statementAttachmentId: 'att-1', statementPeriod: '2026-09-01 – 2026-09-30',
    },
    ...over,
  };
}

/** The same reconciliation after a reconciled check was edited (−10.00 discrepancy). */
export function makeDiscrepantProof(): ReconProof {
  const p = makeProof();
  return {
    ...p,
    summary: {
      ...p.summary, bookBalance: 21665.18, adjustedBookBalance: 21665.18, unreconciledDifference: 10, reconciledToBooks: false,
      explanations: ['The books differ from the reconciled activity by (10.00) — see Reconciliation discrepancies.'],
    },
    bookProof: {
      ...p.bookProof, bookBalance: 21665.18, discrepancy: -10, ties: false,
      components: { ...p.bookProof.components, changesToPriorReconciled: -10 },
      priorChanges: [{ reconciliationId: 'rec-aug', statementDate: '2026-08-31', clearedAtCompletion: 800, clearedNow: 790, change: -10 }],
      items: [{
        reconciliationId: 'rec-aug', reconciliationDate: '2026-08-31', thisReconciliation: false, journalLineId: 'jl-101',
        transactionId: 'txn-101', txnDate: '2026-08-10', txnType: 'expense', number: '101', description: 'Check 101',
        currentAmount: -210, reasons: ['edited_after_reconciliation'], editedAt: '2026-10-01T12:00:00Z',
      }],
      explanations: ['Previously reconciled transactions were changed, voided or deleted after they were reconciled (net (10.00)).'],
    },
  };
}
