// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { getStateRuleDef } from '@kis-books/shared';
import type { StateRuleSummaryDTO, StateRulesDTO } from '@kis-books/shared';
import { renderRoute } from '../../../test-utils';

interface QState<T> { data: T | undefined; isLoading: boolean; isError: boolean; refetch: ReturnType<typeof vi.fn> }

const h = vi.hoisted(() => ({
  summary: { data: undefined, isLoading: false, isError: false, refetch: vi.fn() } as QState<unknown>,
  detail: { data: undefined, isLoading: false, isError: false, refetch: vi.fn() } as QState<unknown>,
  setOverride: vi.fn(),
  revert: vi.fn(),
  create: vi.fn(),
  verify: vi.fn(),
  verifyAll: vi.fn(),
}));

vi.mock('../../../api/hooks/useTaxStateRules', () => ({
  useStateRuleSummaries: () => h.summary,
  useStateRules: () => h.detail,
  useStateRuleDiff: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useStateRuleChanges: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSetStateRuleOverride: () => ({ mutate: h.setOverride, isPending: false, isError: false, reset: vi.fn() }),
  useRevertStateRule: () => ({ mutate: h.revert, isPending: false }),
  useCreateStateYearFromPrior: () => ({ mutate: h.create, isPending: false }),
  useAdoptShippedStateRules: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyStateRule: () => ({ mutate: h.verify, isPending: false, isError: false, reset: vi.fn() }),
  useVerifyAllStateRules: () => ({ mutate: h.verifyAll, isPending: false, isError: false, reset: vi.fn() }),
}));

import { StatesView, } from './StatesView';
import { parseStateEditorValue, validateStateOverride } from './StateRuleModal';

const counts = (o: Partial<StateRuleSummaryDTO['counts']> = {}) => ({ verified: 0, unverified: 0, provisional: 0, override: 0, ...o });
const summaries = (): StateRuleSummaryDTO[] => [
  { state: 'AR', name: 'Arkansas', hasIncomeTax: true, status: 'complete', counts: counts({ verified: 12, override: 1 }), usesFederalFallback: false, fallbackYear: null },
  { state: 'MO', name: 'Missouri', hasIncomeTax: true, status: 'partial', counts: counts({ unverified: 3 }), usesFederalFallback: true, fallbackYear: null },
  { state: 'TX', name: 'Texas', hasIncomeTax: false, status: 'complete', counts: counts({ verified: 1 }), usesFederalFallback: false, fallbackYear: null },
  { state: 'CA', name: 'California', hasIncomeTax: true, status: 'missing', counts: counts(), usesFederalFallback: true, fallbackYear: null },
];
const detail = (over: Partial<StateRulesDTO> = {}): StateRulesDTO => ({
  year: 2026, state: 'AR', hasIncomeTax: true, isFallback: false, fallbackYear: null, complete: true, missing: [],
  rules: [
    { state: 'AR', key: 'required_threshold', label: 'Estimates required at', type: 'money', value: 1000, status: 'verified', source: 'seed', citation: 'AR1000ES instructions' },
    { state: 'AR', key: 'safe_harbor.current_pct', label: 'Current-year %', type: 'rate', value: 0.9, status: 'unverified', source: 'override', citation: 'Ark. Code', reason: 'testing', shippedValue: 0.8 },
    { state: 'AR', key: 'safe_harbor.high_agi_rule', label: 'High AGI', type: 'high_agi_rule', value: { threshold: 150000, pct: 1.1 }, status: 'verified', source: 'seed', citation: 'x' },
    { state: 'AR', key: 'penalty.rate_source', label: 'Penalty rate source', type: 'enum', value: 'federal', status: 'provisional', source: 'provisional', citation: 'y' },
    { state: 'AR', key: 'penalty.rate_schedule', label: 'Dated penalty rates', type: 'rate_schedule', value: [{ from: '2025-01-01', to: '2025-12-31', rate: 0.08 }, { from: '2026-01-01', to: '2026-12-31', rate: 0.07 }], status: 'verified', source: 'seed', citation: 'z' },
  ],
  ...over,
});

const render = (years = [2025, 2026]) => renderRoute(<StatesView year={2026} years={years} />);

beforeEach(() => {
  vi.clearAllMocks();
  h.summary = { data: summaries(), isLoading: false, isError: false, refetch: vi.fn() };
  h.detail = { data: detail(), isLoading: false, isError: false, refetch: vi.fn() };
});

describe('StatesView list', () => {
  it('shows jurisdictions with status chips, counts, no-income-tax and federal-fallback badges', async () => {
    render();
    expect(await screen.findByText('Arkansas')).toBeInTheDocument();
    expect(screen.getByText('2 complete · 1 partial · 0 fallback · 1 missing')).toBeInTheDocument();
    expect(screen.getAllByText('complete')).toHaveLength(2);
    expect(screen.getByText('partial')).toBeInTheDocument();
    expect(screen.getByText('missing')).toBeInTheDocument();
    expect(screen.getByText('12 verified · 0 unverified · 0 provisional · 1 override')).toBeInTheDocument();
    expect(screen.getAllByText('Federal fallback · verify')).toHaveLength(2);
    expect(screen.getByText('No income tax')).toBeInTheDocument();
  });

  it('filters by name and status', async () => {
    render();
    fireEvent.change(await screen.findByLabelText('Search states'), { target: { value: 'miss' } });
    expect(screen.getByText('Missouri')).toBeInTheDocument();
    expect(screen.queryByText('Arkansas')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search states'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'missing' } });
    expect(screen.getByText('California')).toBeInTheDocument();
    expect(screen.queryByText('Texas')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search states'), { target: { value: 'zzz' } });
    expect(screen.getByText('No states match your filter.')).toBeInTheDocument();
  });

  it('shows loading, error with retry and empty states', async () => {
    h.summary = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    const r = render();
    expect(await screen.findByLabelText('Loading states')).toBeInTheDocument();
    r.unmount();
    h.summary = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    const r2 = render();
    fireEvent.click(await screen.findByText('Try again'));
    expect(h.summary.refetch).toHaveBeenCalled();
    r2.unmount();
    h.summary = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    render();
    expect(await screen.findByText('No jurisdictions are available.')).toBeInTheDocument();
  });

  it('R6-02/03: offers create-from-prior while any state is served from an earlier year (status fallback), and names the year served', async () => {
    const r0 = render();
    await screen.findByText('Arkansas');
    expect(screen.queryByText(/state rules from/)).not.toBeInTheDocument();
    r0.unmount();

    // one state already created, the rest still on the 2025 fallback: the button stays (create is per state)
    h.summary = { data: summaries().map((s) => (s.state === 'AR' ? s : { ...s, status: 'fallback' as const, fallbackYear: 2025, counts: counts({ provisional: 20 }), usesFederalFallback: false })), isLoading: false, isError: false, refetch: vi.fn() };
    const r = render();
    fireEvent.click(await screen.findByText('Create 2026 state rules from 2025'));
    expect(h.create).toHaveBeenCalledWith(2026, expect.anything());
    expect(screen.getAllByText('Using 2025 rules · verify')).toHaveLength(3);
    expect(screen.getByText('1 complete · 0 partial · 3 fallback · 0 missing')).toBeInTheDocument();
    r.unmount();
    // every state missing in every year: nothing to copy, no button
    h.summary = { data: summaries().map((s) => ({ ...s, status: 'missing' as const, counts: counts() })), isLoading: false, isError: false, refetch: vi.fn() };
    render();
    await screen.findByText('Arkansas');
    expect(screen.queryByText(/state rules from/)).not.toBeInTheDocument();
  });
});

describe('StatesView detail', () => {
  const open = async () => { render(); fireEvent.click(await screen.findByLabelText('Open Arkansas')); };

  it('shows the rule table with formatted values and badges', async () => {
    await open();
    expect(await screen.findByText('$1,000')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Shipped:')).toBeInTheDocument();
    expect(screen.getByText(/AGI over \$150,000: 110% of prior year/)).toBeInTheDocument();
    expect(screen.getByText('2025-01-01 to 2025-12-31: 8%; 2026-01-01 to 2026-12-31: 7%')).toBeInTheDocument();
    expect(screen.getAllByText('verified', { selector: 'span' }).length).toBe(3);
    expect(screen.getByText('override', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('AR1000ES instructions')).toBeInTheDocument();
    fireEvent.click(screen.getByText('All states'));
    expect(await screen.findByLabelText('Search states')).toBeInTheDocument();
  });

  it('shows the fallback banner and the incomplete (federal pattern) notice with missing keys; fallback rows cannot be overridden (R6-02)', async () => {
    const fb = detail({ isFallback: true, fallbackYear: 2025, complete: false, missing: ['holidays'] });
    fb.rules = fb.rules.map((r) => ({ ...r, source: 'fallback' as const, status: 'provisional' as const, fallbackYear: 2025 }));
    h.detail = { ...h.detail, data: fb };
    await open();
    expect(await screen.findByText(/No 2026 rules for Arkansas — showing 2025 as provisional/)).toBeInTheDocument();
    expect(screen.getByText(/uses the federal pattern for Arkansas, flagged verify/)).toBeInTheDocument();
    expect(screen.getByLabelText('Missing keys')).toHaveTextContent('holidays');
    expect(screen.queryByLabelText('Override required_threshold')).toBeNull();
    expect(screen.getAllByText('Create 2026 from prior to edit').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Mark .* verified/)).toBeNull();
  });

  it('typed money editor validates, requires a reason and saves', async () => {
    await open();
    fireEvent.click(await screen.findByLabelText('Override required_threshold'));
    const value = screen.getByLabelText(/Value \(money\)/);
    fireEvent.change(value, { target: { value: '-5' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('expected a non-negative number')).toBeInTheDocument();
    expect(screen.getByText(/reason of at least 3/)).toBeInTheDocument();
    expect(h.setOverride).not.toHaveBeenCalled();
    fireEvent.change(value, { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'new instructions' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(h.setOverride).toHaveBeenCalledWith({ state: 'AR', key: 'required_threshold', value: 1200, reason: 'new instructions' }, expect.anything());
  });

  it('JSON object editor uses the shared validator', async () => {
    await open();
    fireEvent.click(await screen.findByLabelText('Override safe_harbor.high_agi_rule'));
    fireEvent.change(screen.getByLabelText(/Value \(high_agi_rule\)/), { target: { value: '{"threshold": 1}' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'because' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('expected { threshold, pct }')).toBeInTheDocument();
    expect(h.setOverride).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Value \(high_agi_rule\)/), { target: { value: '{bad' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
  });

  it('rate-schedule editor takes one "from to rate" line per period, validates order and saves', async () => {
    await open();
    fireEvent.click(await screen.findByLabelText('Override penalty.rate_schedule'));
    const value = screen.getByLabelText(/Value \(rate_schedule\)/) as HTMLTextAreaElement;
    expect(value.value).toBe('2025-01-01 2025-12-31 0.08\n2026-01-01 2026-12-31 0.07');
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'MO-2210 legs' } });
    fireEvent.change(value, { target: { value: '2026-01-01 2026-12-31 0.07\n2025-01-01 2025-12-31 0.08' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('periods must be in date order and must not overlap')).toBeInTheDocument();
    fireEvent.change(value, { target: { value: '2025-01-01 2025-12-31' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(screen.getByText('Line 1: expected "YYYY-MM-DD YYYY-MM-DD rate"')).toBeInTheDocument();
    expect(h.setOverride).not.toHaveBeenCalled();
    fireEvent.change(value, { target: { value: '2025-01-01 2025-12-31 0.08\n2026-01-01, 2026-12-31, 0.07' } });
    fireEvent.click(screen.getByText('Save override'));
    expect(h.setOverride).toHaveBeenCalledWith({
      state: 'AR', key: 'penalty.rate_schedule', reason: 'MO-2210 legs',
      value: [{ from: '2025-01-01', to: '2025-12-31', rate: 0.08 }, { from: '2026-01-01', to: '2026-12-31', rate: 0.07 }],
    }, expect.anything());
  });

  it('revert is offered for override/provisional rows and asks for confirmation', async () => {
    await open();
    expect(screen.queryByLabelText('Revert required_threshold')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Revert safe_harbor.current_pct'));
    expect(screen.getByText('Revert state rule')).toBeInTheDocument();
    expect(h.revert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    await waitFor(() => expect(h.revert).toHaveBeenCalledWith({ state: 'AR', key: 'safe_harbor.current_pct' }, expect.anything()));
  });

  it('shows loading, error and empty detail states', async () => {
    h.detail = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    const r = render();
    fireEvent.click(await screen.findByLabelText('Open Arkansas'));
    expect(await screen.findByLabelText('Loading state rules')).toBeInTheDocument();
    r.unmount();
    h.detail = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    const r2 = render();
    fireEvent.click(await screen.findByLabelText('Open Arkansas'));
    fireEvent.click(await screen.findByText('Try again'));
    expect(h.detail.refetch).toHaveBeenCalled();
    r2.unmount();
    h.detail = { data: detail({ rules: [], complete: false, missing: ['has_income_tax'] }), isLoading: false, isError: false, refetch: vi.fn() };
    render();
    fireEvent.click(await screen.findByLabelText('Open Arkansas'));
    expect(await screen.findByText('No rules for Arkansas in 2026.')).toBeInTheDocument();
  });
});

describe('state editor parsing', () => {
  const def = (k: string) => getStateRuleDef(k)!;
  it('parses lists and null for nullable keys', () => {
    expect(parseStateEditorValue(def('installments.due_dates'), '2026-04-15, 2026-06-15\n2026-09-15', false).value).toEqual(['2026-04-15', '2026-06-15', '2026-09-15']);
    expect(parseStateEditorValue(def('installments.pcts'), '0.25, 0.25', false).value).toEqual([0.25, 0.25]);
    expect(parseStateEditorValue(def('installments.pcts'), '0.25, x', false).error).toBe('expected numbers separated by commas');
    expect(validateStateOverride(def('farmer.rule'), '', true, 'abc').valueError).toBeUndefined();
    expect(validateStateOverride(def('required_threshold'), '', true, 'abc').valueError).toBe('null not allowed for this key');
    expect(validateStateOverride(def('installments.due_dates'), '04/15/2026', false, 'abc').valueError).toBe('expected YYYY-MM-DD dates');
    expect(validateStateOverride(def('farmer.rule'), '{"ratio":0.667,"current_pct":0.667,"due_date":"2026-01-15","file_by":"2027-03-01"}', false, 'abc').valueError).toBeUndefined();
  });

  it('handles the R5 value types (date, rate schedule, enums, exempt farmer)', () => {
    expect(parseStateEditorValue(def('return_due_date'), ' 2026-05-01 ', false).value).toBe('2026-05-01');
    expect(validateStateOverride(def('return_due_date'), '05/01/2026', false, 'abc').valueError).toBe('expected a YYYY-MM-DD date');
    expect(validateStateOverride(def('return_due_date'), '', true, 'abc').valueError).toBeUndefined();
    expect(validateStateOverride(def('penalty.rate_schedule'), '', false, 'abc').valueError).toMatch(/at least one/);
    expect(validateStateOverride(def('penalty.rate_schedule'), '2026-12-31 2026-01-01 0.07', false, 'abc').valueError).toMatch(/ends before it starts/);
    expect(validateStateOverride(def('penalty.min_balance_due'), '500', false, 'abc')).toMatchObject({ value: 500, valueError: undefined });
    expect(validateStateOverride(def('threshold_comparison'), 'more_than', false, 'abc').valueError).toBeUndefined();
    expect(validateStateOverride(def('penalty.method'), 'hourly', false, 'abc').valueError).toMatch(/expected one of daily_simple/);
    expect(validateStateOverride(def('estimates_required'), 'false', false, 'abc')).toMatchObject({ value: false, valueError: undefined });
    expect(validateStateOverride(def('farmer.rule'), '{"ratio":0.667,"current_pct":0,"due_date":"2026-04-15","file_by":"2026-04-15","treatment":"exempt"}', false, 'abc').valueError).toBeUndefined();
    expect(validateStateOverride(def('farmer.rule'), '{"ratio":0.667,"current_pct":0,"due_date":"2026-04-15","file_by":"2026-04-15","treatment":"maybe"}', false, 'abc').valueError).toMatch(/treatment must be one of/);
  });
});

describe('StatesView detail — R7 in-app Verify', () => {
  const open = async () => { render(); fireEvent.click(await screen.findByLabelText('Open Arkansas')); };

  it('Mark verified on a not-verified rule, and a per-jurisdiction bulk verify behind a confirmation', async () => {
    await open();
    expect(await screen.findByLabelText('Mark safe_harbor.current_pct verified')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mark required_threshold verified')).toBeNull();
    fireEvent.click(screen.getByLabelText('Mark penalty.rate_source verified'));
    // QA2-06: the value being signed is shown in the dialog.
    expect(within(screen.getByRole('dialog')).getByTestId('verify-value').textContent).toMatch(/federal/i);
    fireEvent.click(screen.getByRole('button', { name: 'Mark verified' }));
    expect(h.verify).toHaveBeenCalledWith({ state: 'AR', key: 'penalty.rate_source', note: undefined, expectedValue: 'federal' }, expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByText('Verify all unverified in AR 2026 (2)'));
    expect(h.verifyAll).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'AR DFA 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify 2' }));
    expect(h.verifyAll).toHaveBeenCalledWith({ state: 'AR', note: 'AR DFA 2026' }, expect.anything());
  });
});
