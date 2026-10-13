// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo, useState } from 'react';
import type { AccountTreatment, AccountTreatmentInput, EntityTaxType, OwnerCandidateDto, SplitMode } from '@kis-books/shared';
import { ACCOUNT_TREATMENTS, allowsPersonTarget, personRequiredFor, treatmentAllowedFor } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { SortableTh } from '../../../components/ui/SortableTh';
import { useColumnView } from '../../../hooks/useColumnView';
import { formatMoney } from '../../../utils/money';
import { PaymentTargetPicker } from './PaymentTargetPicker';
import { OwnerSplitEditor, defaultSplitRows, splitProblem, type SplitDraftRow } from './OwnerSplitEditor';
import { SELECT_CLASS, TREATMENT_LABELS, US_STATES } from './labels';
import { plainDecimal } from '../years/labels';
import type { TreatmentRow } from './rows';
import { NumericInput } from '../../../components/forms/NumericInput';

type SortKey = 'account' | 'treatment' | 'book' | 'tax' | 'status';
const SORT_KEYS: readonly SortKey[] = ['account', 'treatment', 'book', 'tax', 'status'];
const PCT_RE = /^\d{1,3}(\.\d{1,4})?$/;

interface Draft {
  treatment: AccountTreatment | null; pct: string; paymentTaxpayerId: string | null; paymentPersonId: string | null;
  paymentJurisdiction: string | null; nonRecurring: boolean;
  /** Q50: owner split rows ([] = the single target above takes 100%). */
  splitMode: SplitMode; splits: SplitDraftRow[];
}

const statusOf = (r: TreatmentRow) => (r.unmappedWithActivity ? 'unmapped' : r.suggestion ? 'suggested' : 'ok');
const num = (v: string) => Number(v) || 0;

function toInput(accountId: string, d: Draft): AccountTreatmentInput {
  const pay = d.treatment === 'estimated_tax_payment';
  if (allowsPersonTarget(d.treatment) && d.splits.length > 0) {
    return {
      accountId, treatment: d.treatment, nonRecurring: d.nonRecurring, pct: null, splitMode: d.splitMode,
      splits: d.splits.map((r) => (d.splitMode === 'pct'
        ? { taxpayerId: r.taxpayerId, personId: r.personId, pct: r.pct }
        : { taxpayerId: r.taxpayerId, personId: r.personId, amount: r.amount, taxYear: r.taxYear })),
      ...(pay ? { paymentJurisdiction: d.paymentJurisdiction } : {}),
    };
  }
  return {
    accountId, treatment: d.treatment, nonRecurring: d.nonRecurring,
    pct: d.treatment === 'nondeductible_pct' ? d.pct : null,
    ...(pay ? { paymentTaxpayerId: d.paymentTaxpayerId, paymentPersonId: d.paymentPersonId, paymentJurisdiction: d.paymentJurisdiction }
      : allowsPersonTarget(d.treatment) && d.paymentPersonId ? { paymentTaxpayerId: d.paymentTaxpayerId, paymentPersonId: d.paymentPersonId } : {}),
  };
}

/**
 * GL tax-treatment map: TB tax code (read-only chip) beside the estimator treatment. Edits are staged and saved together.
 * Q50: `ownerCandidates` (firm admin / staff) limits every person / payment picker to the owners linked to this
 * business and enables "Split between owners"; without it (read-only members) the stored targets are displayed only.
 */
export function TreatmentTable({ rows, canWrite, saving, error, onSave, entityType = null, ownerCandidates, taxYear = new Date().getFullYear() }: {
  rows: TreatmentRow[]; canWrite: boolean; saving: boolean; error?: string; onSave: (inputs: AccountTreatmentInput[]) => void;
  /** Resolved entity tax type: limits the treatment list and decides when a person is required. */
  entityType?: EntityTaxType | null;
  ownerCandidates?: OwnerCandidateDto[];
  /** The page's tax year: fixed-amount splits are entered per year. */
  taxYear?: number;
}) {
  const view = useColumnView<SortKey>('vibe:te-entity-treatments:view', { sortKeys: SORT_KEYS, defaultSort: { col: 'account', dir: 'asc' } });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // QA D14: search by account number or name.
  const [q, setQ] = useState('');

  const draftOf = (r: TreatmentRow): Draft => drafts[r.accountId] ?? {
    treatment: r.treatment, pct: plainDecimal(r.pct), paymentTaxpayerId: r.paymentTaxpayerId, paymentPersonId: r.paymentPersonId,
    paymentJurisdiction: r.paymentJurisdiction, nonRecurring: r.nonRecurring,
    splitMode: r.splitMode ?? 'pct',
    splits: (r.splits ?? []).map((x) => ({
      taxpayerId: x.taxpayerId, personId: x.personId, pct: plainDecimal(x.pct), amount: plainDecimal(x.amount), taxYear: x.taxYear,
    })),
  };
  const patch = (r: TreatmentRow, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [r.accountId]: { ...draftOf(r), ...p } }));

  const visible = useMemo(() => {
    const status = view.filterFor('status');
    const treat = view.filterFor('treatment');
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (status.size === 0 || status.has(statusOf(r))) && (treat.size === 0 || treat.has(r.treatment ?? 'none'))
      && (needle === '' || `${r.accountNumber ?? ''} ${r.name}`.toLowerCase().includes(needle)));
    const dir = view.sortDir === 'asc' ? 1 : -1;
    const key = (r: TreatmentRow): string | number => {
      switch (view.sortCol) {
        case 'treatment': return r.treatment ?? '';
        case 'book': return num(r.bookAmount);
        case 'tax': return num(r.taxAmount);
        case 'status': return statusOf(r);
        default: return `${r.accountNumber ?? ''} ${r.name}`;
      }
    };
    if (view.sortCol) out = [...out].sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    return out;
  }, [rows, view, q]);

  const byId = new Map(rows.map((r) => [r.accountId, r]));
  const dirtyIds = Object.keys(drafts);
  const pctBad = (id: string) => { const d = drafts[id]; return !!d && d.treatment === 'nondeductible_pct' && (!PCT_RE.test(d.pct) || Number(d.pct) > 100); };
  const personBad = (id: string) => { const d = drafts[id]; return !!d && personRequiredFor(d.treatment, entityType) && !d.paymentPersonId && d.splits.length === 0; };
  const splitBad = (id: string) => {
    const d = drafts[id];
    return !!d && allowsPersonTarget(d.treatment) && d.splits.length > 0
      && splitProblem(d.splitMode, d.splits, d.treatment === 'estimated_tax_payment', taxYear) !== null;
  };
  const anyBad = dirtyIds.some((id) => pctBad(id) || personBad(id) || splitBad(id));

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center border border-dashed rounded-lg">No P&amp;L accounts with activity in the selected range. Accounts appear here once they have activity or a saved treatment.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="w-full sm:w-72">
        <input type="search" aria-label="Search accounts" placeholder="Search accounts" value={q} onChange={(e) => setQ(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm" aria-label="GL tax treatments">
          <thead className="bg-gray-50 border-b text-xs text-gray-500">
            <tr>
              <SortableTh label="Account" {...view.thProps('account')} />
              <th className="px-3 py-2 text-left uppercase tracking-wide">TB tax code</th>
              <SortableTh label="Treatment" {...view.thProps('treatment')}
                filter={view.filterProps('treatment', [{ value: 'none', label: 'None' }, ...ACCOUNT_TREATMENTS.map((t) => ({ value: t, label: TREATMENT_LABELS[t] }))])} />
              <th className="px-3 py-2 text-left uppercase tracking-wide">%</th>
              <th className="px-3 py-2 text-center uppercase tracking-wide">Non-recurring</th>
              <SortableTh label="Book" align="right" {...view.thProps('book')} />
              <SortableTh label="Tax effect" align="right" {...view.thProps('tax')} />
              <SortableTh label="Status" {...view.thProps('status')}
                filter={view.filterProps('status', [
                  { value: 'unmapped', label: 'Unmapped with activity' }, { value: 'suggested', label: 'Suggested' }, { value: 'ok', label: 'Mapped' },
                ])} />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No accounts match the current filters.</td></tr>}
            {visible.map((r) => {
              const d = draftOf(r);
              const st = statusOf(r);
              const rowWrite = canWrite && !r.otherFirm;
              return (
                <tr key={r.accountId} className="border-b last:border-0 align-top" data-testid="treatment-row">
                  <td className="px-3 py-2">{r.accountNumber ? `${r.accountNumber} ` : ''}{r.name}</td>
                  <td className="px-3 py-2">
                    {r.taxCode
                      ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs" title={r.taxCode.description} data-testid="tax-code-chip">{r.taxCode.code}</span>
                      : <span className="text-xs text-gray-400">&mdash;</span>}
                  </td>
                  <td className="px-3 py-2 space-y-1">
                    <select aria-label={`Treatment for ${r.name}`} className={SELECT_CLASS} disabled={!rowWrite} value={d.treatment ?? ''}
                      onChange={(e) => {
                        const next = (e.target.value || null) as AccountTreatment | null;
                        // Split rows name persons for owner items but taxpayers for payments: switching kinds starts over.
                        const kindChanged = (next === 'estimated_tax_payment') !== (d.treatment === 'estimated_tax_payment');
                        patch(r, { treatment: next, ...(kindChanged ? { splits: [], splitMode: 'pct' as const } : {}) });
                      }}>
                      <option value="">None</option>
                      {ACCOUNT_TREATMENTS.filter((t) => t === d.treatment || treatmentAllowedFor(t, r.accountType, entityType))
                        .map((t) => <option key={t} value={t}>{TREATMENT_LABELS[t]}</option>)}
                    </select>
                    {allowsPersonTarget(d.treatment) && d.splits.length === 0 && d.treatment === 'estimated_tax_payment' && (
                      <PaymentTargetPicker disabled={!rowWrite} candidates={ownerCandidates}
                        value={{ paymentTaxpayerId: d.paymentTaxpayerId, paymentPersonId: d.paymentPersonId, paymentJurisdiction: d.paymentJurisdiction }}
                        onChange={(v) => patch(r, v)} />
                    )}
                    {allowsPersonTarget(d.treatment) && d.splits.length === 0 && d.treatment !== 'estimated_tax_payment' && (
                      <PaymentTargetPicker personOnly disabled={!rowWrite} candidates={ownerCandidates}
                        value={{ paymentTaxpayerId: d.paymentTaxpayerId, paymentPersonId: d.paymentPersonId, paymentJurisdiction: null }}
                        onChange={(v) => patch(r, { paymentTaxpayerId: v.paymentTaxpayerId, paymentPersonId: v.paymentPersonId })} />
                    )}
                    {allowsPersonTarget(d.treatment) && d.splits.length === 0 && rowWrite && ownerCandidates && ownerCandidates.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => patch(r, {
                        splitMode: 'pct', paymentTaxpayerId: null, paymentPersonId: null,
                        splits: (() => {
                          const def = defaultSplitRows(ownerCandidates, d.treatment === 'estimated_tax_payment');
                          return def.length > 0 ? def : [{ taxpayerId: null, personId: null, pct: '', amount: '', taxYear: null }];
                        })(),
                      })}>
                        Split between owners
                      </Button>
                    )}
                    {allowsPersonTarget(d.treatment) && d.splits.length > 0 && ownerCandidates && (
                      <>
                        {d.treatment === 'estimated_tax_payment' && (
                          <select aria-label="Payment jurisdiction" className={`${SELECT_CLASS} !w-auto`} disabled={!rowWrite} value={d.paymentJurisdiction ?? ''}
                            onChange={(e) => patch(r, { paymentJurisdiction: e.target.value || null })}>
                            <option value="">Jurisdiction...</option>
                            <option value="federal">Federal</option>
                            {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                          </select>
                        )}
                        <OwnerSplitEditor mode={d.splitMode} rows={d.splits} isPayment={d.treatment === 'estimated_tax_payment'} taxYear={taxYear}
                          candidates={ownerCandidates} disabled={!rowWrite} accountName={r.name}
                          onChange={(mode, splits) => patch(r, { splitMode: mode, splits })} />
                        {rowWrite && (
                          <Button size="sm" variant="ghost" onClick={() => {
                            const first = d.splits[0];
                            patch(r, { splits: [], splitMode: 'pct', paymentTaxpayerId: first?.taxpayerId ?? null, paymentPersonId: first?.personId ?? null });
                          }}>
                            Use one owner
                          </Button>
                        )}
                      </>
                    )}
                    {allowsPersonTarget(d.treatment) && d.splits.length > 0 && !ownerCandidates && (
                      <div className="text-xs text-gray-700" data-testid="split-summary">
                        Split between {d.splits.length} owner{d.splits.length === 1 ? '' : 's'} ({d.splitMode === 'pct' ? 'by %' : 'by fixed annual $'})
                      </div>
                    )}
                    {r.otherFirm && <div className="text-xs text-gray-600">Mapped by another firm that shares these books; read-only here.</div>}
                    {personBad(r.accountId) && <div className="text-xs text-red-600" role="alert">Pick the person this belongs to</div>}
                  </td>
                  <td className="px-3 py-2 w-24">
                    {d.treatment === 'nondeductible_pct' && (
                      <NumericInput aria-label={`Nondeductible % for ${r.name}`} disabled={!rowWrite} value={d.pct}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50" onChange={(v) => patch(r, { pct: v })} />
                    )}
                    {pctBad(r.accountId) && <div className="text-xs text-red-600" role="alert">0-100</div>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" aria-label={`Non-recurring ${r.name}`} disabled={!rowWrite} checked={d.nonRecurring}
                      onChange={(e) => patch(r, { nonRecurring: e.target.checked })} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.bookAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.taxAmount)}</td>
                  <td className="px-3 py-2 text-xs">
                    {st === 'unmapped' && <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">Unmapped (treated as ordinary)</span>}
                    {st === 'suggested' && r.suggestion && <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5">Suggested: {TREATMENT_LABELS[r.suggestion.treatment]}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canWrite && dirtyIds.length > 0 && (
        <div className="flex gap-2 items-center">
          <Button size="sm" loading={saving} disabled={anyBad} onClick={() => onSave(dirtyIds.filter((id) => byId.has(id)).map((id) => toInput(id, drafts[id]!)))}>
            Save {dirtyIds.length} change{dirtyIds.length === 1 ? '' : 's'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDrafts({})}>Discard</Button>
        </div>
      )}
    </div>
  );
}
