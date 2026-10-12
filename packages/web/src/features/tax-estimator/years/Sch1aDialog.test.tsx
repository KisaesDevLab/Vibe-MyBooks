// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { PersonDTO, YearDetailDTO, YearSettingsDTO } from '@kis-books/shared';
import { Sch1aDialog } from './Sch1aDialog';
import { YearInputsForm } from './YearInputsForm';

const person = (role: 'primary' | 'spouse', firstName: string, dateOfBirth: string | null): PersonDTO => ({
  id: `p-${role}`, taxpayerId: 'tp', role, firstName, lastName: 'Rivera', dateOfBirth, isBlind: false, sehiEligibleMonths: Array(12).fill(true),
});
const persons = [person('primary', 'Carlos', '1958-03-01'), person('spouse', 'Maria', '1981-05-10')];

describe('Sch1aDialog (UI-SPEC §02 Schedule 1-A per-person entry)', () => {
  it('data: per-person tips / overtime / car-loan interest, senior status from date of birth; Apply returns the edited values', () => {
    const onApply = vi.fn();
    render(<Sch1aDialog open taxYear={2026} filingStatus="mfj" persons={persons} canWrite
      values={{ 'primary.qualifiedTips': '1200' }} onApply={onApply} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Schedule 1-A' });
    expect(within(dialog).getByLabelText('Carlos — Qualified tips')).toHaveValue('1200');
    expect(within(dialog).getByTestId('senior-primary')).toHaveTextContent('65 or older at the end of 2026');
    expect(within(dialog).getByTestId('senior-spouse')).toHaveTextContent('Under 65');
    fireEvent.change(within(dialog).getByLabelText('Maria — Qualified overtime'), { target: { value: '5000' } });
    fireEvent.change(within(dialog).getByLabelText('Carlos — Car loan interest'), { target: { value: '3,700' } });
    expect(within(dialog).getByRole('button', { name: 'Apply' })).toBeDisabled(); // "3,700" is not an amount
    fireEvent.change(within(dialog).getByLabelText('Carlos — Car loan interest'), { target: { value: '3700' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      'primary.qualifiedTips': '1200', 'spouse.qualifiedOvertime': '5000', 'primary.carLoanInterest': '3700',
    }));
    expect(screen.queryByText(/not allowed when married filing separately/)).toBeNull();
  });

  it('MFS: notice that the deduction is disallowed', () => {
    render(<Sch1aDialog open taxYear={2026} filingStatus="mfs" persons={[persons[0]!]} canWrite values={{}} onApply={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('note')).toHaveTextContent(/not allowed when married filing separately/);
  });

  it('empty: no people yet', () => {
    render(<Sch1aDialog open taxYear={2026} filingStatus="single" persons={[]} canWrite values={{}} onApply={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/Add the taxpayer.s people first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('read-only: inputs disabled, only Close; Escape cancels; closed renders nothing', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<Sch1aDialog open taxYear={2026} filingStatus="mfj" persons={persons} canWrite={false} values={{}} onApply={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByLabelText('Maria — Qualified tips')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    rerender(<Sch1aDialog open={false} taxYear={2026} filingStatus="mfj" persons={persons} canWrite values={{}} onApply={vi.fn()} onCancel={onCancel} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('YearInputsForm — Schedule 1-A chips + dialog', () => {
  const y: YearSettingsDTO = {
    id: 'y1', taxpayerId: 'tp', taxYear: 2026, priorYearTax: null, priorYearAgi: null, priorYearTaxPresent: false, priorYearAgiPresent: false,
    priorYearTwelveMonths: true, priorYearFiled: true, safeHarborRule: null, rateMode: 'brackets', effectiveRateOverride: null, deductionMode: 'auto',
    itemized: {}, sch1a: { primary: { qualifiedTips: 1200 } }, creditsNonrefundable: '0', creditsRefundable: '0', hsaCoverage: {}, withholding: {},
    personInputs: {}, mfsLivedApartAllYear: false, niiAllocableDeductions: null, farmerGross: {}, isFisherman: false,
    createdAt: '', updatedAt: '',
  };
  const detail: YearDetailDTO = {
    exists: true, year: y, taxpayerSafeHarborOverride: null, firmSafeHarborDefault: 'lesser_of', effectiveSafeHarborRule: 'lesser_of',
    scenarios: [{ id: 's1', taxpayerId: 'tp', taxYear: 2026, name: 'Base', isBase: true, sortOrder: 0, sourceScenarioId: null, createdAt: '', updatedAt: '' }],
  };

  it('shows the chips summary, edits through the dialog, and saves the year-level sch1a', () => {
    const onSave = vi.fn();
    render(<YearInputsForm detail={detail} persons={persons} filingStatus="mfj" canWrite onSave={onSave} />);
    const chips = screen.getByLabelText('Schedule 1-A summary');
    expect(chips).toHaveTextContent('Senior · Carlos 65+');
    expect(chips).toHaveTextContent('Tips · $1,200.00');
    expect(chips).toHaveTextContent('Overtime · $0.00');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Schedule 1-A' }));
    const dialog = screen.getByRole('dialog', { name: 'Schedule 1-A' });
    fireEvent.change(within(dialog).getByLabelText('Maria — Qualified overtime'), { target: { value: '21000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chips).toHaveTextContent('Overtime · $21,000.00');
    fireEvent.click(screen.getByRole('button', { name: 'Save annual settings' }));
    expect(onSave.mock.calls[0]![0].sch1a).toEqual({ primary: { qualifiedTips: 1200 }, spouse: { qualifiedOvertime: 21000 } });
  });

  it('Cancel discards dialog edits; MFS shows the disallowed notice beside the chips', () => {
    render(<YearInputsForm detail={detail} persons={[persons[0]!]} filingStatus="mfs" canWrite onSave={vi.fn()} />);
    expect(screen.getByLabelText('Schedule 1-A summary')).toHaveTextContent(/not allowed when married filing separately/);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Schedule 1-A' }));
    fireEvent.change(screen.getByLabelText('Carlos — Qualified tips'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Schedule 1-A summary')).toHaveTextContent('Tips · $1,200.00');
  });
});
