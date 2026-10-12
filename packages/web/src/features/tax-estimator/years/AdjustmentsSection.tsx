// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo, useState } from 'react';
import {
  ADJUSTMENT_CADENCES, allocateAdjustment, adjustmentLinkRule, ADJUSTMENT_LINK_REQUIRED_MESSAGE,
  type AdjustmentCadenceDTO, type AdjustmentDTO, type AdjustmentTypeDTO, type CreateAdjustmentInput, type LinkDTO, type PersonDTO,
} from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SELECT_CLASS } from '../taxpayers/labels';
import { AllocationStrip } from './AllocationStrip';
import { CADENCE_LABELS, FULL_MONTH_LABELS, fmtMoney, plainDecimal } from './labels';

interface Props {
  taxYear: number;
  adjustments: AdjustmentDTO[];
  total: number;
  types: AdjustmentTypeDTO[];
  persons: PersonDTO[];
  /** The taxpayer's entity links for this tax year (QA D1: business deductions attach to one). */
  links: LinkDTO[];
  canWrite: boolean;
  saving?: boolean;
  error?: string;
  onCreate: (input: CreateAdjustmentInput) => void;
  onUpdate: (id: string, input: Partial<CreateAdjustmentInput>) => void;
  onDelete: (id: string) => void;
}

interface Draft {
  adjustmentTypeId: string; label: string; amount: string; cadence: AdjustmentCadenceDTO; startMonth: number; endMonth: number;
  personId: string; linkId: string; pct: string; nonRecurring: boolean; memo: string;
}

const emptyDraft = (types: AdjustmentTypeDTO[]): Draft => ({
  adjustmentTypeId: types[0]?.id ?? '', label: '', amount: '', cadence: 'annual', startMonth: 1, endMonth: 12,
  personId: '', linkId: '', pct: '', nonRecurring: false, memo: '',
});

function draftOf(a: AdjustmentDTO): Draft {
  return {
    adjustmentTypeId: a.adjustmentTypeId, label: a.label, amount: plainDecimal(a.amount), cadence: a.cadence, startMonth: a.startMonth,
    endMonth: a.endMonth, personId: a.personId ?? '', linkId: a.linkId ?? '', pct: a.pct == null ? '' : String(a.pct), nonRecurring: a.nonRecurring, memo: a.memo ?? '',
  };
}

const AMOUNT_RE = /^-?\d+(\.\d{1,4})?$/;

/** Live allocation for the editor draft, from the same pure module the server uses. */
export function previewMonths(d: Pick<Draft, 'amount' | 'cadence' | 'startMonth' | 'endMonth'>, taxYear: number): number[] {
  const end = d.cadence === 'one_time' ? d.startMonth : Math.max(d.startMonth, d.endMonth);
  return allocateAdjustment({ amount: AMOUNT_RE.test(d.amount) ? d.amount : 0, cadence: d.cadence, startMonth: d.startMonth, endMonth: end }, taxYear);
}

/** "Carlos · Rivera Plumbing LLC (Sch C)" */
export function linkLabel(l: LinkDTO, persons: PersonDTO[]): string {
  const p = persons.find((x) => x.id === l.personId);
  return `${p ? `${p.firstName} · ` : ''}${l.companyName ?? 'Company'}${l.returnForm ? ` (${l.returnForm})` : ''}${l.outOfScope ? ' — no longer managed' : ''}`;
}

function AdjustmentEditor({ taxYear, initial, types, persons, links, glLinked, saving, onCancel, onSave }: {
  taxYear: number; initial: Draft; types: AdjustmentTypeDTO[]; persons: PersonDTO[]; links: LinkDTO[]; glLinked: boolean; saving?: boolean;
  onCancel: () => void; onSave: (d: Draft) => void;
}) {
  const [d, setD] = useState(initial);
  const set = (p: Partial<Draft>) => setD((cur) => ({ ...cur, ...p }));
  const type = types.find((t) => t.id === d.adjustmentTypeId);
  const months = useMemo(() => previewMonths(d, taxYear), [d, taxYear]);
  const amountOk = AMOUNT_RE.test(d.amount) || (glLinked && d.amount === '');
  const rangeOk = d.startMonth <= d.endMonth || d.cadence === 'one_time';
  const pctOk = d.pct === '' || (Number(d.pct) >= 0 && Number(d.pct) <= 100);
  const linkRule = type ? adjustmentLinkRule(type) : 'optional';
  const linkOk = linkRule === 'required' ? d.linkId !== '' : linkRule === 'not_allowed' ? d.linkId === '' : true;
  const valid = amountOk && rangeOk && pctOk && linkOk && !!d.adjustmentTypeId;
  return (
    <form className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 space-y-3" aria-label="Adjustment editor"
      onSubmit={(e) => { e.preventDefault(); if (valid) onSave(d); }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="adj-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select id="adj-type" className={SELECT_CLASS} value={d.adjustmentTypeId} onChange={(e) => {
            const t = types.find((x) => x.id === e.target.value);
            const clearLink = t != null && adjustmentLinkRule(t) === 'not_allowed';
            set({ adjustmentTypeId: e.target.value, pct: t?.defaultPct != null ? String(t.defaultPct) : '', nonRecurring: t?.nonRecurring ?? d.nonRecurring, ...(clearLink ? { linkId: '' } : {}) });
          }}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isShipped ? '' : ' (custom)'}</option>)}
          </select>
        </div>
        <Input label="Label" value={d.label} maxLength={200} onChange={(e) => set({ label: e.target.value })} />
        <Input label="Amount" inputMode="decimal" value={d.amount} placeholder={glLinked ? 'Run-rate from GL' : '0.00'}
          error={d.amount !== '' && !AMOUNT_RE.test(d.amount) ? 'Enter a number' : undefined} onChange={(e) => set({ amount: e.target.value })} />
        <div>
          <label htmlFor="adj-cadence" className="block text-sm font-medium text-gray-700 mb-1">Cadence</label>
          <select id="adj-cadence" className={SELECT_CLASS} value={d.cadence} onChange={(e) => set({ cadence: e.target.value as AdjustmentCadenceDTO })}>
            {ADJUSTMENT_CADENCES.map((c) => <option key={c} value={c}>{CADENCE_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="adj-start" className="block text-sm font-medium text-gray-700 mb-1">{d.cadence === 'one_time' ? 'Month' : 'Start month'}</label>
          <select id="adj-start" className={SELECT_CLASS} value={d.startMonth} onChange={(e) => set({ startMonth: Number(e.target.value) })}>
            {FULL_MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        {d.cadence !== 'one_time' && (
          <div>
            <label htmlFor="adj-end" className="block text-sm font-medium text-gray-700 mb-1">End month</label>
            <select id="adj-end" className={SELECT_CLASS} value={d.endMonth} onChange={(e) => set({ endMonth: Number(e.target.value) })}>
              {FULL_MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        {linkRule !== 'not_allowed' && (
          <div>
            <label htmlFor="adj-link" className="block text-sm font-medium text-gray-700 mb-1">
              Entity{linkRule === 'required' ? ' (required)' : ''}
            </label>
            <select id="adj-link" className={SELECT_CLASS} value={d.linkId} aria-invalid={!linkOk}
              aria-describedby={!linkOk ? 'adj-link-error' : undefined}
              onChange={(e) => {
                const l = links.find((x) => x.id === e.target.value);
                set({ linkId: e.target.value, ...(l ? { personId: l.personId } : {}) });
              }}>
              <option value="">{linkRule === 'required' ? 'Choose a business' : 'None (personal item)'}</option>
              {links.map((l) => <option key={l.id} value={l.id}>{linkLabel(l, persons)}</option>)}
            </select>
            {!linkOk && (
              <p id="adj-link-error" className="mt-1 text-sm text-red-600" role="alert">
                {links.length === 0 ? 'Link a business to this taxpayer for this year first (taxpayer page > Entity links). ' : ''}{ADJUSTMENT_LINK_REQUIRED_MESSAGE}
              </p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="adj-person" className="block text-sm font-medium text-gray-700 mb-1">Person</label>
          <select id="adj-person" className={SELECT_CLASS} value={d.personId} disabled={d.linkId !== ''}
            title={d.linkId !== '' ? 'The person comes from the entity link' : undefined} onChange={(e) => set({ personId: e.target.value })}>
            <option value="">Taxpayer / household</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </div>
        {(type?.defaultPct != null || d.pct !== '') && (
          <Input label="Percent applied" inputMode="decimal" value={d.pct} error={!pctOk ? '0 to 100' : undefined} onChange={(e) => set({ pct: e.target.value })} />
        )}
        <Input label="Memo" value={d.memo} onChange={(e) => set({ memo: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={d.nonRecurring} onChange={(e) => set({ nonRecurring: e.target.checked })} /> Non-recurring (counts once, not in the run-rate)
      </label>
      {!rangeOk && <p className="text-sm text-red-600" role="alert">End month must not be before the start month.</p>}
      <AllocationStrip months={months} />
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={saving} disabled={!valid}>Save adjustment</Button>
        <Button size="sm" variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/** Adjustments grid + editor with the live monthly allocation strip. */
export function AdjustmentsSection({ taxYear, adjustments, total, types, persons, links, canWrite, saving, error, onCreate, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<AdjustmentDTO | 'new' | null>(null);
  const typeOf = (id: string) => types.find((t) => t.id === id);
  const personName = (id: string | null) => {
    const p = persons.find((x) => x.id === id);
    return p ? p.firstName : 'Household';
  };
  const toInput = (d: Draft, gl: Pick<AdjustmentDTO, 'glLinked' | 'tenantId' | 'companyId' | 'accountId'> | null): CreateAdjustmentInput => ({
    adjustmentTypeId: d.adjustmentTypeId, label: d.label.trim(), amount: d.amount === '' ? null : d.amount, cadence: d.cadence,
    startMonth: d.startMonth, endMonth: d.cadence === 'one_time' ? d.startMonth : d.endMonth, personId: d.personId || null, linkId: d.linkId || null,
    pct: d.pct === '' ? null : Number(d.pct), nonRecurring: d.nonRecurring, memo: d.memo.trim() === '' ? null : d.memo.trim(),
    glLinked: gl?.glLinked ?? false, tenantId: gl?.tenantId ?? null, companyId: gl?.companyId ?? null, accountId: gl?.accountId ?? null,
  });

  return (
    <div className="space-y-3" aria-label="Adjustments">
      {adjustments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          No adjustments in this scenario yet. Add retirement contributions, planned purchases, capital gains or other items the books do not show.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2">Adjustment</th><th className="px-3 py-2">Person / entity</th><th className="px-3 py-2">Cadence</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Months</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{a.label || a.adjustmentTypeName}</div>
                    <div className="text-xs text-gray-500">{a.adjustmentTypeName}
                      {a.glLinked && <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-sky-800">From GL</span>}
                      {a.nonRecurring && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">Non-recurring</span>}
                      {typeOf(a.adjustmentTypeId)?.isQualifiedDividend && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5">Qualified dividend</span>}
                      {typeOf(a.adjustmentTypeId)?.isCapitalGainLt && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5">LTCG</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {personName(a.personId)}
                    {a.linkId && <div className="text-xs text-gray-500">{links.find((l) => l.id === a.linkId)?.companyName ?? 'Entity link'}</div>}
                    {!a.linkId && typeOf(a.adjustmentTypeId) && adjustmentLinkRule(typeOf(a.adjustmentTypeId)!) === 'required' && (
                      <div className="text-xs text-amber-700">No entity — treated as itemized. Edit to choose the business.</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{CADENCE_LABELS[a.cadence]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.amount == null ? 'Run-rate' : fmtMoney(a.amount)}</td>
                  <td className="px-3 py-2">{FULL_MONTH_LABELS[a.startMonth - 1]}{a.endMonth !== a.startMonth ? `–${FULL_MONTH_LABELS[a.endMonth - 1]}` : ''}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canWrite && <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(a.id)}>Delete</Button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > adjustments.length && <p className="text-xs text-gray-500">Showing the first {adjustments.length} of {total} adjustments.</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canWrite && editing === null && <Button size="sm" variant="secondary" onClick={() => setEditing('new')} disabled={types.length === 0}>+ Add adjustment</Button>}
      {editing !== null && (
        <AdjustmentEditor key={editing === 'new' ? 'new' : editing.id} taxYear={taxYear} types={types} persons={persons} links={links}
          initial={editing === 'new' ? emptyDraft(types) : draftOf(editing)} glLinked={editing !== 'new' && editing.glLinked} saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(d) => {
            if (editing === 'new') onCreate(toInput(d, null)); else onUpdate(editing.id, toInput(d, editing));
            setEditing(null);
          }} />
      )}
    </div>
  );
}
