// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const postMutate = vi.fn();
const postAllMutate = vi.fn();
const createMutate = vi.fn();
const store = {
  entries: [
    { id: 'e1', schedule_id: 's1', description: 'Annual policy', kind: 'prepaid', period_start: '2026-08-01', post_period: '2026-08-01', amount: '100.0000', is_catch_up: false, status: 'draft', transaction_id: null, balance_account_name: 'Prepaid Insurance', recognition_account_name: 'Insurance Expense' },
    { id: 'e2', schedule_id: 's2', description: 'Software', kind: 'prepaid', period_start: '2026-07-01', post_period: '2026-08-01', amount: '50.0000', is_catch_up: true, status: 'draft', transaction_id: null, balance_account_name: 'Prepaid', recognition_account_name: 'Software' },
  ],
};

vi.mock('../../../api/hooks/useAccruals', () => ({
  useAccrualEntries: () => ({ data: { entries: store.entries }, isLoading: false }),
  useAccrualSchedules: () => ({ data: { schedules: [] } }),
  useAccrualCandidates: () => ({ data: { unscheduled: [], possiblePrepaids: [], missingRecurring: [{ contact_id: 'c1', payee: 'Acme Janitorial', months: 4, avg_amount: '350.00' }] }, isLoading: false }),
  useAccrualTieOut: () => ({ data: { rows: [] } }),
  usePostAccrualEntry: () => ({ mutate: postMutate, isPending: false }),
  useUnpostAccrualEntry: () => ({ mutate: vi.fn(), isPending: false }),
  usePostAllAccruals: () => ({ mutate: postAllMutate, isPending: false }),
  useCancelAccrualSchedule: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAccrualSchedule: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateAccrualSchedule: () => ({ mutate: createMutate, isPending: false }),
  useImportAccruals: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../../providers/CompanyProvider', () => ({ useCompanyContext: () => ({ activeCompanyId: null }) }));
vi.mock('../../../components/forms/AccountSelector', () => ({
  AccountSelector: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { AccrualsTab } from './AccrualsTab';

const PERIOD = { label: 'August 2026', periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' };

beforeEach(() => { postMutate.mockReset(); postAllMutate.mockReset(); createMutate.mockReset(); });

describe('AccrualsTab', () => {
  it('lists the month\'s entries, including catch-up, and posts on click only', () => {
    renderRoute(<AccrualsTab period={PERIOD} />);
    expect(screen.getByText('Annual policy')).toBeTruthy();
    expect(screen.getByText(/catch-up for Jul 2026/)).toBeTruthy();
    expect(postMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0]!);
    expect(postMutate).toHaveBeenCalledWith('e1', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Post all 2' }));
    expect(postAllMutate).toHaveBeenCalledWith({ companyId: null, periodStart: '2026-08-01' }, expect.anything());
  });

  it('turns a missing recurring bill into a one-month accrued expense draft with a preview', () => {
    renderRoute(<AccrualsTab period={PERIOD} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accrue it' }));
    expect((screen.getByLabelText('Schedule type') as HTMLSelectElement).value).toBe('accrued_expense');
    expect(screen.getByText(/1 month: Aug 2026 \$350\.00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Accrued liability account (balance sheet)'), { target: { value: 'acct-liab' } });
    fireEvent.change(screen.getByLabelText('Expense account'), { target: { value: 'acct-exp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'accrued_expense', totalAmount: '350.00', months: 1, balanceAccountId: 'acct-liab', recognitionAccountId: 'acct-exp',
    }), expect.anything());
  });
});
