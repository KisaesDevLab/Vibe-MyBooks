// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FederalResult } from '@kis-books/shared';
import { SeTaxTiles } from './SeTaxTiles';

type P = FederalResult['persons'][number];
const person = (over: Partial<P>): P => ({
  personId: 'p1', role: 'primary', displayName: 'Daniel Rivera', ageAtYearEnd: 45, w2Wages: '0', totalWages: '0',
  seIncome: '128000', nese: '118208', seTaxSocialSecurity: '14658', seTaxMedicare: '3428', seTax: '18086', halfSeTax: '9043',
  ...over,
} as P);

describe('SeTaxTiles (UI-SPEC §01 per-person SE tax tiles)', () => {
  it('data: one tile per person with SE income, SE tax and the half-SE deduction from the engine result', () => {
    render(<SeTaxTiles persons={[
      person({}),
      person({ personId: 'p2', role: 'spouse', displayName: 'Maria Rivera', seIncome: '0', nese: '0', seTax: '0', halfSeTax: '0', totalWages: '54000' }),
    ]} additionalMedicareTax="412" />);
    const daniel = screen.getByRole('group', { name: 'Daniel Rivera self-employment tax' });
    expect(within(daniel).getByText('$18,086')).toBeInTheDocument();
    expect(within(daniel).getByText('SE income').nextSibling).toHaveTextContent('$128,000');
    expect(within(daniel).getByText('½ SE tax deduction').nextSibling).toHaveTextContent('$9,043');
    const maria = screen.getByRole('group', { name: 'Maria Rivera self-employment tax' });
    expect(within(maria).getByText('$0')).toBeInTheDocument();
    expect(within(maria).getByText(/No self-employment income · wages \$54,000/)).toBeInTheDocument();
    // Additional Medicare is a return-level figure (Form 8959), shown once, never split per person.
    expect(screen.getByText(/Additional Medicare tax \(household, Form 8959\)/).nextSibling).toHaveTextContent('$412');
  });

  it('empty: no people on the taxpayer', () => {
    render(<SeTaxTiles persons={[]} additionalMedicareTax="0" />);
    expect(screen.getByText(/No people are recorded for this taxpayer/)).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('hides the Additional Medicare line when it is zero', () => {
    render(<SeTaxTiles persons={[person({})]} additionalMedicareTax="0" />);
    expect(screen.queryByText(/Additional Medicare/)).toBeNull();
  });
});
