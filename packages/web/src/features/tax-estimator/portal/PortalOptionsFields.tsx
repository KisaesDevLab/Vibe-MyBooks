// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Q51 — what one portal contact may see of the tax estimates shared with them. Used on the
// taxpayer page (Portal contacts) and in the client's Client Portal > Edit contact dialog.
// One setting per CONTACT: it applies to every taxpayer the contact can open. Turning a
// section on is a grant (firm staff with Tax Estimator access); anyone managing the contact
// may turn one off (Q41(7)). The projected total is always shown.
import {
  PORTAL_CONTACT_TAX_OPTION_KEYS, PORTAL_CONTACT_TAX_OPTION_LABELS,
  type PortalContactTaxOptionKey, type PortalContactTaxOptionsDTO,
} from '@kis-books/shared';

const HINTS: Record<PortalContactTaxOptionKey, string> = {
  calculationSummary: 'Income by business (their share only), AGI, deductions, taxable income and the federal and state tax lines. No rates, formulas or adjustment detail.',
  quarterlyEstimates: 'Installment schedule, next payment and the payment-voucher PDF.',
  paymentsOnRecord: 'Estimated-tax payments received so far.',
  pdfDownload: 'The client copy of the estimate PDF (the same document as the Report Pack section: business totals, safe-harbor amounts, vouchers and the detailed calculation).',
};

interface Props {
  value: PortalContactTaxOptionsDTO;
  /** false = sections may only be switched off here. */
  canGrant: boolean;
  disabled?: boolean;
  onChange: (key: PortalContactTaxOptionKey, on: boolean) => void;
  /** Prefix for input ids (several editors on one page). */
  idPrefix: string;
}

export function PortalOptionsFields({ value, canGrant, disabled, onChange, idPrefix }: Props) {
  return (
    <fieldset className="space-y-1.5" aria-label="What this contact sees in the portal">
      <legend className="text-xs font-medium text-gray-700">What this contact sees (applies to every taxpayer they can open; the projected total is always shown)</legend>
      {PORTAL_CONTACT_TAX_OPTION_KEYS.map((k) => {
        const on = value[k];
        const locked = !on && !canGrant;
        const id = `${idPrefix}-${k}`;
        return (
          <div key={k} className="flex items-start gap-2 text-xs">
            <input id={id} type="checkbox" className="mt-0.5" checked={on} disabled={disabled || locked}
              title={locked ? 'Only firm staff with Tax Estimator access can turn this on' : undefined}
              onChange={(e) => onChange(k, e.target.checked)} />
            <label htmlFor={id} className="min-w-0">
              <span className="font-medium text-gray-800">{PORTAL_CONTACT_TAX_OPTION_LABELS[k]}</span>
              <span className="block text-gray-500">{HINTS[k]}</span>
            </label>
          </div>
        );
      })}
      {!canGrant && <p className="text-[11px] text-gray-500">You can turn sections off. Turning one on needs firm staff with Tax Estimator access.</p>}
    </fieldset>
  );
}
