// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Statement-driven reconciliation UI: the Statements table on the
// Reconciliation page — rows render with status/readiness/golden-rule
// state, the gap callout shows missing months, the Reconcile button calls
// start with { statementId } (after the not-posted warning confirm), and
// an account with an in-progress reconciliation disables the button.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks, passthroughMutation } from '../../test-mocks';

const startMutate = vi.fn();

const statements = [
  {
    id: 'stmt-1',
    accountId: 'acct-1',
    accountName: 'Operating Checking',
    accountNumber: '1010',
    attachmentId: 'att-1',
    fileName: 'jan.pdf',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    openingBalance: '100.00',
    closingBalance: '170.00',
    maskedAccountNumber: '4321',
    institutionName: 'Test Bank',
    statementType: 'CHECKING',
    goldenRuleStatus: 'discrepancy',
    goldenRuleDelta: '-1.2500',
    reconciliationId: null,
    status: 'not_reconciled' as const,
    unpostedCount: 2,
    accountHasInProgress: false,
    continuityWarning: null,
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'stmt-2',
    accountId: 'acct-2',
    accountName: 'Savings',
    accountNumber: '1020',
    attachmentId: null,
    fileName: null,
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    openingBalance: null,
    closingBalance: '500.00',
    maskedAccountNumber: null,
    institutionName: null,
    statementType: null,
    goldenRuleStatus: 'verified',
    goldenRuleDelta: null,
    reconciliationId: null,
    status: 'not_reconciled' as const,
    unpostedCount: 0,
    accountHasInProgress: true,
    continuityWarning: null,
    createdAt: '2026-04-01T00:00:00Z',
  },
];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankStatements: () => ({
    data: {
      statements,
      total: 2,
      gaps: [{ accountId: 'acct-1', accountName: 'Operating Checking', missingMonths: ['2026-02'] }],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useStartReconciliation: () => ({ ...passthroughMutation(), mutate: startMutate }),
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

describe('ReconciliationPage statements table', () => {
  beforeEach(() => {
    startMutate.mockClear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders statement rows with period, balance, readiness and status', () => {
    renderRoute(<ReconciliationPage />);
    expect(screen.getByText('Statements on File')).toBeTruthy();
    expect(screen.getByText('Operating Checking')).toBeTruthy();
    expect(screen.getByText(/2026-01-01 – 2026-01-31/)).toBeTruthy();
    expect(screen.getByText('$170.00')).toBeTruthy();
    expect(screen.getByText('2 not posted')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getAllByText('Not reconciled').length).toBe(2);
  });

  it('shows the coverage gap callout', () => {
    renderRoute(<ReconciliationPage />);
    expect(screen.getByText(/no statement on file for 2026-02/)).toBeTruthy();
  });

  it('flags a golden-rule discrepancy with a tooltip carrying the delta', () => {
    renderRoute(<ReconciliationPage />);
    const flagged = document.querySelector('[title*="off by $1.25"]');
    expect(flagged).toBeTruthy();
  });

  it('starts a reconciliation with the statement id after confirming the readiness warning', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute(<ReconciliationPage />);
    const buttons = screen.getAllByRole('button', { name: 'Reconcile' });
    fireEvent.click(buttons[0]!);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0]![0]).toContain('2 imported items');
    expect(startMutate).toHaveBeenCalledWith({ statementId: 'stmt-1' }, expect.anything());
  });

  it('does not start when the readiness warning is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderRoute(<ReconciliationPage />);
    const buttons = screen.getAllByRole('button', { name: 'Reconcile' });
    fireEvent.click(buttons[0]!);
    expect(startMutate).not.toHaveBeenCalled();
  });

  it('disables Reconcile when the account already has a reconciliation in progress', () => {
    renderRoute(<ReconciliationPage />);
    const buttons = screen.getAllByRole('button', { name: 'Reconcile' }) as HTMLButtonElement[];
    // Second row (Savings) belongs to an account with an in-progress rec.
    expect(buttons[1]!.disabled).toBe(true);
    fireEvent.click(buttons[1]!);
    expect(startMutate).not.toHaveBeenCalled();
  });
});
