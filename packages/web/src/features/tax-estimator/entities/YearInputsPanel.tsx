// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { PROJECTION_METHODS, PROJECTION_METHOD_LABELS, type EntityTaxType, type EntityYearInputsDto, type ProjectionMethod, type UpsertEntityYearInputsInput } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { formatMoney } from '../../../utils/money';

const MONEY_RE = /^\d{1,15}(\.\d{1,4})?$/;

/** Per-year QBI inputs (D8): computed W-2 wages with an override that needs a reason, and manual UBIA. */
export function YearInputsPanel({ taxYear, inputs, booksW2Wages, entityType, canWrite, saving, error, onSave }: {
  taxYear: number; inputs: EntityYearInputsDto; booksW2Wages: string | null; canWrite: boolean; saving: boolean; error?: string;
  /** Resolved entity tax type; the >2% shareholder health switch is S-corporation only (QA2-03). */
  entityType?: EntityTaxType | null;
  onSave: (input: UpsertEntityYearInputsInput) => void;
}) {
  const [override, setOverride] = useState(inputs.w2WagesOverride ?? '');
  const [reason, setReason] = useState(inputs.w2WagesOverrideReason ?? '');
  const [ubia, setUbia] = useState(inputs.ubia ?? '');
  const [includeSehi, setIncludeSehi] = useState(inputs.includeSehiInW2Wages ?? false);
  const [projectionMethod, setProjectionMethod] = useState<ProjectionMethod>(inputs.projectionMethod ?? 'run_rate');
  const overrideBad = override.trim() !== '' && !MONEY_RE.test(override.trim());
  const ubiaBad = ubia.trim() !== '' && !MONEY_RE.test(ubia.trim());
  const reasonMissing = override.trim() !== '' && reason.trim() === '';
  const invalid = overrideBad || ubiaBad || reasonMissing;
  const sCorp = entityType === 's_corp';
  // Q46: prior-year trend methods are for individual-path entities; a C corporation keeps the run rate.
  const cCorp = entityType === 'c_corp';

  return (
    <section className="space-y-3 bg-white rounded-lg border border-gray-200 p-4" aria-label="Year inputs">
      <h2 className="text-lg font-semibold text-gray-900">{taxYear} QBI and projection inputs</h2>
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
      {sCorp && (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-1" checked={includeSehi} disabled={!canWrite} aria-label="Include shareholder health insurance in W-2 wages"
            onChange={(e) => setIncludeSehi(e.target.checked)} />
          <span>
            Include &gt;2% shareholder health insurance in §199A W-2 wages
            <span className="block text-xs text-gray-500">
              S corporations only. The officer&apos;s health premiums added to W-2 box 1 are <strong>excluded</strong> from the W-2 wages used for the
              §199A wage limit by default (CPA decision). Tick to include them for this entity and tax year; the assumptions page states which was used.
            </span>
          </span>
        </label>
      )}
      {!cCorp && (
        <label className="block text-sm text-gray-700">
          Projection method ({taxYear})
          <select aria-label="Projection method" disabled={!canWrite} value={projectionMethod}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 sm:w-80"
            onChange={(e) => setProjectionMethod(e.target.value as ProjectionMethod)}>
            {PROJECTION_METHODS.map((m) => <option key={m} value={m}>{PROJECTION_METHOD_LABELS[m]}</option>)}
          </select>
          <span className="block text-xs text-gray-500" data-testid="projection-help">
            How the rest of {taxYear}&apos;s ordinary income is projected. <strong>Run rate</strong> (default): year-to-date recurring income
            per month × months left. <strong>Prior-year seasonal (scaled)</strong>: {taxYear - 1}&apos;s remaining months × (this year&apos;s
            recurring year-to-date ÷ {taxYear - 1}&apos;s same months), capped at ×0.25–×4. <strong>Prior-year seasonal (dollar)</strong>:
            {' '}{taxYear - 1}&apos;s remaining months as-is. Ordinary income only, from {taxYear - 1}&apos;s books with non-recurring items left out;
            falls back to the run rate (with a warning) when {taxYear - 1}&apos;s books are incomplete or the figures do not support a trend.
          </span>
        </label>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canWrite && (
        <Button size="sm" loading={saving} disabled={invalid} onClick={() => onSave({
          w2WagesOverride: override.trim() || null,
          w2WagesOverrideReason: override.trim() ? reason.trim() : null,
          ubia: ubia.trim() || null,
          // The API rejects the switch on anything but an S corporation (422).
          includeSehiInW2Wages: sCorp ? includeSehi : false,
          // The API rejects a prior-year method on a C corporation (422).
          projectionMethod: cCorp ? 'run_rate' : projectionMethod,
        })}>Save year inputs</Button>
      )}
    </section>
  );
}
