// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// R7-01: the "People" card of Annual settings — per-person outside W-2 wages, Social Security
// wages, retirement plan type and employee deferral (YearSettingsDTO.personInputs), plus the
// year-level MFS lived-apart flag (§469(i)(5)), Form 8960 allocable deductions and the
// farmer / fisherman gross-income figures. Wages from a job OUTSIDE the linked entities belong
// here, never in an adjustment: an adjustment is business income and loses the SE wage-base
// offset, the Additional Medicare wage split and the Schedule AI wage columns.
import {
  RETIREMENT_PLAN_TYPES,
  type FarmerGrossDTO, type FilingStatus, type PersonDTO, type PersonInputsDTO, type RetirementPlanTypeDTO, type YearSettingsDTO,
} from '@kis-books/shared';
import { Input } from '../../../components/ui/Input';
import { SELECT_CLASS } from '../taxpayers/labels';

type Role = PersonDTO['role'];
const ROLES: readonly Role[] = ['primary', 'spouse'];
const CENTS_RE = /^\d+(\.\d{1,2})?$/;
const FARMER_FIELDS = [['farming', 'Gross farming income'], ['fishing', 'Gross fishing income'], ['totalGross', 'Total gross income']] as const;
const FARMER_YEARS = [['current', 'This year'], ['prior', 'Prior year']] as const;

export const RETIREMENT_PLAN_LABELS: Record<RetirementPlanTypeDTO, string> = {
  sep: 'SEP-IRA', solo_401k: 'Solo 401(k)', simple: 'SIMPLE IRA', none: 'No plan',
};

/** Editable state of the card: every amount as the typed text. */
export interface PeopleDraft {
  persons: Record<string, { w2Wages: string; ssWages: string; plan: RetirementPlanTypeDTO | ''; deferral: string }>;
  mfsLivedApart: boolean;
  niiAllocable: string;
  /** key `${year}.${role}.${field}` */
  farmer: Record<string, string>;
  isFisherman: boolean;
}

const str = (n: number | string | null | undefined): string => (n == null ? '' : String(Number(n)));

export function peopleDraftFromYear(y: YearSettingsDTO): PeopleDraft {
  const pi: PersonInputsDTO = y.personInputs ?? {};
  const persons: PeopleDraft['persons'] = {};
  for (const role of ROLES) {
    const p = pi[role] ?? {};
    persons[role] = { w2Wages: str(p.w2Wages), ssWages: str(p.w2SocialSecurityWages), plan: p.retirementPlanType ?? '', deferral: str(p.employeeDeferral) };
  }
  const farmer: Record<string, string> = {};
  const fg: FarmerGrossDTO = y.farmerGross ?? {};
  for (const [yr] of FARMER_YEARS) for (const role of ROLES) for (const [f] of FARMER_FIELDS) farmer[`${yr}.${role}.${f}`] = str(fg[yr]?.[role]?.[f]);
  return { persons, mfsLivedApart: y.mfsLivedApartAllYear ?? false, niiAllocable: y.niiAllocableDeductions == null ? '' : str(y.niiAllocableDeductions), farmer, isFisherman: y.isFisherman ?? false };
}

const bad = (s: string) => s.trim() !== '' && !CENTS_RE.test(s.trim());
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim()));

export function peopleDraftInvalid(d: PeopleDraft): boolean {
  return Object.values(d.persons).some((p) => bad(p.w2Wages) || bad(p.ssWages) || bad(p.deferral))
    || bad(d.niiAllocable) || Object.values(d.farmer).some(bad);
}

/** The upsertYear fields this card owns. Only roles that exist are sent; blank = not entered (null / omitted). */
export function peoplePayload(d: PeopleDraft, roles: readonly Role[]) {
  const personInputs: PersonInputsDTO = {};
  for (const role of roles) {
    const p = d.persons[role];
    if (!p) continue;
    const plan = p.plan === '' ? null : p.plan;
    personInputs[role] = {
      w2Wages: numOrNull(p.w2Wages), w2SocialSecurityWages: numOrNull(p.ssWages), retirementPlanType: plan,
      // A deferral only means something for a plan with elective deferrals.
      employeeDeferral: plan === 'solo_401k' || plan === 'simple' ? numOrNull(p.deferral) : null,
    };
  }
  const farmerGross: FarmerGrossDTO = {};
  for (const [yr] of FARMER_YEARS) for (const role of roles) for (const [f] of FARMER_FIELDS) {
    const v = numOrNull(d.farmer[`${yr}.${role}.${f}`] ?? '');
    if (v == null) continue;
    const year = (farmerGross[yr] ??= {});
    (year[role] ??= {})[f] = v;
  }
  return {
    personInputs, mfsLivedApartAllYear: d.mfsLivedApart,
    niiAllocableDeductions: d.niiAllocable.trim() === '' ? null : d.niiAllocable.trim(),
    farmerGross, isFisherman: d.isFisherman,
  };
}

export function PeopleCard({ draft, onChange, persons, filingStatus, canWrite }: {
  draft: PeopleDraft;
  onChange: (d: PeopleDraft) => void;
  persons: PersonDTO[];
  filingStatus?: FilingStatus;
  canWrite: boolean;
}) {
  const setPerson = (role: Role, patch: Partial<PeopleDraft['persons'][string]>) =>
    onChange({ ...draft, persons: { ...draft.persons, [role]: { ...draft.persons[role]!, ...patch } } });
  const farmerHasData = Object.values(draft.farmer).some((v) => v.trim() !== '') || draft.isFisherman;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3" aria-label="People">
      <h3 className="text-sm font-semibold text-gray-900">People</h3>
      <p className="text-xs text-gray-500">
        Wages from a job outside the linked businesses go here, not in an adjustment. Officer wages from a linked S corporation come from its books.
      </p>
      {persons.length === 0 && <p className="text-xs text-gray-500">Add the taxpayer&apos;s people first to enter wages and retirement plans.</p>}
      {persons.map((p) => {
        const d = draft.persons[p.role]!;
        const deferralPlan = d.plan === 'solo_401k' || d.plan === 'simple';
        return (
          <fieldset key={p.id} className="space-y-2 border-t border-gray-100 pt-3 first-of-type:border-0 first-of-type:pt-0" aria-label={`${p.firstName} ${p.lastName}`}>
            <legend className="text-sm font-medium text-gray-800">{p.firstName} {p.lastName}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input label={`${p.firstName} — W-2 wages (box 1)`} inputMode="decimal" value={d.w2Wages} disabled={!canWrite}
                error={bad(d.w2Wages) ? 'Enter an amount' : undefined} onChange={(e) => setPerson(p.role, { w2Wages: e.target.value })} />
              <Input label={`${p.firstName} — Social Security wages (box 3)`} inputMode="decimal" value={d.ssWages} disabled={!canWrite}
                placeholder="Same as box 1" error={bad(d.ssWages) ? 'Enter an amount' : undefined}
                onChange={(e) => setPerson(p.role, { ssWages: e.target.value })} />
              <div>
                <label htmlFor={`plan-${p.role}`} className="block text-sm font-medium text-gray-700 mb-1">{p.firstName} — retirement plan</label>
                <select id={`plan-${p.role}`} className={SELECT_CLASS} value={d.plan} disabled={!canWrite}
                  onChange={(e) => setPerson(p.role, { plan: e.target.value as RetirementPlanTypeDTO | '' })}>
                  <option value="">Not recorded (SEP assumed)</option>
                  {RETIREMENT_PLAN_TYPES.map((t) => <option key={t} value={t}>{RETIREMENT_PLAN_LABELS[t]}</option>)}
                </select>
              </div>
              {deferralPlan && (
                <Input label={`${p.firstName} — employee deferral`} inputMode="decimal" value={d.deferral} disabled={!canWrite}
                  placeholder="Maximum assumed" error={bad(d.deferral) ? 'Enter an amount' : undefined}
                  onChange={(e) => setPerson(p.role, { deferral: e.target.value })} />
              )}
            </div>
            <p className="text-xs text-gray-500">
              Box 3 is usually higher than box 1 when there are 401(k) deferrals; leave it blank to use box 1 (SE tax may then be overstated).
              {deferralPlan && ' The employee deferral is the elective part of the owner contributions; blank assumes the maximum deferral was made.'}
            </p>
          </fieldset>
        );
      })}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3">
        <Input label="Deductions allocable to investment income (Form 8960)" inputMode="decimal" value={draft.niiAllocable} disabled={!canWrite}
          error={bad(draft.niiAllocable) ? 'Enter an amount' : undefined} onChange={(e) => onChange({ ...draft, niiAllocable: e.target.value })} />
        {filingStatus === 'mfs' && (
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:mt-6">
            <input type="checkbox" checked={draft.mfsLivedApart} disabled={!canWrite} onChange={(e) => onChange({ ...draft, mfsLivedApart: e.target.checked })} />
            Lived apart from spouse all year (rental loss allowance)
          </label>
        )}
      </div>
      <details className="border-t border-gray-100 pt-3" open={farmerHasData}>
        <summary className="text-sm font-medium text-gray-700 cursor-pointer">Farmer / fisherman gross-income test</summary>
        <p className="text-xs text-gray-500 mt-1">Only for a farmer or fisherman. Figures entered here replace the books for that year&apos;s two-thirds test.</p>
        <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
          <input type="checkbox" id="farmer-is-fisherman" aria-label="Label as a fisherman (same rules)" checked={draft.isFisherman} disabled={!canWrite} onChange={(e) => onChange({ ...draft, isFisherman: e.target.checked })} />
          Label as a fisherman (same rules)
        </label>
        {FARMER_YEARS.map(([yr, yrLabel]) => persons.map((p) => (
          <div key={`${yr}.${p.role}`} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {FARMER_FIELDS.map(([f, label]) => {
              const k = `${yr}.${p.role}.${f}`;
              return (
                <Input key={k} id={`farmer-${k.replace(/\./g, '-')}`} label={`${yrLabel} — ${p.firstName} — ${label}`} aria-label={`${yrLabel} — ${p.firstName} — ${label}`}
                  inputMode="decimal" value={draft.farmer[k] ?? ''} disabled={!canWrite}
                  error={bad(draft.farmer[k] ?? '') ? 'Enter an amount' : undefined}
                  onChange={(e) => onChange({ ...draft, farmer: { ...draft.farmer, [k]: e.target.value } })} />
              );
            })}
          </div>
        )))}
      </details>
    </section>
  );
}
