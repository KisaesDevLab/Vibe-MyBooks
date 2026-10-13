// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Q45: businesses OUTSIDE MyBooks (next to Entity links). The definition (type, owner, %, activity,
// QBI / SSTB, state sourcing) carries forward; the amounts are entered per tax year with their own
// entry mode (full year / year to date), amount basis (entity total / owner's share, e.g. a K-1)
// and through month. Every figure is computed by the engine; this card only edits the records.
import { useState } from 'react';
import {
  ACTIVITY_TYPES, ENTITY_TAX_TYPES, INCOME_CHARACTERS, OUTSIDE_AMOUNT_BASES, OUTSIDE_ENTRY_MODES,
  type ActivityType, type EntityTaxType, type IncomeCharacter, type OutsideAmountBasis, type OutsideEntityDTO, type OutsideEntryMode,
  type PartnerSeStatus, type PersonDTO, type PersonRole, type UpsertOutsideEntityInput, type UpsertOutsideEntityYearInput,
} from '@kis-books/shared';
import {
  useOutsideEntities, useSaveOutsideEntity, useRemoveOutsideEntity, useSaveOutsideEntityYear, useRemoveOutsideEntityYear,
} from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { StateSelect } from './StateSelect';
import { ACTIVITY_LABELS, MONTH_LABELS, SE_STATUS_LABELS, SELECT_CLASS } from './labels';
import { NumericField } from '../../../components/forms/NumericField';

export const OUTSIDE_TYPE_LABELS: Record<EntityTaxType, string> = {
  sch_c: 'Schedule C (sole proprietor)', sch_f: 'Schedule F (farm)', s_corp: 'S corporation', partnership: 'Partnership', c_corp: 'C corporation',
};
export const ENTRY_MODE_LABELS: Record<OutsideEntryMode, string> = {
  full_year: 'Full-year projection (used as entered)', ytd: 'Year to date (projected like the books)',
};
export const BASIS_LABELS: Record<OutsideAmountBasis, string> = {
  entity_total: 'Entity total (100%, allocated by the owner %)', owner_share: "Owner's share (e.g. K-1; % is informational)",
};
export const CHARACTER_LABELS: Record<IncomeCharacter, string> = {
  ordinary: 'Ordinary income / (loss)', rental: 'Rental income / (loss)', interest: 'Interest', dividends_ordinary: 'Ordinary dividends (non-qualified)',
  dividends_qualified: 'Qualified dividends', capital_gain_st: 'Short-term capital gain / (loss)', capital_gain_lt: 'Long-term capital gain / (loss)', section_1231: 'Section 1231 gain / (loss)',
};

const DEFAULT_YEAR = new Date().getFullYear();
const YEAR_SPAN = 3;
const MONEY = /^-?\d+(\.\d{1,4})?$/;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const parsePct = (s: string): number | null => (s.trim() === '' ? null : Number(s));

// ── Definition form ──────────────────────────────────────────────────

interface DefDraft {
  name: string; entityType: EntityTaxType; personRole: PersonRole; profitPct: string; lossPct: string; partnerSeStatus: PartnerSeStatus | '';
  isOfficer: boolean; activityType: ActivityType; activeParticipation: boolean; qbi: 'default' | 'yes' | 'no'; isSstb: boolean;
  rentalQbiTradeOrBusiness: boolean; stateSourcing: string;
}

function defDraft(d: OutsideEntityDTO | null, persons: PersonDTO[]): DefDraft {
  return {
    name: d?.name ?? '', entityType: d?.entityType ?? 'partnership', personRole: d?.personRole ?? persons[0]?.role ?? 'primary',
    profitPct: d?.profitPct != null ? String(d.profitPct) : '', lossPct: d?.lossPct != null ? String(d.lossPct) : '', partnerSeStatus: d?.partnerSeStatus ?? '',
    isOfficer: d?.isOfficer ?? false, activityType: d?.activityType ?? 'active', activeParticipation: d?.activeParticipation ?? false,
    qbi: d?.qbiEligible == null ? 'default' : d.qbiEligible ? 'yes' : 'no', isSstb: d?.isSstb ?? false, rentalQbiTradeOrBusiness: d?.rentalQbiTradeOrBusiness ?? false,
    stateSourcing: d?.stateSourcing ?? '',
  };
}

export function OutsideEntityForm({ initial, persons, saving, error, onSave, onCancel }: {
  initial: OutsideEntityDTO | null; persons: PersonDTO[]; saving: boolean; error?: string;
  onSave: (input: UpsertOutsideEntityInput) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<DefDraft>(() => defDraft(initial, persons));
  const set = <K extends keyof DefDraft>(k: K, v: DefDraft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const pctInvalid = [d.profitPct, d.lossPct].some((v) => v.trim() !== '' && !(Number(v) >= 0 && Number(v) <= 100));
  const blocked = !d.name.trim() || pctInvalid;
  const submit = () => onSave({
    name: d.name.trim(), entityType: d.entityType, personRole: d.personRole, profitPct: parsePct(d.profitPct), lossPct: parsePct(d.lossPct),
    partnerSeStatus: d.entityType === 'partnership' && d.partnerSeStatus ? d.partnerSeStatus : null,
    isOfficer: d.entityType === 's_corp' && d.isOfficer, activityType: d.activityType,
    activeParticipation: d.activityType === 'rental' && d.activeParticipation, qbiEligible: d.qbi === 'default' ? null : d.qbi === 'yes',
    isSstb: d.isSstb, rentalQbiTradeOrBusiness: d.rentalQbiTradeOrBusiness, stateSourcing: d.stateSourcing === '' ? null : d.stateSourcing,
  });
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 space-y-3" role="form" aria-label={initial ? 'Edit outside business' : 'Add outside business'}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Business name" value={d.name} onChange={(e) => set('name', e.target.value)} />
        <div>
          <label htmlFor="ob-type" className="block text-sm font-medium text-gray-700 mb-1">Entity type</label>
          <select id="ob-type" className={SELECT_CLASS} value={d.entityType} onChange={(e) => set('entityType', e.target.value as EntityTaxType)}>
            {ENTITY_TAX_TYPES.map((t) => <option key={t} value={t}>{OUTSIDE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ob-person" className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
          <select id="ob-person" className={SELECT_CLASS} value={d.personRole} onChange={(e) => set('personRole', e.target.value as PersonRole)}>
            {persons.map((p) => <option key={p.role} value={p.role}>{p.firstName} {p.lastName} ({p.role})</option>)}
          </select>
        </div>
        <NumericField label="Profit %" min={0} max={100} decimals={4} value={d.profitPct} onChange={(v) => set('profitPct', v)} />
        <NumericField label="Loss % (blank = profit %)" min={0} max={100} decimals={4} value={d.lossPct} onChange={(v) => set('lossPct', v)} />
        <div>
          <label htmlFor="ob-activity" className="block text-sm font-medium text-gray-700 mb-1">Activity type</label>
          <select id="ob-activity" className={SELECT_CLASS} value={d.activityType} onChange={(e) => set('activityType', e.target.value as ActivityType)}>
            {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
          </select>
        </div>
        {d.entityType === 'partnership' && (
          <div>
            <label htmlFor="ob-se" className="block text-sm font-medium text-gray-700 mb-1">Partner SE status</label>
            <select id="ob-se" className={SELECT_CLASS} value={d.partnerSeStatus} onChange={(e) => set('partnerSeStatus', e.target.value as PartnerSeStatus | '')}>
              <option value="">Not set (treated as general)</option>
              {(Object.keys(SE_STATUS_LABELS) as PartnerSeStatus[]).map((s) => <option key={s} value={s}>{SE_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="ob-qbi" className="block text-sm font-medium text-gray-700 mb-1">QBI eligibility</label>
          <select id="ob-qbi" className={SELECT_CLASS} value={d.qbi} onChange={(e) => set('qbi', e.target.value as DefDraft['qbi'])}>
            <option value="default">Default for this activity</option>
            <option value="yes">Eligible</option>
            <option value="no">Not eligible</option>
          </select>
        </div>
        <StateSelect id="ob-state" label="Income sourced to state (nonresident rows)" value={d.stateSourcing} onChange={(v) => set('stateSourcing', v)} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
        {d.activityType === 'rental' && <label className="flex items-center gap-2"><input type="checkbox" checked={d.activeParticipation} onChange={(e) => set('activeParticipation', e.target.checked)} />Active participation (&sect;469(i) allowance)</label>}
        {d.entityType === 's_corp' && <label className="flex items-center gap-2"><input type="checkbox" checked={d.isOfficer} onChange={(e) => set('isOfficer', e.target.checked)} />Officer (W-2 wages)</label>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.isSstb} onChange={(e) => set('isSstb', e.target.checked)} />Specified service business (SSTB)</label>
        {d.activityType === 'rental' && <label className="flex items-center gap-2"><input type="checkbox" checked={d.rentalQbiTradeOrBusiness} onChange={(e) => set('rentalQbiTradeOrBusiness', e.target.checked)} />Rental is a &sect;162 trade or business (QBI)</label>}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={blocked} loading={saving} onClick={submit}>{initial ? 'Save business' : 'Add business'}</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Year amounts form ────────────────────────────────────────────────

type MoneyField = 'guaranteedPayments' | 'officerWages' | 'ownerSehi' | 'ownerRetirement' | 'sehiAsW2Wages' | 'w2Wages' | 'ubia' | 'allowedLossOverride';
interface YearDraft {
  entryMode: OutsideEntryMode; amountBasis: OutsideAmountBasis; throughMonth: string; includeSehiInW2Wages: boolean;
  amounts: Record<IncomeCharacter, string>; money: Record<MoneyField, string>;
}
const OPTIONAL_MONEY: ReadonlySet<MoneyField> = new Set(['w2Wages', 'ubia', 'allowedLossOverride']);

function yearDraft(e: OutsideEntityDTO): YearDraft {
  const y = e.year;
  const amt = (v: string | undefined) => (v == null || Number(v) === 0 ? '' : v);
  return {
    entryMode: y?.entryMode ?? 'full_year', amountBasis: y?.amountBasis ?? 'owner_share', throughMonth: y?.throughMonth != null ? String(y.throughMonth) : '',
    includeSehiInW2Wages: y?.includeSehiInW2Wages ?? false,
    amounts: Object.fromEntries(INCOME_CHARACTERS.map((k) => [k, amt(y?.amounts[k])])) as Record<IncomeCharacter, string>,
    money: {
      guaranteedPayments: amt(y?.guaranteedPayments), officerWages: amt(y?.officerWages), ownerSehi: amt(y?.ownerSehi), ownerRetirement: amt(y?.ownerRetirement),
      sehiAsW2Wages: amt(y?.sehiAsW2Wages), w2Wages: y?.w2Wages ?? '', ubia: y?.ubia ?? '', allowedLossOverride: y?.allowedLossOverride ?? '',
    },
  };
}

/** Problems that block saving (null = fine). Exported for the tests. */
export function yearDraftProblem(d: YearDraft): string | null {
  if (d.entryMode === 'ytd' && d.throughMonth === '') return 'Pick the month the year-to-date amounts run through.';
  for (const v of Object.values(d.amounts)) if (v.trim() !== '' && !MONEY.test(v.trim())) return 'Amounts are numbers (a loss is negative).';
  for (const [k, v] of Object.entries(d.money)) {
    if (v.trim() === '') continue;
    if (!MONEY.test(v.trim()) || Number(v) < 0) return `${k === 'allowedLossOverride' ? 'The allowed-loss override' : 'Owner items, W-2 wages and UBIA'} must be positive numbers.`;
  }
  return null;
}

export function OutsideYearForm({ entity, taxYear, saving, error, onSave, onCancel }: {
  entity: OutsideEntityDTO; taxYear: number; saving: boolean; error?: string;
  onSave: (input: UpsertOutsideEntityYearInput) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<YearDraft>(() => yearDraft(entity));
  const t = entity.entityType;
  const ccorp = t === 'c_corp';
  const problem = yearDraftProblem(d);
  const setAmt = (k: IncomeCharacter, v: string) => setD((cur) => ({ ...cur, amounts: { ...cur.amounts, [k]: v } }));
  const setMoney = (k: MoneyField, v: string) => setD((cur) => ({ ...cur, money: { ...cur.money, [k]: v } }));
  const m = (k: MoneyField) => (d.money[k].trim() === '' ? (OPTIONAL_MONEY.has(k) ? null : '0') : d.money[k].trim());
  const submit = () => onSave({
    entryMode: d.entryMode, amountBasis: ccorp ? 'entity_total' : d.amountBasis, throughMonth: d.entryMode === 'ytd' ? Number(d.throughMonth) : null,
    amounts: Object.fromEntries(INCOME_CHARACTERS.map((k) => [k, d.amounts[k].trim() === '' ? '0' : d.amounts[k].trim()])) as UpsertOutsideEntityYearInput['amounts'],
    guaranteedPayments: t === 'partnership' ? m('guaranteedPayments')! : '0',
    officerWages: t === 's_corp' ? m('officerWages')! : '0', sehiAsW2Wages: t === 's_corp' ? m('sehiAsW2Wages')! : '0',
    ownerSehi: ccorp ? '0' : m('ownerSehi')!, ownerRetirement: ccorp ? '0' : m('ownerRetirement')!,
    w2Wages: ccorp ? null : m('w2Wages'), ubia: ccorp ? null : m('ubia'), includeSehiInW2Wages: t === 's_corp' && d.includeSehiInW2Wages,
    allowedLossOverride: ccorp ? null : m('allowedLossOverride'),
  });
  const moneyInput = (k: MoneyField, label: string) => <NumericField key={k} label={label} value={d.money[k]} onChange={(v) => setMoney(k, v)} />;
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 space-y-3" role="form" aria-label={`${entity.name} ${taxYear} amounts`}>
      <p className="text-sm font-medium text-gray-900">{entity.name} &mdash; {taxYear} amounts</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="oy-mode" className="block text-sm font-medium text-gray-700 mb-1">Entry mode</label>
          <select id="oy-mode" className={SELECT_CLASS} value={d.entryMode} onChange={(e) => setD((cur) => ({ ...cur, entryMode: e.target.value as OutsideEntryMode }))}>
            {OUTSIDE_ENTRY_MODES.map((x) => <option key={x} value={x}>{ENTRY_MODE_LABELS[x]}</option>)}
          </select>
        </div>
        {d.entryMode === 'ytd' && (
          <div>
            <label htmlFor="oy-through" className="block text-sm font-medium text-gray-700 mb-1">Year to date through</label>
            <select id="oy-through" className={SELECT_CLASS} value={d.throughMonth} onChange={(e) => setD((cur) => ({ ...cur, throughMonth: e.target.value }))}>
              <option value="">Pick a month</option>
              {MONTH_LABELS.map((label, i) => <option key={label} value={String(i + 1)}>{label} {taxYear}</option>)}
            </select>
          </div>
        )}
        {!ccorp && (
          <div>
            <label htmlFor="oy-basis" className="block text-sm font-medium text-gray-700 mb-1">Amounts are</label>
            <select id="oy-basis" className={SELECT_CLASS} value={d.amountBasis} onChange={(e) => setD((cur) => ({ ...cur, amountBasis: e.target.value as OutsideAmountBasis }))}>
              {OUTSIDE_AMOUNT_BASES.map((x) => <option key={x} value={x}>{BASIS_LABELS[x]}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {d.entryMode === 'full_year'
          ? 'Full-year figures are used as entered. For the annualized-income installment method they are spread evenly by month.'
          : 'Year-to-date figures are projected to December like a linked business (every amount treated as recurring).'}
        {ccorp ? ' A C corporation is estimated at the entity level on its taxable income (enter it as ordinary income); it is not in the individual totals.' : ''}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {INCOME_CHARACTERS.map((k) => <NumericField key={k} label={CHARACTER_LABELS[k]} value={d.amounts[k]} onChange={(v) => setAmt(k, v)} />)}
      </div>
      {!ccorp && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {t === 'partnership' && moneyInput('guaranteedPayments', 'Guaranteed payments to the owner')}
          {t === 's_corp' && moneyInput('officerWages', 'Officer W-2 wages (owner)')}
          {t === 's_corp' && moneyInput('sehiAsW2Wages', '>2% shareholder health in W-2 box 1')}
          {moneyInput('ownerSehi', 'Owner health insurance (SEHI)')}
          {t !== 's_corp' && moneyInput('ownerRetirement', 'Owner retirement contributions')}
          {moneyInput('w2Wages', 'W-2 wages for QBI (full year)')}
          {moneyInput('ubia', 'UBIA of qualified property')}
          {moneyInput('allowedLossOverride', 'Allowed loss override (basis / at-risk)')}
        </div>
      )}
      {t === 's_corp' && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={d.includeSehiInW2Wages} onChange={(e) => setD((cur) => ({ ...cur, includeSehiInW2Wages: e.target.checked }))} />
          Count the &gt;2% shareholder health add-on as &sect;199A W-2 wages
        </label>
      )}
      {(error || problem) && <p className="text-sm text-red-600" role="alert">{error ?? problem}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!!problem} loading={saving} onClick={submit}>Save {taxYear} amounts</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────

/** One-line summary of a year's entry ("Full year · K-1 share · net $75,000"). */
export function yearSummary(e: OutsideEntityDTO): string {
  const y = e.year;
  if (!y) return 'No amounts entered';
  const net = INCOME_CHARACTERS.reduce((a, k) => a + Number(y.amounts[k] ?? 0), 0);
  const mode = y.entryMode === 'ytd' ? `YTD through ${MONTH_LABELS[(y.throughMonth ?? 12) - 1]}` : 'Full year';
  const basis = e.entityType === 'c_corp' ? 'entity level' : y.amountBasis === 'owner_share' ? "owner's share" : 'entity total';
  return `${mode} · ${basis} · net ${usd(net)}`;
}

type Editing = { kind: 'def'; entity: OutsideEntityDTO | null } | { kind: 'year'; entity: OutsideEntityDTO } | null;

/** Pure view (tested): the table and the two forms. */
export function OutsideBusinessesView({ entities, persons, taxYear, canWrite, saving, error, onSaveDef, onRemove, onSaveYear, onRemoveYear }: {
  entities: OutsideEntityDTO[]; persons: PersonDTO[]; taxYear: number; canWrite: boolean; saving: boolean; error?: string;
  onSaveDef: (id: string | null, input: UpsertOutsideEntityInput, done: () => void) => void;
  onRemove: (id: string) => void;
  onSaveYear: (id: string, input: UpsertOutsideEntityYearInput, done: () => void) => void;
  onRemoveYear: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  return (
    <div className="space-y-3">
      {canWrite && persons.length > 0 && editing === null && <Button size="sm" onClick={() => setEditing({ kind: 'def', entity: null })}>Add outside business</Button>}
      {canWrite && persons.length === 0 && <p className="text-sm text-gray-500">Add a person above before adding a business.</p>}
      {editing?.kind === 'def' && (
        <OutsideEntityForm initial={editing.entity} persons={persons} saving={saving} error={error} onCancel={close}
          onSave={(input) => onSaveDef(editing.entity?.id ?? null, input, close)} />
      )}
      {editing?.kind === 'year' && (
        <OutsideYearForm entity={editing.entity} taxYear={taxYear} saving={saving} error={error} onCancel={close}
          onSave={(input) => onSaveYear(editing.entity.id, input, close)} />
      )}
      {entities.length === 0
        ? <p className="text-sm text-gray-500 py-6 text-center border border-dashed rounded-lg">No outside businesses. Add K-1s and businesses whose books are not in MyBooks; their income or loss then counts in the estimate like a linked company.</p>
        : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Business</th><th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-right">Profit</th><th className="px-3 py-2 text-right">Loss</th>
                  <th className="px-3 py-2 text-left">Activity</th><th className="px-3 py-2 text-left">{taxYear} amounts</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr key={e.id} className="border-b last:border-0" data-testid="outside-row">
                    <td className="px-3 py-2">
                      <span className="text-gray-900">{e.name}</span>
                      <span className="block text-xs text-gray-500">{OUTSIDE_TYPE_LABELS[e.entityType]} &middot; Outside MyBooks &middot; entered</span>
                    </td>
                    <td className="px-3 py-2 capitalize">{e.personRole}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.profitPct == null ? '—' : `${e.profitPct}%`}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.lossPct == null ? '—' : `${e.lossPct}%`}</td>
                    <td className="px-3 py-2">{ACTIVITY_LABELS[e.activityType]}{e.partnerSeStatus ? `, ${SE_STATUS_LABELS[e.partnerSeStatus]}` : ''}</td>
                    <td className={`px-3 py-2 ${e.year ? 'text-gray-800' : 'text-amber-700'}`}>{yearSummary(e)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {canWrite && editing === null && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: 'year', entity: e })} aria-label={`${e.year ? 'Edit' : 'Enter'} ${taxYear} amounts for ${e.name}`}>{e.year ? 'Edit amounts' : 'Enter amounts'}</Button>
                          {e.year && <Button variant="ghost" size="sm" onClick={() => onRemoveYear(e.id)} aria-label={`Clear ${taxYear} amounts for ${e.name}`}>Clear {taxYear}</Button>}
                          <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: 'def', entity: e })} aria-label={`Edit ${e.name}`}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => onRemove(e.id)} aria-label={`Remove ${e.name}`}>Remove</Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {error && editing === null && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

/** Outside businesses card (taxpayer page, next to Entity links), one tax year at a time. */
export function OutsideBusinessesSection({ taxpayerId, persons, canWrite }: { taxpayerId: string; persons: PersonDTO[]; canWrite: boolean }) {
  const [taxYear, setTaxYear] = useState(DEFAULT_YEAR);
  const { data, isLoading, isError, refetch } = useOutsideEntities(taxpayerId, taxYear);
  const saveDef = useSaveOutsideEntity(taxpayerId);
  const remove = useRemoveOutsideEntity(taxpayerId);
  const saveYear = useSaveOutsideEntityYear(taxpayerId);
  const removeYear = useRemoveOutsideEntityYear(taxpayerId);
  const years = Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => DEFAULT_YEAR - YEAR_SPAN + i);
  const failed = [saveDef, remove, saveYear, removeYear].find((m) => m.isError)?.error;
  return (
    <section className="space-y-3" aria-label="Outside businesses">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Outside businesses</h2>
        <label className="text-sm text-gray-600 flex items-center gap-1">
          Tax year
          <select aria-label="Outside businesses tax year" value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-500">Businesses whose books are not in MyBooks (K-1s, a spouse&apos;s practice, &hellip;). The business carries forward; enter its amounts for each tax year.</p>
      {isLoading ? <LoadingSpinner className="py-8" />
        : isError ? <ErrorMessage message="Could not load outside businesses." onRetry={() => refetch()} />
        : (
          <OutsideBusinessesView key={taxYear} entities={data?.data ?? []} persons={persons} taxYear={taxYear} canWrite={canWrite}
            saving={saveDef.isPending || remove.isPending || saveYear.isPending || removeYear.isPending}
            error={failed ? errMsg(failed) : undefined}
            onSaveDef={(id, input, done) => saveDef.mutate({ id, input }, { onSuccess: done })}
            onRemove={(id) => remove.mutate(id)}
            onSaveYear={(id, input, done) => saveYear.mutate({ id, taxYear, input }, { onSuccess: done })}
            onRemoveYear={(id) => removeYear.mutate({ id, taxYear })} />
        )}
    </section>
  );
}
