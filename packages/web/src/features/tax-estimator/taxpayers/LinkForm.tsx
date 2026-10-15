// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useMemo, useState } from 'react';
import {
  ACTIVITY_TYPES,
  type ActivityType, type CompanyOptionDTO, type LinkDTO, type LinkEntityKind, type PartnerSeStatus,
  type PersonDTO, type PersonRole, type UpsertLinkInput,
} from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CompanyPicker } from './CompanyPicker';
import { PctTotalsNotice } from './PctTotalsNotice';
import { computePctTotals } from './pctTotals';
import { ACTIVITY_LABELS, SE_STATUS_LABELS, SELECT_CLASS } from './labels';
import { NumericField } from '../../../components/forms/NumericField';

const RETURN_FORM_KIND: Record<string, LinkEntityKind> = { '1065': 'partnership', '1120S': 's_corp', '1120': 'c_corp', '1040': 'sole' };
const ENTITY_KIND: Record<string, LinkEntityKind> = {
  partnership: 'partnership', s_corp: 's_corp', c_corp: 'c_corp', sole_prop: 'sole', single_member_llc: 'sole',
};
/** Same precedence the server uses: TB return form first, then companies.entity_type. */
export const entityKindOf = (returnForm: string | null, entityType: string | null): LinkEntityKind | null =>
  (returnForm ? RETURN_FORM_KIND[returnForm] : undefined) ?? (entityType ? ENTITY_KIND[entityType] : undefined) ?? null;

type QbiChoice = 'default' | 'yes' | 'no';
const parsePct = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function LinkForm({ persons, links, initial, taxYear, saving, error, onSave, onCancel }: {
  persons: PersonDTO[]; links: readonly LinkDTO[]; initial: LinkDTO | null; taxYear: number;
  saving: boolean; error?: string;
  onSave: (input: UpsertLinkInput) => void; onCancel: () => void;
}) {
  const [personRole, setPersonRole] = useState<PersonRole>(initial?.personRole ?? persons[0]?.role ?? 'primary');
  const [company, setCompany] = useState<{ tenantId: string; companyId: string; tenantName: string; companyName: string; kind: LinkEntityKind | null } | null>(
    initial ? { tenantId: initial.tenantId, companyId: initial.companyId, tenantName: initial.tenantName ?? 'Client', companyName: initial.companyName ?? 'Company', kind: initial.entityKind } : null);
  const [profit, setProfit] = useState(initial?.profitPct != null ? String(initial.profitPct) : '');
  const [loss, setLoss] = useState(initial?.lossPct != null ? String(initial.lossPct) : '');
  const [capital, setCapital] = useState(initial?.capitalPct != null ? String(initial.capitalPct) : '');
  const [activity, setActivity] = useState<ActivityType>(initial?.activityType ?? 'active');
  const [activeParticipation, setActiveParticipation] = useState(initial?.activeParticipation ?? false);
  const [seStatus, setSeStatus] = useState<PartnerSeStatus | ''>(initial?.partnerSeStatus ?? '');
  const [seMemo, setSeMemo] = useState(initial?.partnerSeMemo ?? '');
  const [officer, setOfficer] = useState(initial?.isOfficer ?? false);
  const [qbi, setQbi] = useState<QbiChoice>(initial?.qbiOverrideReason ? (initial.qbiEligible ? 'yes' : 'no') : 'default');
  const [qbiReason, setQbiReason] = useState(initial?.qbiOverrideReason ?? '');
  const [lossOverride, setLossOverride] = useState(initial?.allowedLossOverride ?? '');
  const [lossReason, setLossReason] = useState(initial?.allowedLossReason ?? '');

  const totals = useMemo(() => company ? computePctTotals(links, {
    personRole, tenantId: company.tenantId, companyId: company.companyId, taxYear, profitPct: parsePct(profit), lossPct: parsePct(loss),
  }) : null, [links, personRole, company, taxYear, profit, loss]);

  const pickCompany = (o: CompanyOptionDTO) => {
    const kind = entityKindOf(o.returnForm, o.entityType);
    setCompany({ tenantId: o.tenantId, companyId: o.companyId, tenantName: o.tenantName, companyName: o.companyName, kind });
    if (kind !== 'partnership') setSeStatus('');
    if (kind !== 's_corp') setOfficer(false);
  };

  const pctInvalid = [profit, loss, capital].some((v) => v.trim() !== '' && !(Number(v) >= 0 && Number(v) <= 100));
  const reasonMissing = (qbi !== 'default' && qbiReason.trim().length < 3) || (lossOverride.trim() !== '' && lossReason.trim().length < 3);
  const blocked = !company || pctInvalid || reasonMissing || !!totals?.profitOver || !!totals?.lossOver;

  const submit = () => {
    if (!company) return;
    onSave({
      personRole, taxYear, tenantId: company.tenantId, companyId: company.companyId,
      profitPct: parsePct(profit), lossPct: parsePct(loss), capitalPct: parsePct(capital),
      partnerSeStatus: company.kind === 'partnership' && seStatus ? seStatus : null,
      partnerSeMemo: company.kind === 'partnership' ? (seMemo.trim() || null) : null,
      isOfficer: company.kind === 's_corp' ? officer : false,
      activityType: activity, activeParticipation: activity === 'rental' ? activeParticipation : false,
      qbiEligible: qbi === 'default' ? null : qbi === 'yes',
      qbiOverrideReason: qbi === 'default' ? null : qbiReason.trim(),
      allowedLossOverride: lossOverride.trim() === '' ? null : lossOverride.trim(),
      allowedLossReason: lossOverride.trim() === '' ? null : lossReason.trim(),
    });
  };

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 space-y-3" role="form" aria-label={initial ? 'Edit link' : 'Add link'}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="link-person" className="block text-sm font-medium text-gray-700 mb-1">Person</label>
          <select id="link-person" className={SELECT_CLASS} value={personRole} disabled={!!initial}
            onChange={(e) => setPersonRole(e.target.value as PersonRole)}>
            {persons.map((p) => <option key={p.role} value={p.role}>{p.firstName} {p.lastName} ({p.role})</option>)}
          </select>
        </div>
        <CompanyPicker value={company} disabled={!!initial} onSelect={pickCompany} />
      </div>
      {company && <p className="text-xs text-gray-500">Entity type: {company.kind ? company.kind.replace('_', ' ') : 'unknown'} (from the client's books).</p>}
      <div className="grid grid-cols-3 gap-3">
        <NumericField label="Profit %" min={0} max={100} decimals={4} value={profit} onChange={setProfit} />
        <NumericField label="Loss %" min={0} max={100} decimals={4} value={loss} onChange={setLoss} />
        <NumericField label="Capital % (info)" min={0} max={100} decimals={4} value={capital} onChange={setCapital} />
      </div>
      {totals && <PctTotalsNotice totals={totals} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="link-activity" className="block text-sm font-medium text-gray-700 mb-1">Activity type</label>
          <select id="link-activity" className={SELECT_CLASS} value={activity} onChange={(e) => setActivity(e.target.value as ActivityType)}>
            {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
          </select>
        </div>
        {activity === 'rental' && (
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:pt-6">
            <input type="checkbox" checked={activeParticipation} onChange={(e) => setActiveParticipation(e.target.checked)} />
            Active participation (&sect;469(i) allowance)
          </label>
        )}
        {company?.kind === 'partnership' && (
          <div>
            <label htmlFor="link-se" className="block text-sm font-medium text-gray-700 mb-1">Partner SE status</label>
            <select id="link-se" className={SELECT_CLASS} value={seStatus} onChange={(e) => setSeStatus(e.target.value as PartnerSeStatus | '')}>
              <option value="">Not set</option>
              {(Object.keys(SE_STATUS_LABELS) as PartnerSeStatus[]).map((s) => <option key={s} value={s}>{SE_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        )}
        {company?.kind === 'partnership' && <Input label="SE status memo" value={seMemo} onChange={(e) => setSeMemo(e.target.value)} />}
        {company?.kind === 's_corp' && (
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:pt-6">
            <input type="checkbox" checked={officer} onChange={(e) => setOfficer(e.target.checked)} />
            Officer (W-2 wages)
          </label>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="link-qbi" className="block text-sm font-medium text-gray-700 mb-1">QBI eligibility</label>
          <select id="link-qbi" className={SELECT_CLASS} value={qbi} onChange={(e) => setQbi(e.target.value as QbiChoice)}>
            <option value="default">Default for this activity</option>
            <option value="yes">Override: eligible</option>
            <option value="no">Override: not eligible</option>
          </select>
        </div>
        {qbi !== 'default' && <Input label="QBI override reason" value={qbiReason} onChange={(e) => setQbiReason(e.target.value)} />}
        <NumericField label="Allowed loss override ($)" decimals={2} value={lossOverride} onChange={setLossOverride} />
        {lossOverride.trim() !== '' && <Input label="Allowed loss reason" value={lossReason} onChange={(e) => setLossReason(e.target.value)} />}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={blocked} loading={saving} onClick={submit}>{initial ? 'Save link' : 'Add link'}</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
