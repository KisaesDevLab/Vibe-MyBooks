// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { CloseChecklistTask } from '../../../api/hooks/useReviewChecks';

const completeMutate = vi.fn();
const reopenMutate = vi.fn();
const checklistStore: { tasks: CloseChecklistTask[] } = { tasks: [] };

vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ activeCompanyId: 'company-1', activeCompanyName: 'Test Co', companies: [] }),
}));

vi.mock('../../../api/hooks/useReviewChecks', () => ({
  useCloseChecklist: () => ({ data: { tasks: checklistStore.tasks }, isLoading: false }),
  useCompleteChecklistTask: () => ({ mutate: completeMutate, isPending: false }),
  useReopenChecklistTask: () => ({ mutate: reopenMutate, isPending: false }),
}));

import { ChecklistTab } from './ChecklistTab';
import type { ClosePeriod } from './ClosePeriodSelector';

const PERIOD: ClosePeriod = {
  label: 'June 2026',
  periodStart: '2026-06-01T00:00:00.000Z',
  periodEnd: '2026-07-01T00:00:00.000Z',
};

const task = (over: Partial<CloseChecklistTask>): CloseChecklistTask => ({
  key: 'x', section: 'transactions', label: 'X', auto: true, done: false,
  detail: null, manuallyCompleted: false, completedAt: null, note: null, ...over,
});

beforeEach(() => {
  completeMutate.mockReset();
  reopenMutate.mockReset();
  checklistStore.tasks = [
    task({ key: 'reconcile:acct-1', section: 'reconciliations', label: 'Reconcile Checking', done: true, detail: 'Reconciled through 2026-06-30' }),
    task({ key: 'bank_feed', section: 'transactions', label: 'Clear the bank feed', detail: '3 bank-feed items dated in or before this period still need categorizing or approval' }),
    task({ key: 'findings', section: 'review', label: 'Clear review-check findings', detail: '2 findings still open' }),
    task({ key: 'final_review', section: 'final', label: 'Final review of the financial statements', auto: false }),
  ];
});

describe('ChecklistTab', () => {
  it('renders sections with progress and task states', () => {
    renderRoute(<ChecklistTab period={PERIOD} onOpenFindings={() => {}} />);
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
    expect(screen.getByText('1 · Reconcile the accounts')).toBeInTheDocument();
    expect(screen.getByText('Reconciled through 2026-06-30')).toBeInTheDocument();
    expect(screen.getByLabelText('Done')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Not done')).toHaveLength(3);
  });

  it('signs off a task with a note', () => {
    renderRoute(<ChecklistTab period={PERIOD} onOpenFindings={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^sign off$/i })[0]!);
    fireEvent.change(screen.getByLabelText(/Sign-off note/), { target: { value: 'Bank shows zero pending' } });
    fireEvent.click(screen.getByRole('button', { name: /mark done/i }));
    expect(completeMutate).toHaveBeenCalledWith({
      companyId: 'company-1',
      periodStart: '2026-06-01',
      taskKey: 'bank_feed',
      note: 'Bank shows zero pending',
    });
  });

  it('reopens a manual sign-off', () => {
    checklistStore.tasks = [
      task({ key: 'final_review', section: 'final', label: 'Final review', auto: false, done: true, manuallyCompleted: true, note: 'All tie.' }),
    ];
    renderRoute(<ChecklistTab period={PERIOD} onOpenFindings={() => {}} />);
    expect(screen.getByText(/Signed off — All tie\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }));
    expect(reopenMutate).toHaveBeenCalledWith({
      companyId: 'company-1',
      periodStart: '2026-06-01',
      taskKey: 'final_review',
    });
  });

  it('routes the findings task back to the Findings tab', () => {
    const onOpenFindings = vi.fn();
    renderRoute(<ChecklistTab period={PERIOD} onOpenFindings={onOpenFindings} />);
    fireEvent.click(screen.getByRole('button', { name: /open findings/i }));
    expect(onOpenFindings).toHaveBeenCalled();
  });
});
