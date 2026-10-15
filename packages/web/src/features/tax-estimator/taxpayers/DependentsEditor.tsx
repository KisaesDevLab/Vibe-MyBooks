// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Q44: the taxpayer's dependents (next to Persons). Ages and credits are the engine's job
// (ages at Dec 31 of each tax year); this card only edits the records. No SSN is collected.
import { useState } from 'react';
import { DEPENDENT_RELATIONSHIPS, type DependentDTO, type DependentKind, type DependentRelationship, type UpsertDependentInput } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SELECT_CLASS } from './labels';

export const DEPENDENT_KIND_LABELS: Record<DependentKind, string> = {
  qualifying_child: 'Qualifying child',
  qualifying_relative: 'Qualifying relative',
};

export const RELATIONSHIP_LABELS: Record<DependentRelationship, string> = {
  son: 'Son', daughter: 'Daughter', stepchild: 'Stepchild', foster_child: 'Foster child', grandchild: 'Grandchild', sibling: 'Brother / sister',
  niece_nephew: 'Niece / nephew', parent: 'Parent', grandparent: 'Grandparent', other_relative: 'Other relative', other: 'Other (lived with you all year)',
};

/** Age attained by Dec 31 of `year` (a birthday on Dec 31 counts). */
export function ageAtYearEnd(dob: string, year: number): number {
  return year - Number(dob.slice(0, 4));
}

/** The grouping the engine prints (care / child tax credit / other dependent). */
export function ageGroupLabel(age: number): string {
  if (age < 13) return 'Under 13';
  if (age < 17) return '13–16';
  if (age < 19) return '17–18';
  if (age < 24) return '19–23';
  return '24 or older';
}

interface Draft {
  displayName: string; dateOfBirth: string; relationship: DependentRelationship; kind: DependentKind;
  monthsLivedWith: string; isStudent: boolean; isDisabled: boolean; firstTaxYear: string; lastTaxYear: string;
}

const EMPTY: Draft = { displayName: '', dateOfBirth: '', relationship: 'son', kind: 'qualifying_child', monthsLivedWith: '', isStudent: false, isDisabled: false, firstTaxYear: '', lastTaxYear: '' };

function toDraft(d: DependentDTO): Draft {
  return {
    displayName: d.displayName, dateOfBirth: d.dateOfBirth, relationship: d.relationship, kind: d.kind,
    monthsLivedWith: d.monthsLivedWith == null ? '' : String(d.monthsLivedWith), isStudent: d.isStudent, isDisabled: d.isDisabled,
    firstTaxYear: d.firstTaxYear == null ? '' : String(d.firstTaxYear), lastTaxYear: d.lastTaxYear == null ? '' : String(d.lastTaxYear),
  };
}

function draftErrors(d: Draft, today: string): string | null {
  if (!d.displayName.trim()) return 'Enter a name.';
  if (!d.dateOfBirth) return 'Enter the date of birth.';
  if (d.dateOfBirth > today) return 'Date of birth cannot be in the future.';
  const months = d.monthsLivedWith.trim();
  if (months && (!/^\d+$/.test(months) || Number(months) > 12)) return 'Months lived with you must be 0 to 12.';
  const year = (v: string) => (v.trim() ? /^\d{4}$/.test(v.trim()) : true);
  if (!year(d.firstTaxYear) || !year(d.lastTaxYear)) return 'Tax years are four digits.';
  if (d.firstTaxYear.trim() && d.lastTaxYear.trim() && Number(d.lastTaxYear) < Number(d.firstTaxYear)) return 'The last tax year must not be before the first.';
  return null;
}

function toInput(d: Draft): UpsertDependentInput {
  const n = (v: string) => (v.trim() ? Number(v.trim()) : null);
  return {
    displayName: d.displayName.trim(), dateOfBirth: d.dateOfBirth, relationship: d.relationship, kind: d.kind,
    monthsLivedWith: n(d.monthsLivedWith), isStudent: d.isStudent, isDisabled: d.isDisabled, firstTaxYear: n(d.firstTaxYear), lastTaxYear: n(d.lastTaxYear),
  };
}

function DependentForm({ initial, saving, error, submitLabel, onSubmit, onCancel }: {
  initial: Draft; saving: boolean; error?: string; submitLabel: string;
  onSubmit: (input: UpsertDependentInput) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const today = new Date().toISOString().slice(0, 10);
  const problem = draftErrors(d, today);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3" data-testid="dependent-form">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Dependent name" value={d.displayName} onChange={(e) => set('displayName', e.target.value)} />
        <Input label="Dependent date of birth" type="date" max={today} value={d.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        <div>
          <label htmlFor="dep-kind" className="block text-sm font-medium text-gray-700 mb-1">Dependent type</label>
          <select id="dep-kind" className={SELECT_CLASS} value={d.kind} onChange={(e) => set('kind', e.target.value as DependentKind)}>
            {(Object.keys(DEPENDENT_KIND_LABELS) as DependentKind[]).map((k) => <option key={k} value={k}>{DEPENDENT_KIND_LABELS[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dep-rel" className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
          <select id="dep-rel" className={SELECT_CLASS} value={d.relationship} onChange={(e) => set('relationship', e.target.value as DependentRelationship)}>
            {DEPENDENT_RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
          </select>
        </div>
        <Input label="Months lived with taxpayer (blank = all year)" inputMode="numeric" value={d.monthsLivedWith} onChange={(e) => set('monthsLivedWith', e.target.value)} />
        <div className="flex flex-col gap-1 sm:pt-6 text-sm text-gray-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.isStudent} onChange={(e) => set('isStudent', e.target.checked)} />Full-time student</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.isDisabled} onChange={(e) => set('isDisabled', e.target.checked)} />Permanently disabled</label>
        </div>
        <Input label="First tax year counted (blank = any)" inputMode="numeric" value={d.firstTaxYear} onChange={(e) => set('firstTaxYear', e.target.value)} />
        <Input label="Last tax year counted (blank = any)" inputMode="numeric" value={d.lastTaxYear} onChange={(e) => set('lastTaxYear', e.target.value)} />
      </div>
      <p className="text-xs text-gray-500">No Social Security number is needed. The estimate works out each year&apos;s age at December 31: under 17 for the child tax credit, under 13 (or disabled) for the care credit; everyone else counts for the credit for other dependents.</p>
      {(error || (problem && d !== initial)) && <p className="text-sm text-red-600" role="alert">{error ?? problem}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!!problem} loading={saving} onClick={() => onSubmit(toInput(d))}>{submitLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/** Dependents card: list (name, age group this year, type, flags) + add / edit / remove for writers. */
export function DependentsEditor({ dependents, canWrite, saving, error, onCreate, onUpdate, onRemove }: {
  dependents: DependentDTO[]; canWrite: boolean; saving: boolean; error?: string;
  onCreate: (input: UpsertDependentInput, done: () => void) => void;
  onUpdate: (id: string, input: UpsertDependentInput, done: () => void) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const year = new Date().getFullYear();
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3" aria-label="Dependents" data-testid="dependents-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Dependents</h3>
        {canWrite && editing === null && <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>Add dependent</Button>}
      </div>
      {dependents.length === 0 && editing !== 'new' && (
        <p className="text-sm text-gray-500">No dependents. Add children and other dependents to compute the child tax credit, the credit for other dependents, the care credit and state dependent exemptions.</p>
      )}
      {dependents.length > 0 && (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 pr-3 font-medium">Name</th>
              <th className="py-1 pr-3 font-medium">Age at Dec 31, {year}</th>
              <th className="py-1 pr-3 font-medium">Type</th>
              <th className="py-1 pr-3 font-medium">Notes</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {dependents.map((d) => {
              const age = ageAtYearEnd(d.dateOfBirth, year);
              const notes = [
                d.isStudent ? 'student' : null, d.isDisabled ? 'disabled' : null,
                d.monthsLivedWith != null ? `${d.monthsLivedWith} mo. with taxpayer` : null,
                d.firstTaxYear || d.lastTaxYear ? `counts ${d.firstTaxYear ?? '…'}–${d.lastTaxYear ?? '…'}` : null,
              ].filter(Boolean).join(', ');
              return editing === d.id ? (
                <tr key={d.id}><td colSpan={5} className="py-2">
                  <DependentForm initial={toDraft(d)} saving={saving} error={error} submitLabel="Save dependent"
                    onSubmit={(input) => onUpdate(d.id, input, () => setEditing(null))} onCancel={() => setEditing(null)} />
                </td></tr>
              ) : (
                <tr key={d.id} className="border-t border-gray-100" data-testid={`dependent-${d.id}`}>
                  <td className="py-1.5 pr-3 text-gray-900">{d.displayName}<span className="ml-1 text-xs text-gray-500">({RELATIONSHIP_LABELS[d.relationship]})</span></td>
                  <td className="py-1.5 pr-3 tabular-nums">{age < 0 ? 'Not born yet' : `${age} (${ageGroupLabel(age)})`}</td>
                  <td className="py-1.5 pr-3">{DEPENDENT_KIND_LABELS[d.kind]}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{notes || '—'}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {canWrite && editing === null && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(d.id)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => onRemove(d.id)} aria-label={`Remove ${d.displayName}`}>Remove</Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {editing === 'new' && (
        <DependentForm initial={EMPTY} saving={saving} error={error} submitLabel="Add dependent"
          onSubmit={(input) => onCreate(input, () => setEditing(null))} onCancel={() => setEditing(null)} />
      )}
      {error && editing === null && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </section>
  );
}
