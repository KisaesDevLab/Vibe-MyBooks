// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { EntityYearInputsDto, UpsertEntityYearInputsInput } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { formatMoney } from '../../../utils/money';

const MONEY_RE = /^\d{1,15}(\.\d{1,4})?$/;

/** Per-year QBI inputs (D8): computed W-2 wages with an override that needs a reason, and manual UBIA. */
export function YearInputsPanel({ taxYear, inputs, booksW2Wages, canWrite, saving, error, onSave }: {
  taxYear: number; inputs: EntityYearInputsDto; booksW2Wages: string | null; canWrite: boolean; saving: boolean; error?: string;
  onSave: (input: UpsertEntityYearInputsInput) => void;
}) {
  const [override, setOverride] = useState(inputs.w2WagesOverride ?? '');
  const [reason, setReason] = useState(inputs.w2WagesOverrideReason ?? '');
  const [ubia, setUbia] = useState(inputs.ubia ?? '');
  const overrideBad = override.trim() !== '' && !MONEY_RE.test(override.trim());
  const ubiaBad = ubia.trim() !== '' && !MONEY_RE.test(ubia.trim());
  const reasonMissing = override.trim() !== '' && reason.trim() === '';
  const invalid = overrideBad || ubiaBad || reasonMissing;

  return (
    <section className="space-y-3 bg-white rounded-lg border border-gray-200 p-4" aria-label="Year inputs">
      <h2 className="text-lg font-semibold text-gray-900">{taxYear} QBI inputs</h2>
      <p className="text-sm text-gray-600">
        W-2 wages from accounts treated as W-2 wages (projected for the year):{' '}
        <strong data-testid="books-w2">{booksW2Wages == null ? 'unavailable' : formatMoney(booksW2Wages)}</strong>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-gray-700">
          W-2 wages override
          <input aria-label="W-2 wages override" inputMode="decimal" placeholder="Use computed total" disabled={!canWrite}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50" value={override}
            onChange={(e) => setOverride(e.target.value)} />
        </label>
        <label className="block text-sm text-gray-700">
          UBIA (unadjusted basis of qualified property)
          <input aria-label="UBIA" inputMode="decimal" disabled={!canWrite}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50" value={ubia}
            onChange={(e) => setUbia(e.target.value)} />
        </label>
      </div>
      {override.trim() !== '' && (
        <label className="block text-sm text-gray-700">
          Reason for override (required)
          <input aria-label="Override reason" disabled={!canWrite}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50" value={reason}
            onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
      {reasonMissing && <p className="text-sm text-red-600" role="alert">A reason is required when overriding W-2 wages.</p>}
      {(overrideBad || ubiaBad) && <p className="text-sm text-red-600" role="alert">Enter amounts as plain numbers with up to 4 decimals.</p>}
      {ubia.trim() === '' && (
        <p className="text-sm text-amber-700" role="status">UBIA is blank, so the UBIA limb of the QBI wage/property limit is not computed.</p>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canWrite && (
        <Button size="sm" loading={saving} disabled={invalid} onClick={() => onSave({
          w2WagesOverride: override.trim() || null,
          w2WagesOverrideReason: override.trim() ? reason.trim() : null,
          ubia: ubia.trim() || null,
        })}>Save year inputs</Button>
      )}
    </section>
  );
}
