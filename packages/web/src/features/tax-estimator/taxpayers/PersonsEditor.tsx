// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import type { PersonDTO, PersonRole, UpsertPersonInput } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MONTH_LABELS } from './labels';

const ALL_MONTHS = (): boolean[] => Array<boolean>(MONTH_LABELS.length).fill(true);

function PersonCard({ role, person, canWrite, canRemove, saving, error, onSave, onRemove }: {
  role: PersonRole; person: PersonDTO | undefined; canWrite: boolean; canRemove: boolean; saving: boolean; error?: string;
  onSave: (role: PersonRole, input: UpsertPersonInput) => void;
  onRemove: (role: PersonRole) => void;
}) {
  const [firstName, setFirstName] = useState(person?.firstName ?? '');
  const [lastName, setLastName] = useState(person?.lastName ?? '');
  const [dob, setDob] = useState(person?.dateOfBirth ?? '');
  const [blind, setBlind] = useState(person?.isBlind ?? false);
  const [months, setMonths] = useState<boolean[]>(person?.sehiEligibleMonths ?? ALL_MONTHS());
  const today = new Date().toISOString().slice(0, 10);
  const dobError = dob && dob > today ? 'Date of birth cannot be in the future' : undefined;
  const invalid = !firstName.trim() || !lastName.trim() || !!dobError;
  const title = role === 'primary' ? 'Primary taxpayer' : 'Spouse';

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3" aria-label={title} data-testid={`person-${role}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {person && canWrite && canRemove && (
          <Button variant="ghost" size="sm" onClick={() => onRemove(role)}>Remove</Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label={`${title} first name`} value={firstName} disabled={!canWrite} onChange={(e) => setFirstName(e.target.value)} />
        <Input label={`${title} last name`} value={lastName} disabled={!canWrite} onChange={(e) => setLastName(e.target.value)} />
        <Input label={`${title} date of birth`} type="date" value={dob} max={today} disabled={!canWrite}
          error={dobError} onChange={(e) => setDob(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:pt-6">
          <input type="checkbox" checked={blind} disabled={!canWrite} onChange={(e) => setBlind(e.target.checked)} />
          Legally blind
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Months eligible for self-employed health insurance</legend>
        <p className="text-xs text-gray-500 mb-2">Check each month with NO employer-subsidised plan available (SEHI is deductible only for those months).</p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2" data-testid={`sehi-grid-${role}`}>
          {MONTH_LABELS.map((m, i) => (
            <label key={m} className="flex flex-col items-center text-xs text-gray-600 gap-1">
              {m}
              <input type="checkbox" aria-label={`${title} SEHI ${m}`} checked={months[i] ?? false} disabled={!canWrite}
                onChange={(e) => setMonths((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))} />
            </label>
          ))}
        </div>
        {canWrite && (
          <div className="mt-2 flex gap-3 text-xs">
            <button type="button" className="underline text-gray-600" onClick={() => setMonths(ALL_MONTHS())}>All months</button>
            <button type="button" className="underline text-gray-600" onClick={() => setMonths(ALL_MONTHS().map(() => false))}>No months</button>
          </div>
        )}
      </fieldset>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canWrite && (
        <Button size="sm" disabled={invalid} loading={saving}
          onClick={() => onSave(role, { firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth: dob || null, isBlind: blind, sehiEligibleMonths: months })}>
          {person ? `Save ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}
        </Button>
      )}
    </section>
  );
}

/** Up to two persons: a primary, then an optional spouse. SEHI eligibility is twelve booleans per person. */
export function PersonsEditor({ persons, canWrite, saving, error, onSave, onRemove }: {
  persons: PersonDTO[]; canWrite: boolean; saving: boolean; error?: string;
  onSave: (role: PersonRole, input: UpsertPersonInput) => void;
  onRemove: (role: PersonRole) => void;
}) {
  const primary = persons.find((p) => p.role === 'primary');
  const spouse = persons.find((p) => p.role === 'spouse');
  return (
    <div className="space-y-4">
      {!primary && !canWrite && <p className="text-sm text-gray-500">No persons yet.</p>}
      <PersonCard key={`primary-${primary?.id ?? 'new'}-${primary?.firstName}`} role="primary" person={primary} canWrite={canWrite}
        canRemove={!spouse} saving={saving} error={error} onSave={onSave} onRemove={onRemove} />
      {primary && (spouse || canWrite) && (
        <PersonCard key={`spouse-${spouse?.id ?? 'new'}-${spouse?.firstName}`} role="spouse" person={spouse} canWrite={canWrite}
          canRemove saving={saving} error={error} onSave={onSave} onRemove={onRemove} />
      )}
    </div>
  );
}
