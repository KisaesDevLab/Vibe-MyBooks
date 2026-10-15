// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useEffect, useState } from 'react';
import type { FilingStatus, PersonDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { SCH1A_FIELDS } from './labels';
import { NumericField } from '../../../components/forms/NumericField';

/** Draft values keyed `${role}.${field}` (strings as typed). */
export type Sch1aDraft = Record<string, string>;

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
export const sch1aAmountBad = (s: string | undefined): boolean => !!s && s.trim() !== '' && !AMOUNT_RE.test(s.trim());

/** Calendar-year age test on the birth year — display only; the engine applies `sch1a.senior.age` itself. */
export const seniorByYearEnd = (dob: string | null, taxYear: number): boolean => !!dob && taxYear - Number(dob.slice(0, 4)) >= 65;

export const SCH1A_MFS_NOTICE = 'Schedule 1-A deductions are not allowed when married filing separately; the estimate ignores these amounts while the filing status is MFS.';

interface Props {
  open: boolean;
  taxYear: number;
  filingStatus?: FilingStatus;
  persons: PersonDTO[];
  canWrite: boolean;
  values: Sch1aDraft;
  onApply: (values: Sch1aDraft) => void;
  onCancel: () => void;
}

/**
 * UI-SPEC §02 "Schedule 1-A chips per type, opening per-person inputs" — the
 * per-person entry dialog. The senior deduction has no input: it follows the
 * person's date of birth (People). Applying updates the form draft; the year is
 * saved with "Save annual settings".
 */
export function Sch1aDialog({ open, taxYear, filingStatus, persons, canWrite, values, onApply, onCancel }: Props) {
  const [draft, setDraft] = useState<Sch1aDraft>(values);
  // Re-seed only when the dialog opens, so a parent re-render never wipes what is being typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setDraft(values); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  const invalid = Object.values(draft).some(sch1aAmountBad);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Schedule 1-A" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Schedule 1-A &middot; {taxYear}</h2>
          <p className="text-sm text-gray-600">Senior, qualified tips, qualified overtime and car-loan interest deductions, per person. They apply on top of the standard or itemized deduction, with the phase-outs from the tax parameters.</p>
        </div>
        {filingStatus === 'mfs' && (
          <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{SCH1A_MFS_NOTICE}</p>
        )}
        {persons.length === 0 ? (
          <p className="text-sm text-gray-500">Add the taxpayer&apos;s people first to enter per-person Schedule 1-A amounts.</p>
        ) : (
          persons.map((p) => (
            <fieldset key={p.id} className="rounded-md border border-gray-200 p-3 space-y-2">
              <legend className="px-1 text-sm font-medium text-gray-800">{p.firstName} {p.lastName}</legend>
              <p className="text-xs text-gray-600" data-testid={`senior-${p.role}`}>
                Senior deduction: {p.dateOfBirth == null
                  ? 'no date of birth recorded (add it under People)'
                  : seniorByYearEnd(p.dateOfBirth, taxYear) ? `65 or older at the end of ${taxYear} — applied automatically` : `Under 65 at the end of ${taxYear}`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SCH1A_FIELDS.map(([k, label]) => {
                  const key = `${p.role}.${k}`;
                  return (
                    <NumericField key={k} label={`${p.firstName} — ${label}`} value={draft[key] ?? ''} disabled={!canWrite}
                      error={sch1aAmountBad(draft[key]) ? 'Enter an amount' : undefined}
                      onChange={(v) => setDraft((cur) => ({ ...cur, [key]: v }))} />
                  );
                })}
              </div>
            </fieldset>
          ))
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>{canWrite && persons.length > 0 ? 'Cancel' : 'Close'}</Button>
          {canWrite && persons.length > 0 && <Button disabled={invalid} onClick={() => onApply(draft)}>Apply</Button>}
        </div>
      </div>
    </div>
  );
}
