// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useTaxpayers, useTaxpayer } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { SELECT_CLASS, US_STATES } from './labels';

export interface PaymentTarget { paymentTaxpayerId: string | null; paymentPersonId: string | null; paymentJurisdiction: string | null }

/**
 * Taxpayer / person / jurisdiction for an estimated-tax-payment account, fed from the taxpayers API.
 * `personOnly` hides the jurisdiction: the person target of a guaranteed payment, owner item or W-2 wage account.
 */
export function PaymentTargetPicker({ value, disabled, onChange, personOnly = false }: {
  value: PaymentTarget; disabled: boolean; onChange: (v: PaymentTarget) => void; personOnly?: boolean;
}) {
  const taxpayers = useTaxpayers({ status: 'active', limit: 200, offset: 0 });
  const detail = useTaxpayer(value.paymentTaxpayerId ?? undefined);
  const persons = detail.data?.persons ?? [];
  return (
    <div className="flex flex-wrap gap-2 items-center" data-testid="payment-target">
      <select aria-label="Payment taxpayer" className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={value.paymentTaxpayerId ?? ''}
        onChange={(e) => onChange({ ...value, paymentTaxpayerId: e.target.value || null, paymentPersonId: null })}>
        <option value="">Taxpayer...</option>
        {(taxpayers.data?.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
      </select>
      <select aria-label="Payment person" className={`${SELECT_CLASS} !w-auto`} disabled={disabled || !value.paymentTaxpayerId} value={value.paymentPersonId ?? ''}
        onChange={(e) => onChange({ ...value, paymentPersonId: e.target.value || null })}>
        <option value="">Person...</option>
        {persons.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
      </select>
      {!personOnly && <select aria-label="Payment jurisdiction" className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={value.paymentJurisdiction ?? ''}
        onChange={(e) => onChange({ ...value, paymentJurisdiction: e.target.value || null })}>
        <option value="">Jurisdiction...</option>
        <option value="federal">Federal</option>
        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>}
    </div>
  );
}
