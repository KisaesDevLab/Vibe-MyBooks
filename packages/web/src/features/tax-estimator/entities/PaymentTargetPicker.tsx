// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { OwnerCandidateDto } from '@kis-books/shared';
import { useTaxpayers, useTaxpayer } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { SELECT_CLASS, US_STATES } from './labels';

export interface PaymentTarget { paymentTaxpayerId: string | null; paymentPersonId: string | null; paymentJurisdiction: string | null }

/** Q50 help line when no owner is linked to the business (or visible to the caller). */
export const LINK_OWNER_HELP = 'Link the owner to this business first (Taxpayers → the taxpayer → Linked businesses).';

export const ownerLabel = (c: Pick<OwnerCandidateDto, 'firstName' | 'lastName' | 'taxpayerName'>) =>
  `${`${c.firstName} ${c.lastName}`.trim()} (${c.taxpayerName})`;

/** Unique linked taxpayers, in candidate order. */
export function linkedTaxpayers(candidates: ReadonlyArray<OwnerCandidateDto>): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const c of candidates) if (!seen.has(c.taxpayerId)) seen.set(c.taxpayerId, c.taxpayerName);
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

/**
 * Taxpayer / person / jurisdiction for an estimated-tax-payment account, or the person target of
 * a guaranteed payment, owner item or W-2 wage account (`personOnly` hides the jurisdiction).
 *
 * Q50: with `candidates` (firm admin / staff) the lists hold ONLY the owners linked to this
 * business (any year) that the caller may see; a stored target that is not among them shows as
 * "not linked". Without `candidates` (read-only members) the stored target is displayed from the
 * taxpayers API, disabled.
 */
export function PaymentTargetPicker({ value, disabled, onChange, personOnly = false, candidates }: {
  value: PaymentTarget; disabled: boolean; onChange: (v: PaymentTarget) => void; personOnly?: boolean;
  candidates?: ReadonlyArray<OwnerCandidateDto>;
}) {
  if (!candidates) return <LegacyPicker value={value} disabled={disabled} onChange={onChange} personOnly={personOnly} />;
  const jurisdiction = !personOnly && (
    <select aria-label="Payment jurisdiction" className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={value.paymentJurisdiction ?? ''}
      onChange={(e) => onChange({ ...value, paymentJurisdiction: e.target.value || null })}>
      <option value="">Jurisdiction...</option>
      <option value="federal">Federal</option>
      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
  const empty = candidates.length === 0 && <p className="text-xs text-amber-700 w-full" role="note">{LINK_OWNER_HELP}</p>;
  if (personOnly) {
    const known = !value.paymentPersonId || candidates.some((c) => c.personId === value.paymentPersonId);
    return (
      <div className="flex flex-wrap gap-2 items-center" data-testid="payment-target">
        <select aria-label="Owner" className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={value.paymentPersonId ?? ''}
          onChange={(e) => {
            const c = candidates.find((x) => x.personId === e.target.value);
            onChange({ ...value, paymentPersonId: c?.personId ?? null, paymentTaxpayerId: c?.taxpayerId ?? null });
          }}>
          <option value="">Owner...</option>
          {!known && <option value={value.paymentPersonId!}>Current owner (not linked to this business)</option>}
          {candidates.map((c) => <option key={c.personId} value={c.personId}>{ownerLabel(c)}</option>)}
        </select>
        {empty}
      </div>
    );
  }
  const taxpayers = linkedTaxpayers(candidates);
  const knownTp = !value.paymentTaxpayerId || taxpayers.some((t) => t.id === value.paymentTaxpayerId);
  const persons = candidates.filter((c) => c.taxpayerId === value.paymentTaxpayerId);
  const knownPerson = !value.paymentPersonId || persons.some((c) => c.personId === value.paymentPersonId);
  return (
    <div className="flex flex-wrap gap-2 items-center" data-testid="payment-target">
      <select aria-label="Payment taxpayer" className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={value.paymentTaxpayerId ?? ''}
        onChange={(e) => onChange({ ...value, paymentTaxpayerId: e.target.value || null, paymentPersonId: null })}>
        <option value="">Taxpayer...</option>
        {!knownTp && <option value={value.paymentTaxpayerId!}>Current taxpayer (not linked to this business)</option>}
        {taxpayers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select aria-label="Payment person" className={`${SELECT_CLASS} !w-auto`} disabled={disabled || !value.paymentTaxpayerId} value={value.paymentPersonId ?? ''}
        onChange={(e) => onChange({ ...value, paymentPersonId: e.target.value || null })}>
        <option value="">Person (optional)...</option>
        {!knownPerson && <option value={value.paymentPersonId!}>Current person</option>}
        {persons.map((p) => <option key={p.personId} value={p.personId}>{p.firstName} {p.lastName}</option>)}
      </select>
      {jurisdiction}
      {empty}
    </div>
  );
}

/** Pre-Q50 display (read-only members): the stored target resolved through the taxpayers API. */
function LegacyPicker({ value, disabled, onChange, personOnly }: {
  value: PaymentTarget; disabled: boolean; onChange: (v: PaymentTarget) => void; personOnly: boolean;
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
