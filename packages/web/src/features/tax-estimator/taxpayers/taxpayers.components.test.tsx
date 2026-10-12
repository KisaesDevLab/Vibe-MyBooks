// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { CompanyOptionDTO, LinkDTO, PersonDTO } from '@kis-books/shared';

const h = vi.hoisted(() => ({
  options: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  lastQ: '' as string,
}));

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useCompanyOptions: (q: string) => { h.lastQ = q; return h.options; },
}));

import { CompanyPicker } from './CompanyPicker';
import { PctTotalsNotice } from './PctTotalsNotice';
import { computePctTotals } from './pctTotals';
import { PersonsEditor } from './PersonsEditor';
import { LinkForm } from './LinkForm';
import { StateSelect } from './StateSelect';

const opt = (over: Partial<CompanyOptionDTO> = {}): CompanyOptionDTO => ({
  tenantId: 't2', tenantName: 'Rivera Plumbing', companyId: 'c2', companyName: 'Rivera Plumbing LLC',
  entityType: 'single_member_llc', returnForm: null, ...over,
});
const link = (over: Partial<LinkDTO> = {}): LinkDTO => ({
  id: 'l1', taxpayerId: 'tp', personId: 'p1', personRole: 'primary', taxYear: 2026, tenantId: 't2', companyId: 'c2',
  tenantName: 'Rivera Plumbing', companyName: 'Rivera Plumbing LLC', entityKind: 'partnership', returnForm: '1065', outOfScope: false,
  profitPct: 60, lossPct: 60, capitalPct: null, partnerSeStatus: null, partnerSeMemo: null, isOfficer: false,
  activityType: 'active', activeParticipation: false, qbiEligible: null, qbiOverrideReason: null,
  allowedLossOverride: null, allowedLossReason: null, ...over,
});
const person = (role: 'primary' | 'spouse', first: string): PersonDTO => ({
  id: role, taxpayerId: 'tp', role, firstName: first, lastName: 'Rivera', dateOfBirth: null, isBlind: false,
  sehiEligibleMonths: Array(12).fill(true),
});

beforeEach(() => {
  h.options = { data: { data: [opt(), opt({ tenantId: 't3', tenantName: 'Ozark Hearth', companyId: 'c3', companyName: 'Ozark Hearth Bakery', returnForm: '1120S' })], total: 2, limit: 25, offset: 0 }, isLoading: false, isError: false, refetch: vi.fn() };
});

describe('CompanyPicker', () => {
  it('lists options across clients labelled "Client — Company" and reports the selection', () => {
    const onSelect = vi.fn();
    renderRoute(<CompanyPicker value={null} onSelect={onSelect} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByText('Rivera Plumbing — Rivera Plumbing LLC')).toBeInTheDocument();
    expect(screen.getByText('Ozark Hearth — Ozark Hearth Bakery')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ozark Hearth — Ozark Hearth Bakery'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't3', companyId: 'c3' }));
  });

  it('shows empty and error states', () => {
    h.options = { data: { data: [], total: 0, limit: 25, offset: 0 }, isLoading: false, isError: false, refetch: vi.fn() };
    const { unmount } = renderRoute(<CompanyPicker value={null} onSelect={vi.fn()} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByText(/No matching companies/)).toBeInTheDocument();
    unmount();
    h.options = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    renderRoute(<CompanyPicker value={null} onSelect={vi.fn()} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByText(/Could not load companies/)).toBeInTheDocument();
  });
});

describe('percentage totals', () => {
  const draft = { personRole: 'spouse' as const, tenantId: 't2', companyId: 'c2', taxYear: 2026, profitPct: 40, lossPct: 40 };

  it('sums every person\'s share for the same company and year (draft replaces the stored value)', () => {
    const t = computePctTotals([link(), link({ id: 'l2', personRole: 'spouse', profitPct: 10, lossPct: 10 })], draft);
    expect(t).toMatchObject({ profit: 100, loss: 100, profitOver: false, profitUnder: false });
  });

  it('flags over-100 as an error and under-100 as a warning, ignoring other years and out-of-scope links', () => {
    const over = computePctTotals([link()], { ...draft, profitPct: 40.0001 });
    expect(over.profitOver).toBe(true);
    const under = computePctTotals([link(), link({ id: 'x', taxYear: 2025, profitPct: 99 }), link({ id: 'y', personRole: 'primary', outOfScope: true })], { ...draft, profitPct: 30 });
    expect(under.profit).toBe(90);
    expect(under.profitUnder).toBe(true);
  });

  it('renders the live notices', () => {
    render(<PctTotalsNotice totals={computePctTotals([link()], { ...draft, profitPct: 50, lossPct: 20 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/110%/);
    expect(screen.getByRole('status')).toHaveTextContent(/80%/);
  });

  it('LinkForm disables Save while the total is over 100%', () => {
    renderRoute(<LinkForm persons={[person('primary', 'Daniel'), person('spouse', 'Maria')]} links={[link({ profitPct: 70, lossPct: 70 })]}
      initial={link({ id: 'l2', personId: 'spouse', personRole: 'spouse', profitPct: 20, lossPct: 20 })}
      taxYear={2026} saving={false} onSave={vi.fn()} onCancel={vi.fn()} />);
    const save = screen.getByRole('button', { name: 'Save link' });
    expect(save).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Profit %'), { target: { value: '40' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/110%/);
    expect(save).toBeDisabled();
  });
});

describe('PersonsEditor', () => {
  it('saves a primary person with the 12 SEHI months and blocks a future date of birth', () => {
    const onSave = vi.fn();
    render(<PersonsEditor persons={[]} canWrite saving={false} onSave={onSave} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('person-spouse')).not.toBeInTheDocument(); // spouse needs a primary first
    fireEvent.change(screen.getByLabelText('Primary taxpayer first name'), { target: { value: 'Daniel' } });
    fireEvent.change(screen.getByLabelText('Primary taxpayer last name'), { target: { value: 'Rivera' } });
    fireEvent.click(screen.getByLabelText('Primary taxpayer SEHI Mar'));
    fireEvent.click(screen.getByRole('button', { name: /Add primary taxpayer/ }));
    const [role, input] = onSave.mock.calls[0]!;
    expect(role).toBe('primary');
    expect(input.sehiEligibleMonths).toHaveLength(12);
    expect(input.sehiEligibleMonths[2]).toBe(false);
    expect(input.sehiEligibleMonths[0]).toBe(true);

    fireEvent.change(screen.getByLabelText('Primary taxpayer date of birth'), { target: { value: '2999-01-01' } });
    expect(screen.getByText('Date of birth cannot be in the future')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add primary taxpayer/ })).toBeDisabled();
  });

  it('shows both persons, offers Remove on the spouse only while a spouse exists, and is read-only for readonly firm members', () => {
    const onRemove = vi.fn();
    const { unmount } = render(<PersonsEditor persons={[person('primary', 'Daniel'), person('spouse', 'Maria')]} canWrite saving={false} onSave={vi.fn()} onRemove={onRemove} />);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('spouse');
    unmount();
    render(<PersonsEditor persons={[person('primary', 'Daniel')]} canWrite={false} saving={false} onSave={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Save primary/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Primary taxpayer first name')).toBeDisabled();
  });
});

describe('StateSelect (QA D3)', () => {
  it('offers exactly the 51 jurisdictions as a select, never a free-text box that truncates "Missouri" to "MI"', () => {
    const onChange = vi.fn();
    render(<StateSelect id="s" label="Resident state" value="" onChange={onChange} />);
    const sel = screen.getByLabelText('Resident state') as HTMLSelectElement;
    expect(sel.tagName).toBe('SELECT');
    expect(sel.options).toHaveLength(52); // "Not set" + 50 states + DC
    expect(screen.getByRole('option', { name: 'MO · Missouri' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DC · District of Columbia' })).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: 'MO' } });
    expect(onChange).toHaveBeenCalledWith('MO');
  });
  it('keeps an unknown stored code visible (flagged) instead of silently dropping it', () => {
    render(<StateSelect id="s" label="Resident state" value="ZZ" onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'ZZ (not a supported state)' })).toBeInTheDocument();
  });
});
