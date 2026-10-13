// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { StateBase, StateRowDTO, StateRowInput, ReplaceStateRowsInput, StateRowRateMode, StateRowNonresidentMode } from '@kis-books/shared';
import { STATE_BASES, STATE_CODES } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SELECT_CLASS } from '../taxpayers/labels';
import { StateSelect } from '../taxpayers/StateSelect';
import { STATE_BASE_LABELS, plainDecimal } from './labels';
import { NumericField } from '../../../components/forms/NumericField';

export interface StateDraft {
  key: string;
  residency: 'resident' | 'nonresident';
  state: string;
  /** Percent as typed, e.g. "4.00". Stored rate = percent / 100. */
  ratePct: string;
  base: StateBase;
  /** Q53: the state's rate schedule (default) or the effective-rate override. */
  rateMode: StateRowRateMode;
  /** Q53 nonresident rows: the state's method on the schedule (default) or sourced income × rate. */
  nonresidentMode: StateRowNonresidentMode;
  customBase: string;
  sourcedManual: boolean;
  sourcedIncome: string;
  creditOverride: string;
  memo: string;
}

const MAX_RATE_PCT = 20;
let seq = 0;
const nextKey = () => `row-${++seq}`;

export function draftFromRow(r: StateRowDTO): StateDraft {
  return {
    key: r.id, residency: r.residency, state: r.state, ratePct: String(Number((r.effectiveRate * 100).toFixed(4))),
    base: r.base, rateMode: r.rateMode ?? 'brackets', nonresidentMode: r.nonresidentMode ?? 'ratio',
    customBase: plainDecimal(r.customBase), sourcedManual: r.sourcedManual, sourcedIncome: plainDecimal(r.sourcedIncome),
    creditOverride: plainDecimal(r.creditOverride), memo: r.memo ?? '',
  };
}

/** Client-side mirror of the server rules; the server remains the authority. */
export function validateDrafts(rows: StateDraft[]): string | null {
  const residents = rows.filter((r) => r.residency === 'resident');
  if (residents.length !== 1) return 'Exactly one resident state is required.';
  const seen = new Set<string>();
  for (const r of rows) {
    if (!(STATE_CODES as readonly string[]).includes(r.state.toUpperCase())) return 'Choose a state for every row.';
    const code = r.state.toUpperCase();
    if (seen.has(code)) return r.residency === 'nonresident' && code === residents[0]!.state.toUpperCase()
      ? 'A nonresident state cannot be the resident state.' : `${code} appears more than once.`;
    seen.add(code);
    const rate = Number(r.ratePct);
    // Q53: on the rate schedule the effective rate is only the fallback, so it may be left blank (0).
    const rateRequired = usesEffectiveRate(r);
    if (rateRequired && r.ratePct.trim() === '') return `Rate for ${code} must be between 0 and ${MAX_RATE_PCT}%.`;
    if (r.ratePct.trim() !== '' && (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE_PCT)) return `Rate for ${code} must be between 0 and ${MAX_RATE_PCT}%.`;
    if (r.base === 'custom' && r.customBase.trim() === '') return `Enter a custom base for ${code}.`;
    if (r.residency === 'nonresident' && r.sourcedManual && r.sourcedIncome.trim() === '') return `Enter sourced income for ${code}.`;
  }
  return null;
}

/** Q53: whether the row's tax is the effective rate (override, or a nonresident sourced × rate). */
export function usesEffectiveRate(r: Pick<StateDraft, 'rateMode' | 'nonresidentMode' | 'residency'>): boolean {
  return r.rateMode === 'effective' || (r.residency === 'nonresident' && r.nonresidentMode === 'sourced_rate');
}

export function draftsToInput(rows: StateDraft[]): ReplaceStateRowsInput {
  return {
    rows: rows.map((r): StateRowInput => ({
      residency: r.residency, state: r.state.toUpperCase(),
      effectiveRate: r.ratePct.trim() === '' ? 0 : Math.round(Number(r.ratePct) * 10000) / 1000000,
      rateMode: r.rateMode,
      ...(r.residency === 'nonresident' ? { nonresidentMode: r.nonresidentMode } : {}),
      base: r.base, customBase: r.base === 'custom' ? r.customBase.trim() : null,
      sourcedManual: r.residency === 'nonresident' && r.sourcedManual,
      sourcedIncome: r.residency === 'nonresident' && r.sourcedManual ? r.sourcedIncome.trim() : null,
      creditOverride: r.creditOverride.trim() === '' ? null : r.creditOverride.trim(),
      memo: r.memo.trim() === '' ? null : r.memo.trim(),
    })),
  };
}

interface Props {
  rows: StateRowDTO[];
  canWrite: boolean;
  saving?: boolean;
  error?: string;
  /** Pre-fills the resident row of an empty scenario. */
  defaultResidentState?: string | null;
  onSave: (input: ReplaceStateRowsInput) => void;
}

function RowCard({ d, canWrite, onChange, onRemove }: {
  d: StateDraft; canWrite: boolean; onChange: (patch: Partial<StateDraft>) => void; onRemove?: () => void;
}) {
  const nonres = d.residency === 'nonresident';
  const who = nonres ? 'Nonresident' : 'Resident';
  const label = `${who} ${d.state || 'state'}`;
  // QA D31: never "Nonresident state state code".
  const stateLabel = d.state ? `${who} ${d.state} state` : `${who} state`;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 space-y-2" aria-label={label} data-testid={`state-row-${d.residency}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">{nonres ? 'Nonresident' : 'Resident'}</h4>
        {usesEffectiveRate(d)
          ? <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{d.rateMode === 'effective' ? 'Effective-rate override' : 'Effective-rate estimate'}</span>
          : <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-800">{nonres ? 'Rate schedule, state method' : 'Rate schedule'}</span>}
        {nonres && canWrite && onRemove && <Button size="sm" variant="ghost" onClick={onRemove}>Remove</Button>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StateSelect id={`state-${d.key}`} label="State" ariaLabel={stateLabel} value={d.state} disabled={!canWrite}
          allowEmpty={false} onChange={(code) => onChange({ state: code })} />
        <div>
          <label htmlFor={`mode-${d.key}`} className="block text-sm font-medium text-gray-700 mb-1">Tax computed by</label>
          <select id={`mode-${d.key}`} aria-label={`${label} tax computed by`} className={SELECT_CLASS} value={d.rateMode} disabled={!canWrite} onChange={(e) => onChange({ rateMode: e.target.value as StateRowRateMode })}>
            <option value="brackets">State rate schedule</option>
            <option value="effective">Effective-rate override</option>
          </select>
        </div>
        <NumericField label={usesEffectiveRate(d) ? `${label} rate %` : `${label} fallback rate %`} min={0} decimals={4} value={d.ratePct} disabled={!canWrite} onChange={(v) => onChange({ ratePct: v })} />
        <div>
          <label htmlFor={`base-${d.key}`} className="block text-sm font-medium text-gray-700 mb-1">Base</label>
          <select id={`base-${d.key}`} className={SELECT_CLASS} value={d.base} disabled={!canWrite} onChange={(e) => onChange({ base: e.target.value as StateBase })}>
            {STATE_BASES.map((b) => <option key={b} value={b}>{STATE_BASE_LABELS[b]}</option>)}
          </select>
        </div>
        {d.base === 'custom' && <NumericField label={`${label} custom base`} value={d.customBase} disabled={!canWrite} onChange={(v) => onChange({ customBase: v })} />}
        {!nonres && <NumericField label="Other-state credit override" value={d.creditOverride} disabled={!canWrite} onChange={(v) => onChange({ creditOverride: v })} />}
      </div>
      {!usesEffectiveRate(d) && (
        <p className="text-xs text-gray-500">
          The state&apos;s {nonres ? 'own nonresident method on its' : ''} rate schedule, standard deduction, exemptions and capital gain rules apply (the base selector is used only when the state has no starting point on file, or &quot;Custom&quot; = your state taxable income). The rate is used only if no schedule is on file for the year.
        </p>
      )}
      {nonres && (
        <div className="space-y-2">
          {d.rateMode === 'brackets' && (
            <div className="max-w-sm">
              <label htmlFor={`nrmode-${d.key}`} className="block text-sm font-medium text-gray-700 mb-1">Nonresident tax</label>
              <select id={`nrmode-${d.key}`} aria-label={`${label} nonresident tax`} className={SELECT_CLASS} value={d.nonresidentMode} disabled={!canWrite} onChange={(e) => onChange({ nonresidentMode: e.target.value as StateRowNonresidentMode })}>
                <option value="ratio">State&apos;s method (ratio of the full return)</option>
                <option value="sourced_rate">Sourced income × rate</option>
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={d.sourcedManual} disabled={!canWrite} onChange={(e) => onChange({ sourcedManual: e.target.checked })} />
            Enter sourced income manually
          </label>
          {d.sourcedManual
            ? <NumericField label={`${label} sourced income`} value={d.sourcedIncome} disabled={!canWrite} onChange={(v) => onChange({ sourcedIncome: v })} />
            : <p className="text-xs text-gray-500">Derived from each entity&apos;s state and your ownership share when the estimate runs.</p>}
        </div>
      )}
      <Input label={`${label} memo`} value={d.memo} disabled={!canWrite} onChange={(e) => onChange({ memo: e.target.value })} />
    </section>
  );
}

/** Resident + nonresident state rows for one scenario. Save replaces the whole set. */
export function StateRowsEditor({ rows, canWrite, saving, error, defaultResidentState, onSave }: Props) {
  const [drafts, setDrafts] = useState<StateDraft[]>(() => rows.length > 0
    ? rows.map(draftFromRow)
    : [{ key: nextKey(), residency: 'resident', state: defaultResidentState ?? '', ratePct: '', base: 'federal_agi', rateMode: 'brackets', nonresidentMode: 'ratio', customBase: '', sourcedManual: false, sourcedIncome: '', creditOverride: '', memo: '' }]);
  const problem = validateDrafts(drafts);
  const patch = (key: string, p: Partial<StateDraft>) => setDrafts((cur) => cur.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const ordered = [...drafts].sort((a, b) => (a.residency === b.residency ? 0 : a.residency === 'resident' ? -1 : 1));

  return (
    <div className="space-y-3" aria-label="State rows">
      {drafts.length === 0 && <p className="text-sm text-gray-500">No states yet.</p>}
      {ordered.map((d) => (
        <RowCard key={d.key} d={d} canWrite={canWrite} onChange={(p) => patch(d.key, p)}
          onRemove={() => setDrafts((cur) => cur.filter((x) => x.key !== d.key))} />
      ))}
      {canWrite && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setDrafts((cur) => [...cur, {
            key: nextKey(), residency: cur.some((d) => d.residency === 'resident') ? 'nonresident' : 'resident', state: '', ratePct: '',
            base: 'federal_agi', rateMode: 'brackets', nonresidentMode: 'ratio', customBase: '', sourcedManual: false, sourcedIncome: '', creditOverride: '', memo: '' }])}>+ Add state</Button>
          <Button size="sm" disabled={!!problem} loading={saving} onClick={() => onSave(draftsToInput(drafts))}>Save states</Button>
        </div>
      )}
      {problem && <p className="text-sm text-amber-700" role="status" data-testid="state-problem">{problem}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
