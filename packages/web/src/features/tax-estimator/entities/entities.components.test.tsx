// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { TaxBasisAccountLine, TaxBasisPl, BooksReadiness, TreatmentSuggestion, EntityYearInputsDto } from '@kis-books/shared';

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxpayers: () => ({ data: { data: [{ id: 'tp1', displayName: 'Rivera' }] } }),
  useTaxpayer: () => ({ data: { persons: [{ id: 'p1', firstName: 'Daniel', lastName: 'Rivera' }] } }),
  useTaxEstimatorScope: () => ({ data: { firmRole: 'firm_staff' } }),
}));

import { TreatmentTable } from './TreatmentTable';
import { SuggestionsBanner } from './SuggestionsBanner';
import { YearInputsPanel } from './YearInputsPanel';
import { ReadinessPanel } from './ReadinessPanel';
import { PreviewCard } from './PreviewCard';
import { buildRows } from './rows';

const line = (o: Partial<TaxBasisAccountLine>): TaxBasisAccountLine => ({
  accountId: 'a1', accountNumber: '6200', name: 'Owner health insurance', accountType: 'expense', character: 'ordinary',
  characterSource: 'tb_assignment', taxCode: { returnForm: '1040', activityType: 'sch_c', code: 'C-15', description: 'Insurance' },
  treatment: null, effectiveTreatment: null, treatmentSource: null, personId: null,
  pct: null, route: 'entity', accountNonRecurring: false, bookAmount: '-10800.0000', taxAmount: '-10800.0000',
  reclass: '0.0000', nonRecurringBookAmount: '0.0000', tbTaxRje: '0.0000', ...o,
});
const sugg: TreatmentSuggestion = {
  accountId: 'a1', accountNumber: '6200', accountName: 'Owner health insurance', accountType: 'expense',
  treatment: 'owner_sehi', pct: null, paymentJurisdiction: null, reason: 'Name matches health insurance', basis: 'name',
};
const lines = [
  line({}),
  line({ accountId: 'a2', accountNumber: '6900', name: 'Misc', taxCode: null, bookAmount: '-500.0000', taxAmount: '-500.0000' }),
  line({ accountId: 'a3', accountNumber: '6420', name: 'Meals', treatment: 'nondeductible_pct', pct: '50.0000' }),
];

describe('TreatmentTable', () => {
  it('guaranteed payment: offered on partnerships only, and needs the partner before saving (R1 F1)', () => {
    const { unmount } = renderRoute(<TreatmentTable rows={buildRows(lines, [], [])} canWrite saving={false} onSave={vi.fn()} entityType="sch_c" />);
    const opts = (label: string) => Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((o) => o.value);
    expect(opts('Treatment for Misc')).not.toContain('guaranteed_payment');
    expect(opts('Treatment for Misc')).not.toContain('interest'); // character treatments are for income accounts
    unmount();
    const onSave = vi.fn();
    renderRoute(<TreatmentTable rows={buildRows(lines, [], [])} canWrite saving={false} onSave={onSave} entityType="partnership" />);
    expect(opts('Treatment for Misc')).toContain('guaranteed_payment');
    fireEvent.change(screen.getByLabelText('Treatment for Misc'), { target: { value: 'guaranteed_payment' } });
    expect(screen.getByText('Pick the person this belongs to')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save 1 change/ })).toBeDisabled();
  });

  it('renders source chips and filters to unmapped accounts with activity', () => {
    const rows = buildRows(lines, [], []);
    renderRoute(<TreatmentTable rows={rows} canWrite saving={false} onSave={vi.fn()} />);
    expect(screen.getAllByTestId('treatment-row')).toHaveLength(3);
    expect(screen.getAllByTestId('tax-code-chip')[0]).toHaveTextContent('C-15');
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Unmapped with activity'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const left = screen.getAllByTestId('treatment-row');
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveTextContent('Misc');
  });

  it('R3-17: a row mapped by another firm sharing the books is read-only', () => {
    sessionStorage.clear(); // an earlier test leaves a saved Status filter
    const foreign = {
      id: 't1', accountId: 'a2', accountNumber: '6900', accountName: 'Misc', accountType: 'expense', treatment: 'estimated_tax_payment' as const,
      pct: null, paymentTaxpayerId: null, paymentPersonId: null, paymentJurisdiction: 'federal' as const, nonRecurring: false,
      updatedAt: '2026-10-01T00:00:00.000Z', targetOtherFirm: true,
    };
    renderRoute(<TreatmentTable rows={buildRows(lines, [foreign], [])} canWrite saving={false} onSave={vi.fn()} entityType="sch_c" />);
    expect(screen.getByLabelText('Treatment for Misc')).toBeDisabled();
    expect(screen.getByLabelText('Non-recurring Misc')).toBeDisabled();
    expect(screen.getByText(/Mapped by another firm/)).toBeInTheDocument();
    expect(screen.getByLabelText('Treatment for Meals')).not.toBeDisabled();
  });

  it('saves only edited rows', () => {
    const onSave = vi.fn();
    renderRoute(<TreatmentTable rows={buildRows(lines, [], [])} canWrite saving={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Treatment for Misc'), { target: { value: 'owner_personal' } });
    fireEvent.click(screen.getByRole('button', { name: /Save 1 change/ }));
    expect(onSave).toHaveBeenCalledWith([{ accountId: 'a2', treatment: 'owner_personal', nonRecurring: false, pct: null }]);
  });

  it('read-only mode disables every control', () => {
    renderRoute(<TreatmentTable rows={buildRows(lines, [], [])} canWrite={false} saving={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Treatment for Misc')).toBeDisabled();
    expect(screen.getByLabelText('Non-recurring Misc')).toBeDisabled();
  });

  it('shows an empty state', () => {
    renderRoute(<TreatmentTable rows={[]} canWrite saving={false} onSave={vi.fn()} />);
    expect(screen.getByText(/No P&L accounts/)).toBeInTheDocument();
  });
});

describe('SuggestionsBanner', () => {
  it('does not apply anything until Apply is clicked', () => {
    const onApply = vi.fn();
    renderRoute(<SuggestionsBanner suggestions={[sugg]} canWrite saving={false} onApply={onApply} />);
    expect(screen.getByText(/never applied automatically/)).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Owner health insurance' }));
    expect(onApply).toHaveBeenCalledWith([sugg]);
  });

  it('dismisses a suggestion without applying it', () => {
    const onApply = vi.fn();
    renderRoute(<SuggestionsBanner suggestions={[sugg]} canWrite saving={false} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Owner health insurance' }));
    expect(screen.queryByTestId('suggestion-row')).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('YearInputsPanel', () => {
  const inputs: EntityYearInputsDto = { tenantId: 't', companyId: 'c', taxYear: 2026, w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, updatedAt: null };
  it('requires a reason for a W-2 wages override and warns on blank UBIA', () => {
    const onSave = vi.fn();
    renderRoute(<YearInputsPanel taxYear={2026} inputs={inputs} booksW2Wages="54000.0000" canWrite saving={false} onSave={onSave} />);
    expect(screen.getByTestId('books-w2')).toHaveTextContent('$54,000.00');
    expect(screen.getByText(/UBIA limb .* not computed/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('W-2 wages override'), { target: { value: '60000' } });
    expect(screen.getByRole('button', { name: 'Save year inputs' })).toBeDisabled();
    expect(screen.getByText(/A reason is required/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Override reason'), { target: { value: 'Payroll report' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave).toHaveBeenCalledWith({ w2WagesOverride: '60000', w2WagesOverrideReason: 'Payroll report', ubia: null });
  });
});

describe('ReadinessPanel', () => {
  it('renders warnings, not blocks', () => {
    const r = {
      lastClosedMonth: '2026-08', throughIsOpen: true,
      unreconciledAccounts: [{ accountId: 'b1', accountNumber: '1000', name: 'Checking', closedThroughMonth: '2026-06' }],
      suspense: { balance: '120.0000', transactionCount: 3, unpostedFeedCount: 0, lookalikeAccounts: [] },
      unmappedAccounts: [{ accountId: 'a2', accountNumber: '6900', name: 'Misc', bookAmount: '-500.0000' }],
      entity: { warnings: [{ code: 'TE_X', severity: 'warning', message: 'Linked company is out of scope' }] },
      warnings: [{ code: 'TE_Y', severity: 'warning', message: 'Missing UBIA' }],
    } as unknown as BooksReadiness;
    renderRoute(<ReadinessPanel readiness={r} />);
    expect(screen.getByTestId('last-closed')).toHaveTextContent('2026-08');
    expect(screen.getByText(/Checking/)).toBeInTheDocument();
    expect(screen.getByText(/Suspense/)).toHaveTextContent('$120.00');
    expect(screen.getByText(/Misc/)).toBeInTheDocument();
    expect(screen.getByText('Missing UBIA')).toBeInTheDocument();
    expect(screen.getByText('Linked company is out of scope')).toBeInTheDocument();
  });
});

describe('PreviewCard', () => {
  beforeEach(() => undefined);
  it('shows book net -> reclasses -> tax-basis profit and trace rows', () => {
    const zero = { ordinary: '128000.0000', capital_gain_st: '0', capital_gain_lt: '0', section_1231: '0', interest: '0', dividends_ordinary: '0', dividends_qualified: '0', rental: '0' };
    const pl = {
      periodStart: '2026-01-01', throughDate: '2026-09-30', monthsElapsed: 9, basis: 'cash', bookNetIncome: '115400.0000',
      taxBasisProfit: '128000.0000', byCharacter: zero, warnings: [],
      trace: [{ label: 'Meals: 50% nondeductible add-back', amount: '1800.0000', source: 'gl_map' }, { label: 'SEHI removed', amount: '10800.0000', source: 'gl_map' }],
    } as unknown as TaxBasisPl;
    renderRoute(<PreviewCard pl={pl} />);
    expect(screen.queryByTestId('reconciliation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Preview tax-basis profit/ }));
    const rec = within(screen.getByTestId('reconciliation'));
    expect(rec.getByText('$115,400.00')).toBeInTheDocument();
    expect(rec.getByText('$12,600.00')).toBeInTheDocument();
    expect(rec.getAllByText('$128,000.00').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('trace-row')).toHaveLength(2);
  });
});
