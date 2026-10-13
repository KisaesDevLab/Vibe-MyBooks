// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render, within } from '@testing-library/react';
import type { AdjustmentDTO, AdjustmentTypeDTO, LinkDTO, PersonDTO, ScenarioDTO, StateRowDTO, YearDetailDTO, YearSettingsDTO } from '@kis-books/shared';
// QA2-04: the GL source picker reads the linked company's P&L accounts.
const plAccounts = vi.hoisted(() => ({ accounts: [
  { accountId: 'acc-sup', accountNumber: '6100', name: 'Supplies', accountType: 'expense' },
  { accountId: 'acc-rent', accountNumber: '6200', name: 'Rent', accountType: 'expense' },
] }));
vi.mock('../../../api/hooks/useTaxEstimatorEntities', () => ({
  useTaxBasisPl: (t: string, c: string) => ({ isLoading: false, isError: false, data: t && c ? plAccounts : undefined }),
}));
import { ScenarioTabs } from './ScenarioTabs';
import { AllocationStrip } from './AllocationStrip';
import { AdjustmentsSection, previewMonths } from './AdjustmentsSection';
import { StateRowsEditor, validateDrafts, draftFromRow } from './StateRowsEditor';
import { YearInputsForm } from './YearInputsForm';

const scen = (over: Partial<ScenarioDTO> = {}): ScenarioDTO => ({
  id: 's1', taxpayerId: 'tp', taxYear: 2026, name: 'Base', isBase: true, showInPortal: false, sortOrder: 0, sourceScenarioId: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
});
const type = (over: Partial<AdjustmentTypeDTO> = {}): AdjustmentTypeDTO => ({
  id: 't1', firmId: null, code: 'sep_solo_401k', name: 'SEP/solo 401k contribution', kind: 'deduction', affectsSe: false, affectsQbi: false,
  isCapitalGainLt: false, isCapitalGainSt: false, isQualifiedDividend: false, isReitDividend: false, isPtp: false, is1231: false,
  isAboveTheLine: true, nonRecurring: false, defaultPct: null, isActive: true, isShipped: true, ...over,
});
const adj = (over: Partial<AdjustmentDTO> = {}): AdjustmentDTO => ({
  id: 'a1', scenarioId: 's1', adjustmentTypeId: 't1', adjustmentTypeName: 'SEP/solo 401k contribution', personId: null, linkId: null,
  label: 'SEP', amount: '15000.0000', pct: null, cadence: 'annual', startMonth: 1, endMonth: 12, glLinked: false, tenantId: null,
  companyId: null, accountId: null, nonRecurring: false, memo: null, monthly: Array(12).fill(1250), createdAt: '', updatedAt: '', ...over,
});
const row = (over: Partial<StateRowDTO> = {}): StateRowDTO => ({
  id: 'r1', scenarioId: 's1', residency: 'resident', state: 'MO', effectiveRate: 0.04, base: 'federal_agi', customBase: null,
  sourcedIncome: null, sourcedManual: false, creditOverride: null, memo: null, ...over,
});

describe('ScenarioTabs', () => {
  const handlers = () => ({ onSelect: vi.fn(), onClone: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() });

  it('selects, clones (named, QA D21) and renames non-base scenarios; Base has no Delete and no Rename', () => {
    const h = handlers();
    const { rerender } = render(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s1" canWrite {...h} />);
    expect(screen.getByRole('tab', { name: /Base/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Buy truck/ }));
    expect(h.onSelect).toHaveBeenCalledWith('s2');
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(screen.getByLabelText('Name the copy')).toHaveValue('Copy of Base');
    fireEvent.change(screen.getByLabelText('Name the copy'), { target: { value: 'Sell the truck' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }));
    expect(h.onClone).toHaveBeenCalledWith('s1', 'Sell the truck');
    rerender(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s2" canWrite {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Scenario name'), { target: { value: 'Truck Dec' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(h.onRename).toHaveBeenCalledWith('s2', 'Truck Dec');
  });

  it('deletes a non-base scenario only after confirmation', () => {
    const h = handlers();
    render(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s2" canWrite {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(h.onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(h.onDelete).toHaveBeenCalledWith('s2');
  });

  it('Q51: shares a what-if scenario in the client portal (never offered for Base)', () => {
    const h = { ...handlers(), onShareInPortal: vi.fn() };
    const { rerender } = render(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s1" canWrite {...h} />);
    expect(screen.queryByLabelText('Show this scenario in the client portal')).toBeNull();
    rerender(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s2" canWrite {...h} />);
    const box = screen.getByLabelText('Show this scenario in the client portal');
    expect(box).not.toBeChecked();
    expect(screen.getByText(/Clients see the scenario name exactly as written/)).toBeInTheDocument();
    fireEvent.click(box);
    expect(h.onShareInPortal).toHaveBeenCalledWith('s2', true);
    rerender(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false, showInPortal: true })]} selectedId="s2" canWrite={false} {...h} />);
    expect(screen.getByLabelText('Show this scenario in the client portal')).toBeChecked();
    expect(screen.getByLabelText('Show this scenario in the client portal')).toBeDisabled();
    expect(screen.getByRole('tab', { name: /Buy truck/ }).textContent).toContain('(portal)');
  });

  it('disables Clone at the six-scenario cap and hides actions for read-only users', () => {
    const six = Array.from({ length: 6 }, (_, i) => scen({ id: `s${i}`, name: `S${i}`, isBase: i === 0 }));
    const { rerender } = render(<ScenarioTabs scenarios={six} selectedId="s0" canWrite {...handlers()} />);
    expect(screen.getByRole('button', { name: 'Clone' })).toBeDisabled();
    rerender(<ScenarioTabs scenarios={six} selectedId="s0" canWrite={false} {...handlers()} />);
    expect(screen.queryByRole('button', { name: 'Clone' })).toBeNull();
  });
});

describe('AllocationStrip and live preview', () => {
  it('shows twelve months and the exact total', () => {
    render(<AllocationStrip months={[33.34, 33.33, 33.33, 0, 0, 0, 0, 0, 0, 0, 0, 0]} />);
    expect(screen.getByTestId('strip-Jan')).toHaveTextContent('33.34');
    expect(screen.getByTestId('strip-Dec')).toHaveTextContent('0');
    expect(screen.getByTestId('strip-total')).toHaveTextContent('$100.00');
  });

  it('previewMonths uses the shared allocation (quarterly ÷3, one-time in its month)', () => {
    expect(previewMonths({ amount: '300', cadence: 'quarterly', startMonth: 1, endMonth: 12 }, 2026)).toEqual(Array(12).fill(100));
    const once = previewMonths({ amount: '5000', cadence: 'one_time', startMonth: 12, endMonth: 3 }, 2026);
    expect(once[11]).toBe(5000);
    expect(once.reduce((a, b) => a + b, 0)).toBe(5000);
    expect(previewMonths({ amount: 'abc', cadence: 'monthly', startMonth: 1, endMonth: 12 }, 2026).every((n) => n === 0)).toBe(true);
  });
});

describe('AdjustmentsSection', () => {
  const props = (over = {}) => ({
    taxYear: 2026, adjustments: [adj()], total: 1, types: [type()], persons: [] as PersonDTO[], links: [] as LinkDTO[], canWrite: true,
    onCreate: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), ...over,
  });

  it('renders the empty state, and rows with From GL / Non-recurring badges', () => {
    const { rerender } = render(<AdjustmentsSection {...props({ adjustments: [], total: 0 })} />);
    expect(screen.getByText(/No adjustments in this scenario yet/)).toBeInTheDocument();
    rerender(<AdjustmentsSection {...props({ adjustments: [adj({ glLinked: true, nonRecurring: true, amount: null })] })} />);
    expect(screen.getByText('From GL')).toBeInTheDocument();
    expect(screen.getByText('Non-recurring')).toBeInTheDocument();
    expect(screen.getByText('Run-rate')).toBeInTheDocument();
  });

  it('updates the allocation strip live while editing and creates with the typed values', () => {
    const p = props({ adjustments: [], total: 0 });
    render(<AdjustmentsSection {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add adjustment' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText('Cadence'), { target: { value: 'monthly' } });
    expect(screen.getByTestId('strip-Jun')).toHaveTextContent('1,200');
    expect(screen.getByTestId('strip-total')).toHaveTextContent('$14,400.00');
    fireEvent.change(screen.getByLabelText('Start month'), { target: { value: '7' } });
    expect(screen.getByTestId('strip-Jun')).toHaveTextContent('0');
    expect(screen.getByTestId('strip-total')).toHaveTextContent('$7,200.00');
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect(p.onCreate).toHaveBeenCalledWith(expect.objectContaining({
      adjustmentTypeId: 't1', amount: '1200', cadence: 'monthly', startMonth: 7, endMonth: 12, glLinked: false,
    }));
  });

  it('blocks saving a bad amount or an inverted range', () => {
    const p = props({ adjustments: [], total: 0 });
    render(<AdjustmentsSection {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add adjustment' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12x' } });
    expect(screen.getByRole('button', { name: 'Save adjustment' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Start month'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('End month'), { target: { value: '3' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/End month/);
    expect(screen.getByRole('button', { name: 'Save adjustment' })).toBeDisabled();
  });

  it('QA D1: a §179 vehicle needs an entity link; picking the link sends linkId and the link\'s person', () => {
    const truck = type({ id: 'tv', code: 'vehicle_179', name: 'Vehicle purchase (§179)', affectsSe: true, affectsQbi: true, isAboveTheLine: false });
    const carlos: PersonDTO = { id: 'p1', taxpayerId: 'tp', role: 'primary', firstName: 'Carlos', lastName: 'Rivera', dateOfBirth: null, isBlind: false, sehiEligibleMonths: Array(12).fill(true) };
    const plumbing = {
      id: 'l1', taxpayerId: 'tp', personId: 'p1', personRole: 'primary', taxYear: 2026, tenantId: 't2', companyId: 'c2',
      tenantName: 'Rivera Plumbing', companyName: 'Rivera Plumbing LLC', entityKind: 'sole_prop', returnForm: 'Sch C', outOfScope: false,
      profitPct: 100, lossPct: 100, capitalPct: null, partnerSeStatus: null, partnerSeMemo: null, isOfficer: false,
      activityType: 'active', activeParticipation: false, qbiEligible: null, qbiOverrideReason: null, allowedLossOverride: null, allowedLossReason: null,
    } as unknown as LinkDTO;
    const p = props({ adjustments: [], total: 0, types: [truck, type()], persons: [carlos], links: [plumbing] });
    render(<AdjustmentsSection {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add adjustment' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '60000' } });
    expect(screen.getByLabelText('Entity (required)')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/itemized deduction/);
    expect(screen.getByRole('button', { name: 'Save adjustment' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Entity (required)'), { target: { value: 'l1' } });
    expect(screen.getByLabelText('Person')).toHaveValue('p1');
    expect(screen.getByLabelText('Person')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect(p.onCreate).toHaveBeenCalledWith(expect.objectContaining({ adjustmentTypeId: 'tv', linkId: 'l1', personId: 'p1', amount: '60000' }));
  });

  it('QA D1: owner SEHI/retirement types offer no entity picker; an existing unlinked §179 row is flagged', () => {
    const truck = type({ id: 'tv', code: 'vehicle_179', name: 'Vehicle purchase (§179)', affectsSe: true, affectsQbi: true, isAboveTheLine: false });
    render(<AdjustmentsSection {...props({ types: [type(), truck], adjustments: [adj({ id: 'a2', adjustmentTypeId: 'tv', adjustmentTypeName: 'Vehicle purchase (§179)', label: 'Truck' })] })} />);
    expect(screen.getByText(/No entity — treated as itemized/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add adjustment' }));
    expect(screen.queryByLabelText(/^Entity/)).toBeNull(); // first type = SEP (person-level)
  });

  it('QA2-02: Delete asks for confirmation; Cancel keeps the adjustment', () => {
    const p = props();
    render(<AdjustmentsSection {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(p.onDelete).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/Delete this adjustment\?/);
    expect(dialog).toHaveTextContent('SEP');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(p.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(p.onDelete).toHaveBeenCalledWith('a1');
  });

  it('QA2-04: a GL-linked (run-rate) row shows the allocation the estimate computed, not zeros', () => {
    const gl = adj({ id: 'g1', glLinked: true, amount: null, cadence: 'monthly', label: 'Supplies run-rate', monthly: Array(12).fill(0), tenantId: 't2', companyId: 'c2', accountId: 'acc-sup' });
    const computedMonths = [4183.33, 4183.33, 4183.33, 4183.33, 4183.33, 4183.33, 4183.33, 4183.33, 4183.36, 4183.33, 4183.33, 4183.33];
    const { rerender } = render(<AdjustmentsSection {...props({ adjustments: [gl] })} computed={{ loading: true, byId: {} }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/Computing the allocation from the books/)).toBeInTheDocument();
    rerender(<AdjustmentsSection {...props({ adjustments: [gl] })} computed={{ loading: false, byId: { g1: { fullYearAmount: '50199.99', monthly: computedMonths } } }} />);
    expect(screen.getByTestId('strip-Jan')).toHaveTextContent('4,183.33');
    expect(screen.getByTestId('strip-total')).toHaveTextContent('$50,199.99');
    expect(screen.getByText(/computed by the estimate from the books/)).toBeInTheDocument();
    // A result cached before the monthly split was carried: the year total still shows, never $0.
    rerender(<AdjustmentsSection {...props({ adjustments: [gl] })} computed={{ loading: false, byId: { g1: { fullYearAmount: '50199.99' } } }} />);
    expect(screen.queryByTestId('allocation-strip')).toBeNull();
    expect(screen.getByText(/Year total from the books \$50,199.99/)).toBeInTheDocument();
  });

  it('QA2-04: creates a GL-linked adjustment by picking a linked business and its account', () => {
    const plumbing = {
      id: 'l1', taxpayerId: 'tp', personId: 'p1', personRole: 'primary', taxYear: 2026, tenantId: 't2', companyId: 'c2',
      tenantName: 'Rivera Plumbing', companyName: 'Rivera Plumbing LLC', entityKind: 'sole_prop', returnForm: 'Sch C', outOfScope: false,
    } as unknown as LinkDTO;
    const other = type({ id: 'od', code: 'other_deduction', name: 'Other deduction', isAboveTheLine: false });
    const p = props({ adjustments: [], total: 0, types: [other], links: [plumbing] });
    render(<AdjustmentsSection {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add adjustment' }));
    fireEvent.click(screen.getByLabelText(/Read the amount from the books/));
    expect(screen.getByRole('button', { name: 'Save adjustment' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Business (books)'), { target: { value: 't2|c2' } });
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'acc-sup' } });
    expect(screen.getByLabelText('Amount')).toHaveAttribute('placeholder', 'Run-rate from GL');
    expect(screen.getByText(/computed from the books when the estimate runs/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect(p.onCreate).toHaveBeenCalledWith(expect.objectContaining({
      adjustmentTypeId: 'od', glLinked: true, tenantId: 't2', companyId: 'c2', accountId: 'acc-sup', amount: null,
    }));
  });

  it('read-only users see no edit actions', () => {
    render(<AdjustmentsSection {...props({ canWrite: false })} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add adjustment' })).toBeNull();
  });
});

describe('StateRowsEditor', () => {
  it('validateDrafts enforces exactly one resident, no duplicates, nonresident != resident, rate cap', () => {
    const mo = draftFromRow(row());
    const ar = draftFromRow(row({ id: 'r2', residency: 'nonresident', state: 'AR', effectiveRate: 0.039 }));
    expect(validateDrafts([mo, ar])).toBeNull();
    expect(validateDrafts([ar])).toMatch(/Exactly one resident/);
    expect(validateDrafts([mo, { ...mo, key: 'x', state: 'IL' }])).toMatch(/Exactly one resident/);
    expect(validateDrafts([mo, { ...ar, state: 'MO' }])).toMatch(/cannot be the resident/);
    expect(validateDrafts([mo, ar, { ...ar, key: 'y' }])).toMatch(/more than once/);
    expect(validateDrafts([{ ...mo, ratePct: '25' }])).toMatch(/between 0 and 20/);
  });

  it('shows the effective-rate label on nonresident rows, saves rate as a decimal and blocks an invalid set', () => {
    const onSave = vi.fn();
    render(<StateRowsEditor rows={[row(), row({ id: 'r2', residency: 'nonresident', state: 'AR', effectiveRate: 0.039 })]} canWrite onSave={onSave} />);
    expect(within(screen.getByTestId('state-row-nonresident')).getByText('Effective-rate estimate')).toBeInTheDocument();
    expect(screen.getByText(/Derived from each entity/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save states' }));
    const input = onSave.mock.calls[0]![0];
    expect(input.rows).toHaveLength(2);
    expect(input.rows[0]).toMatchObject({ residency: 'resident', state: 'MO', effectiveRate: 0.04 });
    expect(input.rows[1]).toMatchObject({ residency: 'nonresident', state: 'AR', effectiveRate: 0.039, sourcedManual: false, sourcedIncome: null });

    fireEvent.click(screen.getByRole('button', { name: '+ Add state' }));
    expect(screen.getByTestId('state-problem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save states' })).toBeDisabled();
  });

  it('seeds an empty scenario with the taxpayer resident state and asks for manual sourced income', () => {
    render(<StateRowsEditor rows={[]} canWrite defaultResidentState="MO" onSave={vi.fn()} />);
    expect(screen.getByLabelText('Resident MO state')).toHaveValue('MO');
    fireEvent.click(screen.getByRole('button', { name: '+ Add state' }));
    const nonres = screen.getByTestId('state-row-nonresident');
    fireEvent.click(within(nonres).getByLabelText('Enter sourced income manually'));
    expect(within(nonres).getByLabelText(/sourced income$/)).toBeInTheDocument();
  });
});

describe('YearInputsForm — People card (R7-01)', () => {
  const settings = (over: Partial<YearSettingsDTO> = {}): YearSettingsDTO => ({
    id: 'y1', taxpayerId: 'tp', taxYear: 2026, priorYearTax: null, priorYearAgi: null, priorYearTaxPresent: false, priorYearAgiPresent: false,
    priorYearTwelveMonths: true, priorYearFiled: true, safeHarborRule: null, rateMode: 'brackets', effectiveRateOverride: null, deductionMode: 'auto',
    itemized: {}, sch1a: {}, creditsNonrefundable: '0', creditsRefundable: '0', hsaCoverage: {}, withholding: {},
    personInputs: {}, mfsLivedApartAllYear: false, niiAllocableDeductions: null, farmerGross: {}, isFisherman: false,
    createdAt: '', updatedAt: '', ...over,
  });
  const detail = (y: YearSettingsDTO = settings()): YearDetailDTO => ({
    exists: true, year: y, taxpayerSafeHarborOverride: null, firmSafeHarborDefault: 'lesser_of', effectiveSafeHarborRule: 'lesser_of', scenarios: [scen()],
  });
  const person = (role: 'primary' | 'spouse', firstName: string): PersonDTO => ({
    id: `p-${role}`, taxpayerId: 'tp', role, firstName, lastName: 'Rivera', dateOfBirth: '1981-05-10', isBlind: false, sehiEligibleMonths: Array(12).fill(true),
  });
  const persons = [person('primary', 'Carlos'), person('spouse', 'Maria')];

  it('QA D28/D27/D31: 110% note only above the AGI threshold; state withholding error tied to the field; stored decimals shown plain', () => {
    const { unmount } = render(<YearInputsForm detail={detail(settings({ priorYearAgi: '100000.0000', priorYearTax: '8000.0000' }))} persons={persons} filingStatus="mfj" canWrite onSave={vi.fn()} />);
    expect(screen.queryByTestId('rule-callout')).toBeNull();
    expect(screen.getByLabelText('Prior-year total tax')).toHaveValue('8000');
    fireEvent.change(screen.getByLabelText('Prior-year AGI'), { target: { value: '182000' } });
    expect(screen.getByTestId('rule-callout')).toHaveTextContent('110%');
    const wh = screen.getByLabelText('State withholding (annual)');
    fireEvent.change(wh, { target: { value: 'Missouri 2000' } });
    expect(wh).toHaveAttribute('aria-invalid', 'true');
    expect(wh).toHaveAttribute('aria-describedby', 'state-wh-error');
    expect(document.getElementById('state-wh-error')).toHaveTextContent('Use STATE=amount');
    unmount();
    render(<YearInputsForm detail={detail(settings({ priorYearAgi: '80000' }))} persons={persons} filingStatus="mfs" canWrite onSave={vi.fn()} />);
    expect(screen.getByTestId('rule-callout')).toHaveTextContent('$75,000');
  });

  it('saves outside W-2 wages, Social Security wages, plan type and deferral per person (into personInputs)', () => {
    const onSave = vi.fn();
    render(<YearInputsForm detail={detail()} persons={persons} filingStatus="mfj" canWrite onSave={onSave} />);
    const card = screen.getByRole('region', { name: 'People' });
    fireEvent.change(within(card).getByLabelText('Maria — W-2 wages (box 1)'), { target: { value: '150000' } });
    fireEvent.change(within(card).getByLabelText('Maria — Social Security wages (box 3)'), { target: { value: '173500' } });
    expect(within(card).queryByLabelText('Carlos — employee deferral')).toBeNull();
    fireEvent.change(within(card).getByLabelText('Carlos — retirement plan'), { target: { value: 'solo_401k' } });
    fireEvent.change(within(card).getByLabelText('Carlos — employee deferral'), { target: { value: '10000' } });
    fireEvent.change(within(card).getByLabelText('Maria — retirement plan'), { target: { value: 'none' } });
    fireEvent.change(within(card).getByLabelText(/allocable to investment income/), { target: { value: '1200.50' } });
    expect(within(card).queryByLabelText(/Lived apart/)).toBeNull(); // MFS only
    fireEvent.click(screen.getByRole('button', { name: 'Save annual settings' }));
    const input = onSave.mock.calls[0]![0];
    expect(input.personInputs).toEqual({
      primary: { w2Wages: null, w2SocialSecurityWages: null, retirementPlanType: 'solo_401k', employeeDeferral: 10000 },
      spouse: { w2Wages: 150000, w2SocialSecurityWages: 173500, retirementPlanType: 'none', employeeDeferral: null },
    });
    expect(input).toMatchObject({ niiAllocableDeductions: '1200.50', mfsLivedApartAllYear: false, farmerGross: {}, isFisherman: false });
  });

  it('round-trips saved values, shows the MFS lived-apart flag for MFS, and saves farmer gross figures', () => {
    const onSave = vi.fn();
    const y = settings({
      personInputs: { primary: { w2Wages: 30000, w2SocialSecurityWages: null, retirementPlanType: 'simple', employeeDeferral: 5000 } },
      mfsLivedApartAllYear: true, farmerGross: { prior: { primary: { farming: 80000, totalGross: 100000 } } }, isFisherman: true,
    });
    render(<YearInputsForm detail={detail(y)} persons={[persons[0]!]} filingStatus="mfs" canWrite onSave={onSave} />);
    expect(screen.getByLabelText('Carlos — W-2 wages (box 1)')).toHaveValue('30000');
    expect(screen.getByLabelText('Carlos — employee deferral')).toHaveValue('5000');
    expect(screen.getByLabelText(/Lived apart/)).toBeChecked();
    expect(screen.getByLabelText('Prior year — Carlos — Gross farming income')).toHaveValue('80000');
    fireEvent.change(screen.getByLabelText('This year — Carlos — Total gross income'), { target: { value: '90000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save annual settings' }));
    const input = onSave.mock.calls[0]![0];
    expect(input.personInputs).toEqual({ primary: { w2Wages: 30000, w2SocialSecurityWages: null, retirementPlanType: 'simple', employeeDeferral: 5000 } });
    expect(input.farmerGross).toEqual({ current: { primary: { totalGross: 90000 } }, prior: { primary: { farming: 80000, totalGross: 100000 } } });
    expect(input).toMatchObject({ mfsLivedApartAllYear: true, isFisherman: true });
  });

  it('blocks saving a malformed amount and is read-only for read-only users', () => {
    const { rerender } = render(<YearInputsForm detail={detail()} persons={persons} filingStatus="mfj" canWrite onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Carlos — W-2 wages (box 1)'), { target: { value: '12.345' } });
    expect(screen.getByRole('button', { name: 'Save annual settings' })).toBeDisabled();
    rerender(<YearInputsForm detail={detail()} persons={persons} filingStatus="mfj" canWrite={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Maria — W-2 wages (box 1)')).toBeDisabled();
  });
});
