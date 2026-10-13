// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { StateBase, StateRowDTO, StateRowInput, ReplaceStateRowsInput } from '@kis-books/shared';
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
    base: r.base, customBase: plainDecimal(r.customBase), sourcedManual: r.sourcedManual, sourcedIncome: plainDecimal(r.sourcedIncome),
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
    if (r.ratePct.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > MAX_RATE_PCT) return `Rate for ${code} must be between 0 and ${MAX_RATE_PCT}%.`;
    if (r.base === 'custom' && r.customBase.trim() === '') return `Enter a custom base for ${code}.`;
    if (r.residency === 'nonresident' && r.sourcedManual && r.sourcedIncome.trim() === '') return `Enter sourced income for ${code}.`;
  }
  return null;
}

export function draftsToInput(rows: StateDraft[]): ReplaceStateRowsInput {
  return {
    rows: rows.map((r): StateRowInput => ({
      residency: r.residency, state: r.state.toUpperCase(),
      effectiveRate: Math.round(Number(r.ratePct) * 10000) / 1000000,
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
        {nonres && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">Effective-rate estimate</span>}
        {nonres && canWrite && onRemove && <Button size="sm" variant="ghost" onClick={onRemove}>Remove</Button>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StateSelect id={`state-${d.key}`} label="State" ariaLabel={stateLabel} value={d.state} disabled={!canWrite}
          allowEmpty={false} onChange={(code) => onChange({ state: code })} />
        <NumericField label={`${label} rate %`} value={d.ratePct} disabled={!canWrite} onChange={(v) => onChange({ ratePct: v })} />
        <div>
          <label htmlFor={`base-${d.key}`} className="block text-sm font-medium text-gray-700 mb-1">Base</label>
          <select id={`base-${d.key}`} className={SELECT_CLASS} value={d.base} disabled={!canWrite} onChange={(e) => onChange({ base: e.target.value as StateBase })}>
            {STATE_BASES.map((b) => <option key={b} value={b}>{STATE_BASE_LABELS[b]}</option>)}
          </select>
        </div>
        {d.base === 'custom' && <NumericField label={`${label} custom base`} value={d.customBase} disabled={!canWrite} onChange={(v) => onChange({ customBase: v })} />}
        {!nonres && <NumericField label="Other-state credit override" value={d.creditOverride} disabled={!canWrite} onChange={(v) => onChange({ creditOverride: v })} />}
      </div>
      {nonres && (
        <div className="space-y-2">
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
    : [{ key: nextKey(), residency: 'resident', state: defaultResidentState ?? '', ratePct: '', base: 'federal_agi', customBase: '', sourcedManual: false, sourcedIncome: '', creditOverride: '', memo: '' }]);
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
            base: 'federal_agi', customBase: '', sourcedManual: false, sourcedIncome: '', creditOverride: '', memo: '' }])}>+ Add state</Button>
          <Button size="sm" disabled={!!problem} loading={saving} onClick={() => onSave(draftsToInput(drafts))}>Save states</Button>
        </div>
      )}
      {problem && <p className="text-sm text-amber-700" role="status" data-testid="state-problem">{problem}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
