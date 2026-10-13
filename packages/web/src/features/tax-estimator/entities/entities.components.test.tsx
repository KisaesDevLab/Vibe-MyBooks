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

  it('QA D14: searches by account number or name', () => {
    renderRoute(<TreatmentTable rows={buildRows(lines, [], [])} canWrite saving={false} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: '6420' } });
    expect(screen.getAllByTestId('treatment-row')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: 'misc' } });
    expect(screen.getAllByTestId('treatment-row')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: 'zzz-no-such-account' } });
    expect(screen.getByText('No accounts match the current filters.')).toBeInTheDocument();
  });

  it('QA D31: a stored percent shows as typed ("50", not "50.0000")', () => {
    renderRoute(<TreatmentTable rows={buildRows(lines, [], [])} canWrite saving={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Nondeductible % for Meals')).toHaveValue('50');
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

  it('QA D14: a dismissal survives a reload (per-viewer storage) and a changed suggestion shows again', () => {
    window.localStorage.removeItem('k-d14');
    const first = renderRoute(<SuggestionsBanner suggestions={[sugg]} canWrite saving={false} onApply={vi.fn()} storageKey="k-d14" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Owner health insurance' }));
    first.unmount();
    const second = renderRoute(<SuggestionsBanner suggestions={[sugg]} canWrite saving={false} onApply={vi.fn()} storageKey="k-d14" />);
    expect(screen.queryByTestId('suggestion-row')).toBeNull();
    second.unmount();
    renderRoute(<SuggestionsBanner suggestions={[{ ...sugg, pct: '25' }]} canWrite saving={false} onApply={vi.fn()} storageKey="k-d14" />);
    expect(screen.getAllByTestId('suggestion-row')).toHaveLength(1);
    window.localStorage.removeItem('k-d14');
  });
});

describe('YearInputsPanel', () => {
  const inputs: EntityYearInputsDto = { tenantId: 't', companyId: 'c', taxYear: 2026, w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, includeSehiInW2Wages: false, projectionMethod: 'run_rate', entityTypeOverride: null, updatedAt: null };
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
    expect(onSave).toHaveBeenCalledWith({ w2WagesOverride: '60000', w2WagesOverrideReason: 'Payroll report', ubia: null, includeSehiInW2Wages: false, projectionMethod: 'run_rate', entityTypeOverride: null });
  });

  it('Q41: the >2% shareholder health switch defaults to excluded and saves true when ticked', () => {
    const onSave = vi.fn();
    renderRoute(<YearInputsPanel taxYear={2026} inputs={inputs} booksW2Wages="54000.0000" entityType="s_corp" canWrite saving={false} onSave={onSave} />);
    const box = screen.getByLabelText('Include shareholder health insurance in W-2 wages');
    expect(box).not.toBeChecked();
    expect(screen.getByText(/excluded/)).toBeInTheDocument();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave).toHaveBeenCalledWith({ w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, includeSehiInW2Wages: true, projectionMethod: 'run_rate', entityTypeOverride: null });
  });
});

describe('YearInputsPanel — QA2-03', () => {
  const inputs: EntityYearInputsDto = { tenantId: 't', companyId: 'c', taxYear: 2026, w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, includeSehiInW2Wages: true, projectionMethod: 'run_rate', entityTypeOverride: null, updatedAt: null };
  it('the shareholder health switch is offered for S corporations only; other entities save it off', () => {
    for (const entityType of ['sch_c', 'partnership', null] as const) {
      const onSave = vi.fn();
      const { unmount } = renderRoute(<YearInputsPanel taxYear={2026} inputs={inputs} booksW2Wages="0" entityType={entityType} canWrite saving={false} onSave={onSave} />);
      expect(screen.queryByLabelText('Include shareholder health insurance in W-2 wages')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ includeSehiInW2Wages: false }));
      unmount();
    }
  });
});

describe('YearInputsPanel — Q46 projection method', () => {
  const inputs: EntityYearInputsDto = { tenantId: 't', companyId: 'c', taxYear: 2026, w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, includeSehiInW2Wages: false, projectionMethod: 'run_rate', entityTypeOverride: null, updatedAt: null };
  it('defaults to the run rate, explains the methods and saves the chosen prior-year method', () => {
    const onSave = vi.fn();
    renderRoute(<YearInputsPanel taxYear={2026} inputs={inputs} booksW2Wages="0" entityType="sch_c" canWrite saving={false} onSave={onSave} />);
    const select = screen.getByLabelText('Projection method') as HTMLSelectElement;
    expect(select.value).toBe('run_rate');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['run_rate', 'prior_year_scaled', 'prior_year_dollar']);
    expect(screen.getByTestId('projection-help')).toHaveTextContent(/2025's remaining months/);
    expect(screen.getByTestId('projection-help')).toHaveTextContent(/falls back to the run rate/);
    fireEvent.change(select, { target: { value: 'prior_year_scaled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ projectionMethod: 'prior_year_scaled' }));
  });

  it('shows the stored method; C corporations get no selector and save the run rate', () => {
    const { unmount } = renderRoute(<YearInputsPanel taxYear={2026} inputs={{ ...inputs, projectionMethod: 'prior_year_dollar' }} booksW2Wages="0" entityType="partnership" canWrite={false} saving={false} onSave={vi.fn()} />);
    expect((screen.getByLabelText('Projection method') as HTMLSelectElement).value).toBe('prior_year_dollar');
    expect(screen.getByLabelText('Projection method')).toBeDisabled();
    unmount();
    const onSave = vi.fn();
    renderRoute(<YearInputsPanel taxYear={2026} inputs={{ ...inputs, projectionMethod: 'prior_year_dollar' }} booksW2Wages="0" entityType="c_corp" canWrite saving={false} onSave={onSave} />);
    expect(screen.queryByLabelText('Projection method')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ projectionMethod: 'run_rate' }));
  });
});

describe('YearInputsPanel — Q49 entity type for the year', () => {
  const inputs: EntityYearInputsDto = { tenantId: 't', companyId: 'c', taxYear: 2026, w2WagesOverride: null, w2WagesOverrideReason: null, ubia: null, includeSehiInW2Wages: false, projectionMethod: 'run_rate', entityTypeOverride: null, updatedAt: null };
  it('defaults to the TB profile, offers the five types with help, and saves the override', () => {
    const onSave = vi.fn();
    renderRoute(<YearInputsPanel taxYear={2026} inputs={inputs} booksW2Wages="0" entityType="partnership" baseType="partnership"
      baseTypeLabel="Use TB profile (1065 → Partnership)" canWrite saving={false} onSave={onSave} />);
    const select = screen.getByLabelText('Entity type for 2026') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      'Use TB profile (1065 → Partnership)', 'Schedule C (sole proprietor)', 'Schedule F (farm)', 'S corporation', 'Partnership', 'C corporation',
    ]);
    expect(screen.getByTestId('entity-type-help')).toHaveTextContent(/elected S corporation status for 2026/);
    // Partnership: no S corp switch until the override is chosen.
    expect(screen.queryByLabelText('Include shareholder health insurance in W-2 wages')).toBeNull();
    fireEvent.change(select, { target: { value: 's_corp' } });
    fireEvent.click(screen.getByLabelText('Include shareholder health insurance in W-2 wages'));
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ entityTypeOverride: 's_corp', includeSehiInW2Wages: true }));
  });

  it('clearing the override saves null; a C corp override hides the projection method, saves the run rate and explains the path', () => {
    const onSave = vi.fn();
    const { unmount } = renderRoute(<YearInputsPanel taxYear={2026} inputs={{ ...inputs, entityTypeOverride: 's_corp' }} booksW2Wages="0" entityType="s_corp"
      baseType="partnership" baseTypeLabel="Use TB profile (1065 → Partnership)" canWrite saving={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Entity type for 2026'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ entityTypeOverride: null, includeSehiInW2Wages: false }));
    unmount();
    const onSave2 = vi.fn();
    renderRoute(<YearInputsPanel taxYear={2026} inputs={{ ...inputs, projectionMethod: 'prior_year_dollar' }} booksW2Wages="0" entityType="partnership"
      baseType="partnership" canWrite saving={false} onSave={onSave2} />);
    expect(screen.getByLabelText('Projection method')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Entity type for 2026'), { target: { value: 'c_corp' } });
    expect(screen.queryByLabelText('Projection method')).toBeNull();
    expect(screen.getByTestId('ccorp-switch-note')).toHaveTextContent(/entity level/);
    fireEvent.click(screen.getByRole('button', { name: 'Save year inputs' }));
    expect(onSave2).toHaveBeenCalledWith(expect.objectContaining({ entityTypeOverride: 'c_corp', projectionMethod: 'run_rate' }));
  });

  it('is read-only without write access', () => {
    renderRoute(<YearInputsPanel taxYear={2026} inputs={inputs} booksW2Wages="0" entityType="partnership" canWrite={false} saving={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Entity type for 2026')).toBeDisabled();
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

  it('QA2-09: a summary warning already shown as a list (unreconciled / unmapped / unposted) is not repeated', () => {
    const r = {
      lastClosedMonth: '2026-08', throughIsOpen: false,
      unreconciledAccounts: [{ accountId: 'b1', accountNumber: '1010', name: 'Checking', closedThroughMonth: null }],
      suspense: { balance: '0', transactionCount: 0, unpostedFeedCount: 2, lookalikeAccounts: [] },
      unmappedAccounts: [{ accountId: 'a2', accountNumber: '6900', name: 'Misc', bookAmount: '-500.0000' }],
      entity: { warnings: [{ code: 'TE_UNMAPPED_ACCOUNTS', severity: 'warning', message: '1 account(s) with activity have no TB tax-code assignment or estimator treatment; they are treated as ordinary income/expense.' }] },
      warnings: [
        { code: 'TE_UNRECONCILED_ACCOUNTS', severity: 'warning', message: '1 bank/credit-card account(s) are not reconciled through 2026-09.' },
        { code: 'TE_UNPOSTED_BANK_FEED', severity: 'warning', message: '2 bank-feed transaction(s) are not posted yet.' },
        { code: 'TE_RANGE_INCLUDES_OPEN_MONTH', severity: 'warning', message: 'The range runs through 2026-09, after the last closed month (2026-08).' },
      ],
    } as unknown as BooksReadiness;
    renderRoute(<ReadinessPanel readiness={r} />);
    expect(screen.getByText(/1010 Checking \(reconciled through never\)/)).toBeInTheDocument();
    expect(screen.queryByText(/bank\/credit-card account\(s\) are not reconciled/)).toBeNull();
    expect(screen.queryByText(/have no TB tax-code assignment/)).toBeNull();
    expect(screen.queryByText(/bank-feed transaction\(s\) are not posted/)).toBeNull();
    expect(screen.getByText(/after the last closed month/)).toBeInTheDocument();
  });

  it('QA D16: a warning carried by both lists shows once (no duplicate React key)', () => {
    const w = { code: 'TE_ENTITY_TYPE_FROM_COMPANY', severity: 'info', message: 'Entity tax type taken from the company.' };
    const r = {
      lastClosedMonth: null, throughIsOpen: false, unreconciledAccounts: [], unmappedAccounts: [],
      suspense: { balance: '0', transactionCount: 0, unpostedFeedCount: 0, lookalikeAccounts: [] },
      entity: { warnings: [w] }, warnings: [w],
    } as unknown as BooksReadiness;
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderRoute(<ReadinessPanel readiness={r} />);
    expect(screen.getAllByText('Entity tax type taken from the company.')).toHaveLength(1);
    expect(err.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
    err.mockRestore();
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
