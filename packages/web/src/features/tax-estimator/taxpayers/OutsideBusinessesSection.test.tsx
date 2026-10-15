// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import type { OutsideEntityDTO, PersonDTO } from '@kis-books/shared';
import { OutsideBusinessesView, yearSummary } from './OutsideBusinessesSection';

const persons: PersonDTO[] = [
  { id: 'p1', taxpayerId: 'tp', role: 'primary', firstName: 'Maya', lastName: 'Okonkwo', dateOfBirth: null, isBlind: false, sehiEligibleMonths: [] },
  { id: 'p2', taxpayerId: 'tp', role: 'spouse', firstName: 'Leo', lastName: 'Okonkwo', dateOfBirth: null, isBlind: false, sehiEligibleMonths: [] },
];
const zero = { ordinary: '0', rental: '0', interest: '0', dividends_ordinary: '0', dividends_qualified: '0', capital_gain_st: '0', capital_gain_lt: '0', section_1231: '0' };
const entity = (over: Partial<OutsideEntityDTO> = {}): OutsideEntityDTO => ({
  id: 'o1', taxpayerId: 'tp', name: 'Lakeside Partners LP', entityType: 'partnership', personId: 'p1', personRole: 'primary', profitPct: 25, lossPct: null,
  partnerSeStatus: 'limited', isOfficer: false, activityType: 'passive', activeParticipation: false, qbiEligible: null, isSstb: false,
  rentalQbiTradeOrBusiness: false, stateSourcing: null, createdAt: '', updatedAt: '', years: [], year: null, ...over,
});
const props = (over: Record<string, unknown> = {}) => ({
  entities: [entity()], persons, taxYear: 2026, canWrite: true, saving: false,
  onSaveDef: vi.fn(), onRemove: vi.fn(), onSaveYear: vi.fn(), onRemoveYear: vi.fn(), ...over,
});

describe('Outside businesses card (Q45)', () => {
  it('lists the business with the "Outside MyBooks · entered" sub-label and the year summary; read-only users get no controls', () => {
    const withYear = entity({ years: [2026], year: { outsideEntityId: 'o1', taxYear: 2026, entryMode: 'ytd', amountBasis: 'owner_share', throughMonth: 6, amounts: { ...zero, ordinary: '45000', interest: '500' }, guaranteedPayments: '0', officerWages: '0', ownerSehi: '0', ownerRetirement: '0', sehiAsW2Wages: '0', w2Wages: null, ubia: null, includeSehiInW2Wages: false, allowedLossOverride: null, updatedAt: '' } });
    expect(yearSummary(withYear)).toBe("YTD through Jun · owner's share · net $45,500");
    expect(yearSummary(entity())).toBe('No amounts entered');
    render(<OutsideBusinessesView {...props({ entities: [withYear], canWrite: false })} />);
    expect(screen.getByText('Lakeside Partners LP')).toBeTruthy();
    expect(screen.getByText(/Outside MyBooks · entered/)).toBeTruthy();
    expect(screen.getByText("YTD through Jun · owner's share · net $45,500")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add outside business' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit Lakeside/ })).toBeNull();
  });

  it('adds a business: partnership fields, owner, stated %, passive activity', () => {
    const p = props({ entities: [] });
    render(<OutsideBusinessesView {...p} />);
    expect(screen.getByText(/No outside businesses/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add outside business' }));
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Lakeside Partners LP' } });
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'spouse' } });
    fireEvent.change(screen.getByLabelText('Profit %'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Activity type'), { target: { value: 'passive' } });
    fireEvent.change(screen.getByLabelText('Partner SE status'), { target: { value: 'limited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add business' }));
    expect(p.onSaveDef).toHaveBeenCalledTimes(1);
    expect(p.onSaveDef.mock.calls[0]![0]).toBeNull();
    expect(p.onSaveDef.mock.calls[0]![1]).toEqual({
      name: 'Lakeside Partners LP', entityType: 'partnership', personRole: 'spouse', profitPct: 25, lossPct: null, partnerSeStatus: 'limited', isOfficer: false,
      activityType: 'passive', activeParticipation: false, qbiEligible: null, isSstb: false, rentalQbiTradeOrBusiness: false, stateSourcing: null,
    });
  });

  it('enters year amounts: YTD needs a through month; amounts, basis and guaranteed payments are sent; S corp-only fields are not shown for a partnership', () => {
    const p = props();
    render(<OutsideBusinessesView {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter 2026 amounts for Lakeside Partners LP' }));
    expect(screen.queryByLabelText('Officer W-2 wages (owner)')).toBeNull();
    fireEvent.change(screen.getByLabelText('Entry mode'), { target: { value: 'ytd' } });
    const save = () => screen.getByRole('button', { name: 'Save 2026 amounts' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/month/);
    fireEvent.change(screen.getByLabelText('Year to date through'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Amounts are'), { target: { value: 'entity_total' } });
    fireEvent.change(screen.getByLabelText('Ordinary income / (loss)'), { target: { value: '-12000' } });
    fireEvent.change(screen.getByLabelText('Interest'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Guaranteed payments to the owner'), { target: { value: '5000' } });
    fireEvent.click(save());
    expect(p.onSaveYear).toHaveBeenCalledTimes(1);
    const [id, input] = p.onSaveYear.mock.calls[0]!;
    expect(id).toBe('o1');
    expect(input).toMatchObject({
      entryMode: 'ytd', amountBasis: 'entity_total', throughMonth: 6, guaranteedPayments: '5000', officerWages: '0', w2Wages: null, ubia: null, allowedLossOverride: null,
      amounts: { ...zero, ordinary: '-12000', interest: '300' },
    });
  });

  it('a C corporation hides the basis and owner items (entity-level estimate)', () => {
    render(<OutsideBusinessesView {...props({ entities: [entity({ entityType: 'c_corp', partnerSeStatus: null })] })} />);
    fireEvent.click(screen.getByRole('button', { name: /Enter 2026 amounts/ }));
    expect(screen.queryByLabelText('Amounts are')).toBeNull();
    expect(screen.queryByLabelText('Owner health insurance (SEHI)')).toBeNull();
    expect(screen.getByText(/entity level on its taxable income/)).toBeTruthy();
  });
});
