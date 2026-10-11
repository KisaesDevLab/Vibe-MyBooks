// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render, within } from '@testing-library/react';
import type { AdjustmentDTO, AdjustmentTypeDTO, ScenarioDTO, StateRowDTO } from '@kis-books/shared';
import { ScenarioTabs } from './ScenarioTabs';
import { AllocationStrip } from './AllocationStrip';
import { AdjustmentsSection, previewMonths } from './AdjustmentsSection';
import { StateRowsEditor, validateDrafts, draftFromRow } from './StateRowsEditor';

const scen = (over: Partial<ScenarioDTO> = {}): ScenarioDTO => ({
  id: 's1', taxpayerId: 'tp', taxYear: 2026, name: 'Base', isBase: true, sortOrder: 0, sourceScenarioId: null,
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

  it('selects, clones and renames; Base has no Delete', () => {
    const h = handlers();
    render(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s1" canWrite {...h} />);
    expect(screen.getByRole('tab', { name: /Base/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Buy truck/ }));
    expect(h.onSelect).toHaveBeenCalledWith('s2');
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(h.onClone).toHaveBeenCalledWith('s1');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Scenario name'), { target: { value: 'Baseline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(h.onRename).toHaveBeenCalledWith('s1', 'Baseline');
  });

  it('deletes a non-base scenario only after confirmation', () => {
    const h = handlers();
    render(<ScenarioTabs scenarios={[scen(), scen({ id: 's2', name: 'Buy truck', isBase: false })]} selectedId="s2" canWrite {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(h.onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(h.onDelete).toHaveBeenCalledWith('s2');
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
    taxYear: 2026, adjustments: [adj()], total: 1, types: [type()], persons: [], canWrite: true,
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
