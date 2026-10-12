// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import {
  DEDUCTION_MODES, HSA_COVERAGES, RATE_MODES, SAFE_HARBOR_OVERRIDES,
  type DeductionMode, type FilingStatus, type HsaCoverage, type PersonDTO, type RateMode, type SafeHarborOverride, type UpsertYearInput, type YearDetailDTO,
} from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SAFE_HARBOR_LABELS, SELECT_CLASS } from '../taxpayers/labels';
import { DEDUCTION_MODE_LABELS, HSA_LABELS, ITEMIZED_FIELDS, SCH1A_FIELDS, fmtMoney, plainDecimal } from './labels';
import { PeopleCard, peopleDraftFromYear, peopleDraftInvalid, peoplePayload } from './PeopleCard';
import { Sch1aDialog, SCH1A_MFS_NOTICE, sch1aAmountBad, seniorByYearEnd } from './Sch1aDialog';

const SCH1A_CHIP_LABELS: Record<string, string> = { qualifiedTips: 'Tips', qualifiedOvertime: 'Overtime', carLoanInterest: 'Car loan interest' };

interface Props {
  detail: YearDetailDTO;
  persons: PersonDTO[];
  /** Taxpayer filing status (the MFS lived-apart flag is shown for MFS only). */
  filingStatus?: FilingStatus;
  canWrite: boolean;
  saving?: boolean;
  error?: string;
  saved?: boolean;
  onSave: (input: UpsertYearInput) => void;
}

const MONEY_RE = /^-?\d+(\.\d{1,4})?$/;
const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s));
const str = (n: number | undefined): string => (n == null ? '' : String(n));

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3" aria-label={title}>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </section>
  );
}

/** Year-level inputs (shared by every scenario of the year): prior year, rate mode, people (wages, retirement plans), deductions, Sch 1-A, credits, HSA, withholding. */
// §6654(d)(1)(C) high-income threshold, for the explanatory note only (the engine reads the parameter).
const HIGH_AGI = 150000;
const HIGH_AGI_MFS = 75000;

export function YearInputsForm({ detail, persons, filingStatus, canWrite, saving, error, saved, onSave }: Props) {
  const y = detail.year;
  const [priorTax, setPriorTax] = useState(plainDecimal(y.priorYearTax));
  const [priorAgi, setPriorAgi] = useState(plainDecimal(y.priorYearAgi));
  const [twelve, setTwelve] = useState(y.priorYearTwelveMonths);
  const [filed, setFiled] = useState(y.priorYearFiled);
  const [rule, setRule] = useState<SafeHarborOverride | ''>(y.safeHarborRule ?? '');
  const [rateMode, setRateMode] = useState<RateMode>(y.rateMode);
  const [ratePct, setRatePct] = useState(y.effectiveRateOverride == null ? '' : String(Number((y.effectiveRateOverride * 100).toFixed(4))));
  const [dedMode, setDedMode] = useState<DeductionMode>(y.deductionMode);
  const [itemized, setItemized] = useState<Record<string, string>>(() => Object.fromEntries(ITEMIZED_FIELDS.map(([k]) => [k, str((y.itemized as Record<string, number | undefined>)[k])])));
  const [sch1a, setSch1a] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const role of ['primary', 'spouse'] as const) for (const [k] of SCH1A_FIELDS) out[`${role}.${k}`] = str((y.sch1a[role] as Record<string, number | undefined> | undefined)?.[k]);
    return out;
  });
  const [sch1aOpen, setSch1aOpen] = useState(false);
  const [nonref, setNonref] = useState(String(Number(y.creditsNonrefundable)));
  const [ref, setRef] = useState(String(Number(y.creditsRefundable)));
  const [hsa, setHsa] = useState<Record<string, HsaCoverage | ''>>({ primary: y.hsaCoverage.primary ?? '', spouse: y.hsaCoverage.spouse ?? '' });
  const [fedWh, setFedWh] = useState(str(y.withholding.federal));
  const [people, setPeople] = useState(() => peopleDraftFromYear(y));
  const [stateWh, setStateWh] = useState(Object.entries(y.withholding.states ?? {}).map(([s, v]) => `${s}=${v}`).join(', '));

  const itemizedTotal = ITEMIZED_FIELDS.reduce((s, [k]) => s + (num(itemized[k] ?? '') ?? 0), 0);
  const rateNum = Number(ratePct);
  const rateBad = rateMode === 'effective' && (ratePct.trim() === '' || !Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100);
  const moneyBad = (s: string) => s.trim() !== '' && !MONEY_RE.test(s.trim());
  const stateWhParsed = stateWh.split(',').map((t) => t.trim()).filter(Boolean).map((t) => t.split('=').map((p) => p.trim()));
  const stateWhBad = stateWhParsed.some(([s, v]) => !s || !/^[A-Za-z]{2}$/.test(s) || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0);
  const sch1aInvalid = Object.values(sch1a).some(sch1aAmountBad);
  const invalid = sch1aInvalid || peopleDraftInvalid(people) || rateBad || moneyBad(priorTax) || moneyBad(priorAgi) || moneyBad(nonref) || moneyBad(ref) || stateWhBad
    || ITEMIZED_FIELDS.some(([k]) => Number.isNaN(Number(itemized[k] || 0)));

  function submit() {
    const sch: Record<string, Record<string, number>> = { primary: {}, spouse: {} };
    for (const role of ['primary', 'spouse'] as const) for (const [k] of SCH1A_FIELDS) {
      const v = num(sch1a[`${role}.${k}`] ?? '');
      if (v !== undefined) sch[role]![k] = v;
    }
    const itemizedOut: Record<string, number> = {};
    for (const [k] of ITEMIZED_FIELDS) { const v = num(itemized[k] ?? ''); if (v !== undefined) itemizedOut[k] = v; }
    const states: Record<string, number> = {};
    for (const [s, v] of stateWhParsed) states[s!.toUpperCase()] = Number(v);
    onSave({
      priorYearTax: priorTax.trim() === '' ? null : priorTax.trim(), priorYearAgi: priorAgi.trim() === '' ? null : priorAgi.trim(),
      priorYearTwelveMonths: twelve, priorYearFiled: filed, safeHarborRule: rule === '' ? null : rule,
      rateMode, effectiveRateOverride: rateMode === 'effective' ? Math.round(rateNum * 10000) / 1000000 : null,
      deductionMode: dedMode, itemized: itemizedOut,
      sch1a: { primary: sch['primary'], spouse: sch['spouse'] },
      creditsNonrefundable: nonref.trim() || '0', creditsRefundable: ref.trim() || '0',
      hsaCoverage: { ...(hsa['primary'] ? { primary: hsa['primary'] } : {}), ...(hsa['spouse'] ? { spouse: hsa['spouse'] } : {}) },
      withholding: { ...(num(fedWh) !== undefined ? { federal: num(fedWh)! } : {}), states },
      ...peoplePayload(people, persons.map((p) => p.role)),
    });
  }

  const roles = persons.length > 0 ? persons : [];
  const seniors = roles.filter((p) => seniorByYearEnd(p.dateOfBirth, y.taxYear));
  return (
    <div className="space-y-4" aria-label="Year inputs">
      <Card title="Tax calculation" note="Brackets use the platform tax parameters. Use an effective rate only for a quick what-if.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ye-ratemode" className="block text-sm font-medium text-gray-700 mb-1">Federal tax method</label>
            <select id="ye-ratemode" className={SELECT_CLASS} value={rateMode} disabled={!canWrite} onChange={(e) => setRateMode(e.target.value as RateMode)}>
              {RATE_MODES.map((m) => <option key={m} value={m}>{m === 'brackets' ? 'Tax brackets' : 'Effective-rate override'}</option>)}
            </select>
          </div>
          {rateMode === 'effective' && (
            <Input label="Effective rate %" inputMode="decimal" value={ratePct} disabled={!canWrite}
              error={rateBad ? '0 to 100' : undefined} onChange={(e) => setRatePct(e.target.value)} />
          )}
          <Input label="Nonrefundable credits" inputMode="decimal" value={nonref} disabled={!canWrite}
            error={moneyBad(nonref) ? 'Enter an amount' : undefined} onChange={(e) => setNonref(e.target.value)} />
          <Input label="Refundable credits" inputMode="decimal" value={ref} disabled={!canWrite}
            error={moneyBad(ref) ? 'Enter an amount' : undefined} onChange={(e) => setRef(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500">Nonrefundable credits cannot reduce regular tax below zero.</p>
        {roles.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs text-gray-700" aria-label="People">
            {roles.map((p) => (
              <li key={p.id} className="rounded bg-gray-100 px-2 py-1">
                {p.firstName} {p.lastName}{seniorByYearEnd(p.dateOfBirth, y.taxYear) ? ' · 65 or older' : ''}{p.isBlind ? ' · blind' : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PeopleCard draft={people} onChange={setPeople} persons={roles} filingStatus={filingStatus} canWrite={canWrite} />

      <Card title="Deductions">
        <div>
          <label htmlFor="ye-dedmode" className="block text-sm font-medium text-gray-700 mb-1">Deduction method</label>
          <select id="ye-dedmode" className={`${SELECT_CLASS} sm:max-w-sm`} value={dedMode} disabled={!canWrite} onChange={(e) => setDedMode(e.target.value as DeductionMode)}>
            {DEDUCTION_MODES.map((m) => <option key={m} value={m}>{DEDUCTION_MODE_LABELS[m]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ITEMIZED_FIELDS.map(([k, label]) => (
            <Input key={k} label={label} inputMode="decimal" value={itemized[k] ?? ''} disabled={!canWrite}
              onChange={(e) => setItemized((cur) => ({ ...cur, [k]: e.target.value }))} />
          ))}
        </div>
        <p className="text-sm text-gray-700" data-testid="itemized-total">
          Itemized total <span className="font-medium tabular-nums">{fmtMoney(itemizedTotal)}</span>
          {dedMode !== 'auto' && <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{dedMode === 'itemized' ? 'Itemized forced' : 'Standard forced'}</span>}
        </p>
        <p className="text-xs text-gray-500">SALT is capped and phased down by the platform parameters when the estimate runs; enter what was actually paid.</p>
        <div className="space-y-2" aria-label="Schedule 1-A summary" role="group">
          <div className="text-sm font-medium text-gray-700">Schedule 1-A (in addition to either)</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-gray-700">
              Senior &middot; {seniors.length > 0 ? `${seniors.map((p) => p.firstName).join(' & ')} 65+` : 'none 65+'}
            </span>
            {SCH1A_FIELDS.map(([k]) => (
              <span key={k} className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-gray-700">
                {SCH1A_CHIP_LABELS[k]} &middot; {fmtMoney(roles.reduce((sum, p) => sum + (Number(sch1a[`${p.role}.${k}`]) || 0), 0))}
              </span>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setSch1aOpen(true)}>{canWrite ? 'Edit Schedule 1-A' : 'View Schedule 1-A'}</Button>
          </div>
          {filingStatus === 'mfs' && <p className="text-xs text-amber-800">{SCH1A_MFS_NOTICE}</p>}
          {sch1aInvalid && <p className="text-xs text-red-600">A Schedule 1-A amount is not a valid amount; open the dialog to fix it.</p>}
        </div>
        <Sch1aDialog open={sch1aOpen} taxYear={y.taxYear} filingStatus={filingStatus} persons={roles} canWrite={canWrite} values={sch1a}
          onApply={(v) => { setSch1a(v); setSch1aOpen(false); }} onCancel={() => setSch1aOpen(false)} />
        {roles.length > 0 && (
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="text-sm font-medium text-gray-700">HSA coverage</legend>
            {roles.map((p) => (
              <div key={p.id}>
                <label htmlFor={`hsa-${p.role}`} className="block text-sm text-gray-700 mb-1">{p.firstName}</label>
                <select id={`hsa-${p.role}`} className={SELECT_CLASS} value={hsa[p.role] ?? ''} disabled={!canWrite}
                  onChange={(e) => setHsa((cur) => ({ ...cur, [p.role]: e.target.value as HsaCoverage | '' }))}>
                  <option value="">Not set</option>
                  {HSA_COVERAGES.map((c) => <option key={c} value={c}>{HSA_LABELS[c]}</option>)}
                </select>
              </div>
            ))}
          </fieldset>
        )}
      </Card>

      <Card title="Prior year · safe harbor" note="Prior-year tax and AGI are tax return information. They are stored encrypted and shown only to firm staff on this screen.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Prior-year total tax" inputMode="decimal" value={priorTax} disabled={!canWrite}
            error={moneyBad(priorTax) ? 'Enter an amount' : undefined} onChange={(e) => setPriorTax(e.target.value)} />
          <Input label="Prior-year AGI" inputMode="decimal" value={priorAgi} disabled={!canWrite}
            error={moneyBad(priorAgi) ? 'Enter an amount' : undefined} onChange={(e) => setPriorAgi(e.target.value)} />
          <div>
            <label htmlFor="ye-rule" className="block text-sm font-medium text-gray-700 mb-1">Recommended rule</label>
            <select id="ye-rule" className={SELECT_CLASS} value={rule} disabled={!canWrite} onChange={(e) => setRule(e.target.value as SafeHarborOverride | '')}>
              <option value="">{detail.taxpayerSafeHarborOverride
                ? `Taxpayer setting: ${SAFE_HARBOR_LABELS[detail.taxpayerSafeHarborOverride]}`
                : `Firm default: ${SAFE_HARBOR_LABELS[detail.firmSafeHarborDefault]}`}</option>
              {SAFE_HARBOR_OVERRIDES.map((s) => <option key={s} value={s}>{SAFE_HARBOR_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={twelve && filed} disabled={!canWrite} onChange={(e) => { setTwelve(e.target.checked); setFiled(e.target.checked); }} />
          Prior year was a full 12-month year with a return filed
        </label>
        {/* QA D28: only when the entered prior-year AGI is above the threshold (the estimate shows the computed rule). */}
        {Number(priorAgi) > (filingStatus === 'mfs' ? HIGH_AGI_MFS : HIGH_AGI) && (
          <p className="text-xs text-gray-500" data-testid="rule-callout">
            Prior-year AGI is above {filingStatus === 'mfs' ? '$75,000 (married filing separately)' : '$150,000'}, so the prior-year safe harbor is 110% of the prior-year tax.
          </p>
        )}
      </Card>

      <Card title="Withholding" note="Treated as paid evenly through the year. State entries look like MO=2000, AR=500.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Federal withholding (annual)" inputMode="decimal" value={fedWh} disabled={!canWrite} onChange={(e) => setFedWh(e.target.value)} />
          <div>
            {/* QA D27: the format error is tied to the field. */}
            <Input label="State withholding (annual)" value={stateWh} disabled={!canWrite} placeholder="MO=2000"
              aria-invalid={stateWhBad} aria-describedby={stateWhBad ? 'state-wh-error' : undefined}
              className={stateWhBad ? 'border-red-300' : undefined} onChange={(e) => setStateWh(e.target.value)} />
            {stateWhBad && <p id="state-wh-error" className="mt-1 text-sm text-red-600">Use STATE=amount, comma separated</p>}
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {saved && <p className="text-sm text-green-700" role="status">Saved.</p>}
      {canWrite && <Button disabled={invalid} loading={saving} onClick={submit}>{detail.exists ? 'Save annual settings' : `Set up ${y.taxYear}`}</Button>}
    </div>
  );
}
