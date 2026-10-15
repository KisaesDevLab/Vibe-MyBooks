// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import type { DependentDTO } from '@kis-books/shared';
import { DependentsEditor, ageAtYearEnd, ageGroupLabel } from './DependentsEditor';

const dep = (over: Partial<DependentDTO> = {}): DependentDTO => ({
  id: 'd1', taxpayerId: 'tp', displayName: 'Tobi Rivera', dateOfBirth: '2016-03-10', relationship: 'son', kind: 'qualifying_child',
  monthsLivedWith: null, isStudent: false, isDisabled: false, firstTaxYear: null, lastTaxYear: null, createdAt: '', updatedAt: '', ...over,
});
const noop = () => undefined;

describe('DependentsEditor (Q44)', () => {
  it('age helpers: Dec 31 age and the engine age groups', () => {
    expect(ageAtYearEnd('2008-12-31', 2025)).toBe(17);
    expect(ageAtYearEnd('2009-01-01', 2025)).toBe(16);
    expect([12, 13, 16, 17, 18, 19, 23, 24].map(ageGroupLabel)).toEqual(['Under 13', '13–16', '13–16', '17–18', '17–18', '19–23', '19–23', '24 or older']);
  });

  it('lists dependents; read-only users get no edit controls; an empty list explains what dependents drive', () => {
    const { rerender } = render(<DependentsEditor dependents={[dep({ isStudent: true })]} canWrite={false} saving={false} onCreate={noop} onUpdate={noop} onRemove={noop} />);
    expect(screen.getByText('Tobi Rivera')).toBeTruthy();
    expect(screen.getByText(/student/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add dependent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    rerender(<DependentsEditor dependents={[]} canWrite={false} saving={false} onCreate={noop} onUpdate={noop} onRemove={noop} />);
    expect(screen.getByText(/No dependents/)).toBeTruthy();
  });

  it('adds a dependent with the typed fields (no SSN) and removes one', () => {
    const onCreate = vi.fn(); const onRemove = vi.fn();
    render(<DependentsEditor dependents={[dep()]} canWrite saving={false} onCreate={onCreate} onUpdate={noop} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tobi Rivera' }));
    expect(onRemove).toHaveBeenCalledWith('d1');
    fireEvent.click(screen.getByRole('button', { name: 'Add dependent' }));
    fireEvent.change(screen.getByLabelText('Dependent name'), { target: { value: 'Ike' } });
    fireEvent.change(screen.getByLabelText('Dependent date of birth'), { target: { value: '2008-02-20' } });
    fireEvent.click(screen.getByLabelText('Full-time student'));
    fireEvent.change(screen.getByLabelText('Months lived with taxpayer (blank = all year)'), { target: { value: '12' } });
    const buttons = screen.getAllByRole('button', { name: 'Add dependent' });
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0]![0]).toEqual({
      displayName: 'Ike', dateOfBirth: '2008-02-20', relationship: 'son', kind: 'qualifying_child', monthsLivedWith: 12, isStudent: true, isDisabled: false, firstTaxYear: null, lastTaxYear: null,
    });
    expect(screen.queryByLabelText(/social security/i)).toBeNull();
  });
});
