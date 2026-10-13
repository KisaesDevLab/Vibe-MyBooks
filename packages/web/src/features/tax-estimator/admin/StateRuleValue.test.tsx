// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Q53: the new state rule keys render on Admin -> Tax parameters -> States (bracket tables) and edit as JSON.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getStateRuleDef } from '@kis-books/shared';
import { StateRuleValue, formatStateRuleValue, stateRuleEditorText } from './StateRuleValue';
import { validateStateOverride } from './StateRuleModal';

const same = <T,>(v: T) => ({ single: v, mfj: v, mfs: v, hoh: v, qss: v });
const MO = { ...same([{ over: 0, rate: 0 }, { over: 1313, rate: 0.02 }, { over: 9191, rate: 0.047 }]), simplified: true, note: 'MFJ uses the single chart' };

describe('Q53 state rule values', () => {
  it('renders a bracket table per filing status, the alternative schedules and the simplified note', () => {
    render(<StateRuleValue type="brackets" value={{ ...MO, schedules_by_income: [{ income_over: 94700, ...same([{ over: 0, rate: 0.02 }]) }] }} />);
    expect(screen.getByRole('table', { name: /Rate schedule/ })).toBeInTheDocument();
    expect(screen.getAllByText(/4\.7% over \$9,191/).length).toBe(5);
    expect(screen.getByText(/1 alternative schedules/)).toBeInTheDocument();
    expect(screen.getByText(/Simplified: MFJ uses the single chart/)).toBeInTheDocument();
  });

  it('formats the standard deduction, capital gains, federal tax deduction and WA excise on one line', () => {
    expect(formatStateRuleValue('standard_deduction', { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 })).toContain('MFJ $31,500');
    expect(formatStateRuleValue('capital_gains', { treatment: 'exclusion', applies_to: 'net_ltcg', exclusion_tiers: [{ over: 0, pct: 0.5 }, { over: 10000000, pct: 1 }] })).toMatch(/exclusion; 50% excluded over \$0, 100% excluded over \$10,000,000 of net long-term gain/);
    expect(formatStateRuleValue('federal_tax_deduction', { tiers: [{ agi_over: 0, pct: 0.35, cap: { single: 5000, mfj: 10000, mfs: 5000, hoh: 5000, qss: 5000 } }] })).toContain('35%');
    expect(formatStateRuleValue('capital_gains_excise', { standard_deduction: 278000, brackets: [{ over: 0, rate: 0.07 }, { over: 1000000, rate: 0.099 }], estimates_required: false })).toContain('no estimates');
    expect(formatStateRuleValue('brackets', null)).toBe('None');
  });

  it('edits as JSON and validates through the registry', () => {
    const def = getStateRuleDef('brackets')!;
    const text = stateRuleEditorText('brackets', MO);
    expect(JSON.parse(text)).toEqual(MO);
    expect(validateStateOverride(def, text, false, 'MO 2025 chart').valueError).toBeUndefined();
    expect(validateStateOverride(def, '{"single": []}', false, 'x y z').valueError).toMatch(/single/);
    expect(validateStateOverride(def, '', true, 'not published').value).toBeNull();
  });
});
