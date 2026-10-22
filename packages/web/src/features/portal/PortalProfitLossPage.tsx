// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

// Live Profit & Loss for the portal (per-contact `profitLossAccess`).
// Date range + presets; every account row drills into the transactions
// behind it; each transaction can be turned into a question for the
// bookkeeper through the existing Questions-for-Us endpoint.

interface PLEntry {
  accountId: string;
  name: string;
  accountNumber: string | null;
  amount: number;
}

interface PLData {
  startDate: string;
  endDate: string;
  basis: 'cash' | 'accrual';
  labels: {
    revenue: string; cogs: string; grossProfit: string; expenses: string;
    operatingIncome: string; otherRevenue: string; otherExpenses: string; netIncome: string;
  };
  revenue: PLEntry[]; totalRevenue: number;
  cogs: PLEntry[]; totalCogs: number;
  expenses: PLEntry[]; totalExpenses: number;
  otherRevenue: PLEntry[]; totalOtherRevenue: number;
  otherExpenses: PLEntry[]; totalOtherExpenses: number;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number;
}

interface TxnLine {
  transactionId: string;
  date: string;
  type: string;
  number: string | null;
  payee: string | null;
  memo: string | null;
  amount: number;
}

interface TxnPage {
  account: { id: string; name: string; accountNumber: string | null };
  items: TxnLine[];
  total: number;
  sum: number;
  page: number;
  perPage: number;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

type PresetKey = 'this-month' | 'last-month' | 'ytd' | 'last-year';

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'last-year', label: 'Last year' },
];

function presetRange(key: PresetKey): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'this-month': return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    case 'last-month': return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    case 'ytd': return { start: iso(new Date(y, 0, 1)), end: iso(now) };
    case 'last-year': return { start: iso(new Date(y - 1, 0, 1)), end: iso(new Date(y - 1, 11, 31)) };
  }
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function humanType(t: string): string {
  return t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const msg = body?.error?.message ?? body?.message;
    if (typeof msg === 'string' && msg) return msg;
  } catch { /* non-JSON body */ }
  return `Something went wrong (HTTP ${res.status}).`;
}

export function PortalProfitLossPage() {
  const { activeCompanyId, me } = usePortal();
  const isPreview = !!me.preview;
  const canAsk = !isPreview
    && !!me.contact.companies.find((c) => c.companyId === activeCompanyId)?.questionsForUsAccess;

  const initial = presetRange('this-month');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [preset, setPreset] = useState<PresetKey | null>('this-month');
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [drill, setDrill] = useState<PLEntry | null>(null);

  const rangeValid = !!start && !!end && start <= end;

  useEffect(() => {
    if (!activeCompanyId || !rangeValid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ companyId: activeCompanyId, start_date: start, end_date: end });
    fetch(`${import.meta.env.BASE_URL}api/portal/profit-loss?${qs}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(await errorMessage(r));
        return r.json() as Promise<PLData>;
      })
      .then((body) => { if (!cancelled) setData(body); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeCompanyId, start, end, rangeValid, attempt]);

  const applyPreset = (key: PresetKey) => {
    const r = presetRange(key);
    setStart(r.start);
    setEnd(r.end);
    setPreset(key);
  };

  const hasRows = !!data && (
    data.revenue.length + data.cogs.length + data.expenses.length
    + data.otherRevenue.length + data.otherExpenses.length > 0
  );

  // Share of revenue, shown beside each line on wider screens.
  const pct = (v: number) => (data && data.totalRevenue > 0 ? `${((v / data.totalRevenue) * 100).toFixed(1)}%` : '');

  const section = (label: string, entries: PLEntry[], total: number) => (
    <tbody key={label}>
      <tr>
        <th colSpan={3} scope="colgroup" className="pt-5 pb-1.5 px-4 sm:px-6 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </th>
      </tr>
      {entries.map((e) => (
        <tr key={e.accountId} className="group">
          <td colSpan={3} className="p-0">
            <button
              type="button"
              onClick={() => setDrill(e)}
              className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_4.5rem_8rem] items-center gap-3 py-2 pl-7 pr-4 sm:pl-9 sm:pr-6 text-left text-sm hover:bg-blue-50/60 focus:bg-blue-50/60 focus:outline-none"
              aria-label={`${e.name}, ${money.format(e.amount)}. View transactions`}
            >
              <span className="flex items-center gap-1.5 min-w-0 text-gray-800">
                <span className="truncate">{e.name}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-blue-500" aria-hidden="true" />
              </span>
              <span className="hidden sm:block text-right text-xs tabular-nums text-gray-400">{pct(e.amount)}</span>
              <span className="text-right tabular-nums text-gray-900">{money.format(e.amount)}</span>
            </button>
          </td>
        </tr>
      ))}
      <tr className="text-sm font-semibold text-gray-900">
        <td className="py-2 pl-4 sm:pl-6 border-t border-gray-200">Total {label}</td>
        <td className="hidden sm:table-cell py-2 w-[4.5rem] text-right text-xs font-normal tabular-nums text-gray-400 border-t border-gray-200">{pct(total)}</td>
        <td className="py-2 pr-4 sm:pr-6 w-32 text-right tabular-nums border-t border-gray-200">{money.format(total)}</td>
      </tr>
    </tbody>
  );

  const subtotal = (label: string, value: number | null) => (
    value === null ? null : (
      <tbody key={label}>
        <tr className="text-sm font-semibold text-gray-900 bg-gray-50">
          <td className="py-2.5 pl-4 sm:pl-6">{label}</td>
          <td className="hidden sm:table-cell py-2.5 text-right text-xs font-normal tabular-nums text-gray-400">{pct(value)}</td>
          <td className="py-2.5 pr-4 sm:pr-6 text-right tabular-nums">{money.format(value)}</td>
        </tr>
      </tbody>
    )
  );

  const netLoss = !!data && data.netIncome < 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Profit &amp; Loss</h1>
          {data && (
            <p className="text-sm text-gray-500">
              {formatDay(data.startDate)} – {formatDay(data.endDate)}
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">{data.basis} basis</span>
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">Live from the books. Select a line to see the transactions behind it.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div role="group" aria-label="Date range presets" className="inline-flex flex-wrap rounded-lg bg-gray-100 p-1 gap-1 self-start">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={preset === p.key}
              onClick={() => applyPreset(p.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                preset === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-medium text-gray-600">
            From
            <input
              type="date"
              value={start}
              onChange={(e) => { setStart(e.target.value); setPreset(null); }}
              className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <span className="pb-2 text-gray-400" aria-hidden="true">–</span>
          <label className="text-xs font-medium text-gray-600">
            To
            <input
              type="date"
              value={end}
              onChange={(e) => { setEnd(e.target.value); setPreset(null); }}
              className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>
      {!rangeValid && <p className="text-xs text-red-600">Choose a start date on or before the end date.</p>}

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading profit and loss">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 rounded bg-red-600 px-3 py-1 text-white text-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && !hasRows && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No income or expenses were recorded between {formatDay(data.startDate)} and {formatDay(data.endDate)}.
        </div>
      )}

      {!loading && !error && data && hasRows && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile label={data.labels.revenue} value={data.totalRevenue + data.totalOtherRevenue} />
            <SummaryTile label={data.labels.expenses} value={data.totalCogs + data.totalExpenses + data.totalOtherExpenses} />
            <SummaryTile label={data.labels.netIncome} value={data.netIncome} tone={netLoss ? 'negative' : 'positive'} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="sr-only">
                <tr><th scope="col">Account</th><th scope="col">% of revenue</th><th scope="col">Amount</th></tr>
              </thead>
              {section(data.labels.revenue, data.revenue, data.totalRevenue)}
              {data.cogs.length > 0 && section(data.labels.cogs, data.cogs, data.totalCogs)}
              {data.cogs.length > 0 && subtotal(data.labels.grossProfit, data.grossProfit)}
              {section(data.labels.expenses, data.expenses, data.totalExpenses)}
              {data.otherRevenue.length > 0 && section(data.labels.otherRevenue, data.otherRevenue, data.totalOtherRevenue)}
              {data.otherExpenses.length > 0 && section(data.labels.otherExpenses, data.otherExpenses, data.totalOtherExpenses)}
              <tbody>
                <tr className={`text-base font-semibold border-t-2 ${netLoss ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-900 bg-gray-50 text-gray-900'}`}>
                  <td className="py-3.5 pl-4 sm:pl-6">{data.labels.netIncome}</td>
                  <td className="hidden sm:table-cell py-3.5 text-right text-xs font-normal tabular-nums text-gray-500">{pct(data.netIncome)}</td>
                  <td className="py-3.5 pr-4 sm:pr-6 text-right tabular-nums">{money.format(data.netIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">Percentages are shares of total revenue.</p>
        </>
      )}

      {drill && activeCompanyId && (
        <AccountTransactionsModal
          companyId={activeCompanyId}
          entry={drill}
          start={start}
          end={end}
          canAsk={canAsk}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: 'positive' | 'negative' }) {
  const color = tone === 'negative' ? 'text-red-700' : tone === 'positive' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 sm:px-4">
      <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className={`mt-1 text-base sm:text-xl font-semibold tabular-nums ${color}`}>{money.format(value)}</p>
    </div>
  );
}

function AccountTransactionsModal({
  companyId, entry, start, end, canAsk, onClose,
}: {
  companyId: string;
  entry: PLEntry;
  start: string;
  end: string;
  canAsk: boolean;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<TxnLine[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [askingId, setAskingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, string>>({});

  const load = useCallback(async (p: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        companyId, start_date: start, end_date: end, page: String(p), perPage: '50',
      });
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/portal/profit-loss/accounts/${entry.accountId}/transactions?${qs}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = (await res.json()) as TxnPage;
      setLines((prev) => (replace ? body.items : [...prev, ...body.items]));
      setTotal(body.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load transactions.');
    } finally {
      setLoading(false);
    }
  }, [companyId, entry.accountId, start, end]);

  useEffect(() => { void load(1, true); }, [load, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.name} transactions`}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{entry.name}</h2>
            <p className="text-xs text-gray-500">
              {formatDay(start)} – {formatDay(end)} · {money.format(entry.amount)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="mt-2 rounded bg-red-600 px-3 py-1 text-white text-xs hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!error && !loading && lines.length === 0 && (
            <p className="p-8 text-center text-sm text-gray-500">No transactions in this date range.</p>
          )}

          <ul className="divide-y divide-gray-100">
            {lines.map((l, i) => {
              const key = `${l.transactionId}:${i}`;
              return (
                <li key={key} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-gray-900 truncate">{l.payee ?? humanType(l.type)}</p>
                      <p className="text-xs text-gray-500">
                        {formatDay(l.date)} · {humanType(l.type)}{l.number ? ` #${l.number}` : ''}
                      </p>
                      {l.memo && <p className="text-xs text-gray-500 truncate">{l.memo}</p>}
                    </div>
                    <p className="tabular-nums text-gray-900 shrink-0">{money.format(l.amount)}</p>
                  </div>

                  {canAsk && sentIds[l.transactionId] ? (
                    <p className="mt-2 text-xs text-green-700">
                      Question sent.{' '}
                      <Link to={`/portal/questions/${sentIds[l.transactionId]}`} className="underline">View it</Link>
                    </p>
                  ) : canAsk && askingId === key ? (
                    <AskForm
                      companyId={companyId}
                      line={l}
                      onCancel={() => setAskingId(null)}
                      onSent={(questionId) => {
                        setSentIds((prev) => ({ ...prev, [l.transactionId]: questionId }));
                        setAskingId(null);
                      }}
                    />
                  ) : canAsk ? (
                    <button
                      type="button"
                      onClick={() => setAskingId(key)}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Ask a question
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {loading && <div className="flex justify-center py-6"><LoadingSpinner /></div>}

          {!loading && !error && lines.length < total && (
            <div className="p-4 text-center">
              <button
                type="button"
                onClick={() => void load(page + 1, false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Load more ({total - lines.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AskForm({
  companyId, line, onCancel, onSent,
}: {
  companyId: string;
  line: TxnLine;
  onCancel: () => void;
  onSent: (questionId: string) => void;
}) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/questions/ask`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, body: body.trim(), transactionId: line.transactionId }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const out = (await res.json()) as { id: string };
      onSent(out.id);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not send your question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        rows={3}
        autoFocus
        placeholder="What would you like to know about this transaction?"
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        aria-label="Your question"
      />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send question'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
