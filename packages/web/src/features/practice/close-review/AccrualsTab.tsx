// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo, useState } from 'react';
import { buildAccrualSchedule, type AccrualKind, type AccrualMethod } from '@kis-books/shared';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import {
  useAccrualCandidates, useAccrualEntries, useAccrualSchedules, useAccrualTieOut,
  useCancelAccrualSchedule, useCreateAccrualSchedule, useDeleteAccrualSchedule,
  useImportAccruals, usePostAccrualEntry, usePostAllAccruals, useUnpostAccrualEntry,
  type ScheduleInputClient,
} from '../../../api/hooks/useAccruals';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useToast } from '../../../components/ui/Toaster';
import type { ClosePeriod } from './ClosePeriodSelector';

const KIND_LABEL: Record<AccrualKind, string> = {
  prepaid: 'Prepaid expense',
  deferred_revenue: 'Deferred revenue',
  accrued_expense: 'Accrued expense',
  fixed_asset: 'Depreciation',
};
const BALANCE_LABEL: Record<AccrualKind, string> = {
  prepaid: 'Prepaid account (balance sheet)',
  deferred_revenue: 'Deferred revenue account (balance sheet)',
  accrued_expense: 'Accrued liability account (balance sheet)',
  fixed_asset: 'Accumulated depreciation account',
};
const RECOGNITION_LABEL: Record<AccrualKind, string> = {
  prepaid: 'Expense account',
  deferred_revenue: 'Revenue account',
  accrued_expense: 'Expense account',
  fixed_asset: 'Depreciation expense account',
};
const METHOD_LABEL: Record<AccrualMethod, string> = {
  full_month: 'Equal months',
  mid_month: 'Half month at each end',
  actual_days: 'By days of service',
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (v: string | number) => fmt.format(Number(v));
const monthLabel = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

type Draft = Omit<ScheduleInputClient, 'months'> & { months: string };

export function AccrualsTab({ period }: { period: ClosePeriod }) {
  const { activeCompanyId } = useCompanyContext();
  const companyId = activeCompanyId ?? null;
  const ps = period.periodStart.slice(0, 10);
  const pe = period.periodEnd.slice(0, 10);
  const toast = useToast();

  const entriesQ = useAccrualEntries(companyId, ps);
  const schedulesQ = useAccrualSchedules(companyId);
  const candQ = useAccrualCandidates(companyId, ps, pe);
  const tieQ = useAccrualTieOut(companyId, pe);
  const post = usePostAccrualEntry();
  const unpost = useUnpostAccrualEntry();
  const postAll = usePostAllAccruals();
  const cancel = useCancelAccrualSchedule();
  const del = useDeleteAccrualSchedule();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showImport, setShowImport] = useState(false);

  const entries = entriesQ.data?.entries ?? [];
  const drafts = entries.filter((e) => e.status === 'draft');
  const err = (e: Error) => toast.error(e.message || 'Something went wrong.');

  const startDraft = (over: Partial<Draft> = {}) => setDraft({
    companyId, kind: 'prepaid', description: '', balanceAccountId: '', recognitionAccountId: '',
    totalAmount: '', startDate: ps, months: '12', method: 'full_month', postFrom: null, ...over,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* This month */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Entries for {period.label.replace(' (current)', '')}</h3>
            <p className="text-xs text-gray-500">Nothing posts until you click Post. Each post creates a journal entry dated the last day of the month.</p>
          </div>
          <div className="flex gap-2">
            {drafts.length > 0 && (
              <Button size="sm" loading={postAll.isPending}
                onClick={() => postAll.mutate({ companyId, periodStart: ps }, {
                  onSuccess: (r) => toast.success(`Posted ${r.posted} entr${r.posted === 1 ? 'y' : 'ies'}.`), onError: err,
                })}>
                Post all {drafts.length}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => startDraft()}>Add schedule</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowImport((v) => !v)}>Import CSV</Button>
          </div>
        </div>
        {entriesQ.isLoading ? <div className="py-6"><LoadingSpinner /></div> : entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">No accrual entries fall in this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-2">Schedule</th><th className="px-4 py-2">Debit / credit</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">
                    <div className="text-gray-900">{e.description}</div>
                    <div className="text-xs text-gray-500">{KIND_LABEL[e.kind]}{e.is_catch_up ? ` · catch-up for ${monthLabel(e.period_start)}` : ''}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {e.kind === 'deferred_revenue'
                      ? <>Dr {e.balance_account_name} / Cr {e.recognition_account_name}</>
                      : <>Dr {e.recognition_account_name} / Cr {e.balance_account_name}</>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(e.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${e.status === 'posted' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                      {e.status === 'posted' ? 'Posted' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {e.status === 'draft' ? (
                      <Button size="sm" variant="secondary" loading={post.isPending && post.variables === e.id}
                        onClick={() => post.mutate(e.id, { onError: err })}>Post</Button>
                    ) : (
                      <Button size="sm" variant="ghost" loading={unpost.isPending && unpost.variables === e.id}
                        onClick={() => unpost.mutate(e.id, { onError: err })}>Unpost</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showImport && <ImportPanel companyId={companyId} onDone={() => setShowImport(false)} />}
      {draft && <ScheduleForm draft={draft} setDraft={setDraft} onDone={() => setDraft(null)} />}

      {/* Candidates */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Might need a schedule</h3>
          <p className="text-xs text-gray-500">Items this month that look like they should be spread over time, or a regular bill that didn&apos;t arrive.</p>
        </div>
        {candQ.isLoading ? <div className="py-6"><LoadingSpinner /></div> : (
          <div className="divide-y divide-gray-100 text-sm">
            {(candQ.data?.unscheduled ?? []).map((c) => (
              <div key={`u-${c.transaction_id}-${c.account_id}`} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-gray-900">{c.payee ?? c.memo ?? 'Transaction'} → {c.account_name}</div>
                  <div className="text-xs text-gray-500">{c.txn_date} · not on a schedule yet</div>
                </div>
                <span className="tabular-nums">{money(Number(c.debit) || Number(c.credit))}</span>
                <Button size="sm" variant="secondary" onClick={() => startDraft({
                  kind: c.suggested_kind, description: c.payee ?? c.memo ?? '', sourceTransactionId: c.transaction_id,
                  balanceAccountId: c.account_id, totalAmount: String(Number(c.debit) || Number(c.credit)), startDate: c.txn_date,
                })}>Add to accruals</Button>
              </div>
            ))}
            {(candQ.data?.possiblePrepaids ?? []).map((c) => (
              <div key={`p-${c.transaction_id}`} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-gray-900">{c.payee ?? 'Expense'} · {c.account_name}</div>
                  <div className="text-xs text-gray-500">{c.txn_date} · expensed at once; the wording suggests it covers a longer term{c.memo ? ` (“${c.memo}”)` : ''}</div>
                </div>
                <span className="tabular-nums">{money(c.total)}</span>
                <Button size="sm" variant="secondary" onClick={() => startDraft({
                  kind: 'prepaid', description: c.payee ?? c.memo ?? '', sourceTransactionId: c.transaction_id,
                  recognitionAccountId: c.account_id, totalAmount: c.total, startDate: c.txn_date,
                })}>Spread it</Button>
              </div>
            ))}
            {(candQ.data?.missingRecurring ?? []).map((c) => (
              <div key={`m-${c.contact_id}`} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-gray-900">{c.payee}</div>
                  <div className="text-xs text-gray-500">Billed in {c.months} of the last 4 months, nothing this month. An accrued expense may be needed.</div>
                </div>
                <span className="text-xs text-gray-500">avg {money(c.avg_amount)}</span>
                <Button size="sm" variant="secondary" onClick={() => startDraft({
                  kind: 'accrued_expense', description: `${c.payee} — ${period.label.replace(' (current)', '')}`, totalAmount: c.avg_amount, months: '1', startDate: ps,
                })}>Accrue it</Button>
              </div>
            ))}
            {candQ.data && candQ.data.unscheduled.length + candQ.data.possiblePrepaids.length + candQ.data.missingRecurring.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Nothing stands out this month.</p>
            )}
          </div>
        )}
      </section>

      {/* Schedules */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Schedules</h3>
        </div>
        {(schedulesQ.data?.schedules ?? []).length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">No schedules yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-2">Schedule</th><th className="px-4 py-2">Term</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Recognized</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(schedulesQ.data?.schedules ?? []).map((s) => (
                <tr key={s.id} className={s.status === 'active' ? '' : 'text-gray-400'}>
                  <td className="px-4 py-2">
                    <div className={s.status === 'active' ? 'text-gray-900' : ''}>{s.description}</div>
                    <div className="text-xs">{KIND_LABEL[s.kind]} · {s.balance_account_name} ↔ {s.recognition_account_name}{s.status !== 'active' ? ` · ${s.status}` : ''}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">{monthLabel(s.start_date)}, {s.months} mo · {METHOD_LABEL[s.method]}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(s.total_amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(s.posted_amount)}</td>
                  <td className="px-4 py-2 text-right">
                    {s.status === 'active' && Number(s.posted_count) === 0 && (
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this schedule?')) del.mutate(s.id, { onError: err }); }}>Delete</Button>
                    )}
                    {s.status === 'active' && Number(s.posted_count) > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm('Stop this schedule? Posted entries stay; future drafts are cancelled.')) cancel.mutate(s.id, { onError: err }); }}>Stop</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Tie-out */}
      {(tieQ.data?.rows ?? []).length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Tie-out at month end</h3>
            <p className="text-xs text-gray-500">The ledger balance of each schedule account against what the schedules say it should be.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr><th className="px-4 py-2">Account</th><th className="px-4 py-2 text-right">Books</th><th className="px-4 py-2 text-right">Schedules</th><th className="px-4 py-2 text-right">Difference</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(tieQ.data?.rows ?? []).map((r) => (
                <tr key={r.accountId}>
                  <td className="px-4 py-2">{r.accountName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(r.ledgerBalance)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(r.scheduleBalance)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${Number(r.difference) === 0 ? 'text-emerald-700' : 'font-medium text-amber-700'}`}>{money(r.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function ScheduleForm({ draft, setDraft, onDone }: { draft: Draft; setDraft: (d: Draft) => void; onDone: () => void }) {
  const create = useCreateAccrualSchedule();
  const toast = useToast();
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const preview = useMemo(() => {
    try {
      return buildAccrualSchedule({ totalAmount: draft.totalAmount || '0', startDate: draft.startDate, months: Number(draft.months), method: draft.method });
    } catch { return null; }
  }, [draft.totalAmount, draft.startDate, draft.months, draft.method]);

  const save = () => create.mutate({ ...draft, months: Number(draft.months), totalAmount: Number(draft.totalAmount).toFixed(2) }, {
    onSuccess: () => { toast.success('Schedule added.'); onDone(); },
    onError: (e: Error) => toast.error(e.message || 'Could not add the schedule.'),
  });

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4" aria-label="New accrual schedule">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">New schedule</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Type</span>
          <select value={draft.kind} onChange={(e) => set({ kind: e.target.value as AccrualKind })}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" aria-label="Schedule type">
            {(Object.keys(KIND_LABEL) as AccrualKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <Input label="Description" value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Annual liability policy" />
        <AccountSelector label={BALANCE_LABEL[draft.kind]} value={draft.balanceAccountId} onChange={(v) => set({ balanceAccountId: v })} />
        <AccountSelector label={RECOGNITION_LABEL[draft.kind]} value={draft.recognitionAccountId} onChange={(v) => set({ recognitionAccountId: v })} />
        <Input label="Total amount" value={draft.totalAmount} onChange={(e) => set({ totalAmount: e.target.value })} placeholder="1200.00" />
        <Input label="Service starts" type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        <Input label="Months" value={draft.months} onChange={(e) => set({ months: e.target.value })} />
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">How to split</span>
          <select value={draft.method} onChange={(e) => set({ method: e.target.value as AccrualMethod })}
            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" aria-label="Split method">
            {(Object.keys(METHOD_LABEL) as AccrualMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </label>
        <Input label="Catch up from (optional)" type="date" value={draft.postFrom ?? ''} onChange={(e) => set({ postFrom: e.target.value || null })} />
      </div>
      <p className="mt-2 text-xs text-gray-500">Catch up from: months before this date are posted together in this month.</p>
      {preview && preview.length > 0 && (
        <p className="mt-3 text-xs text-gray-700">
          {preview.length} month{preview.length === 1 ? '' : 's'}: {monthLabel(preview[0]!.periodStart)} {money(preview[0]!.amount)}
          {preview.length > 2 && <> · then {money(preview[1]!.amount)} a month</>}
          {preview.length > 1 && <> · {monthLabel(preview[preview.length - 1]!.periodStart)} {money(preview[preview.length - 1]!.amount)}</>}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={save} loading={create.isPending}
          disabled={!draft.description.trim() || !draft.balanceAccountId || !draft.recognitionAccountId || !preview}>
          Save schedule
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </section>
  );
}

function ImportPanel({ companyId, onDone }: { companyId: string | null; onDone: () => void }) {
  const imp = useImportAccruals();
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; error: string }> } | null>(null);
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="Import schedules">
      <h3 className="text-sm font-semibold text-gray-900">Import schedules from CSV</h3>
      <p className="mt-1 text-xs text-gray-500">
        Columns: kind (prepaid, deferred_revenue, accrued_expense, fixed_asset), description, balance account number,
        recognition account number, start month (YYYY-MM), remaining amount, remaining months, method (optional).
        The remaining amount is spread from the start month.
      </p>
      <input type="file" accept=".csv,text/csv" className="mt-2 text-sm" aria-label="CSV file"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
      <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
        className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-xs" aria-label="CSV text" />
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={!csv.trim()} loading={imp.isPending}
          onClick={() => imp.mutate({ companyId, csv }, {
            onSuccess: (r) => { setResult(r); toast.success(`Imported ${r.created} schedule${r.created === 1 ? '' : 's'}.`); },
            onError: (e: Error) => toast.error(e.message || 'Import failed.'),
          })}>Import</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Close</Button>
      </div>
      {result && result.errors.length > 0 && (
        <ul className="mt-2 text-xs text-red-700">
          {result.errors.map((e) => <li key={e.row}>Row {e.row}: {e.error}</li>)}
        </ul>
      )}
    </section>
  );
}
