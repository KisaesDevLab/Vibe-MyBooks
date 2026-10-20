// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
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

  const section = (label: string, entries: PLEntry[], total: number) => (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden" key={label}>
      <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50">{label}</h2>
      <ul className="divide-y divide-gray-100">
        {entries.map((e) => (
          <li key={e.accountId}>
            <button
              type="button"
              onClick={() => setDrill(e)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
              aria-label={`${e.name}, ${money.format(e.amount)}. View transactions`}
            >
              <span className="text-gray-900 truncate">{e.name}</span>
              <span className="tabular-nums text-gray-900 shrink-0">{money.format(e.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 text-sm font-semibold">
        <span>Total {label}</span>
        <span className="tabular-nums">{money.format(total)}</span>
      </div>
    </section>
  );

  const subtotal = (label: string, value: number | null) => (
    value === null ? null : (
      <div className="flex items-center justify-between px-4 py-2 text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg" key={label}>
        <span>{label}</span>
        <span className="tabular-nums">{money.format(value)}</span>
      </div>
    )
  );

  return (
    <div className="space-y-4">
      <div>
        <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Profit &amp; Loss</h1>
        <p className="text-sm text-gray-500">
          Live from the books{data ? ` (${data.basis} basis)` : ''}. Select a line to see its transactions.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                preset === p.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">
            From
            <input
              type="date"
              value={start}
              onChange={(e) => { setStart(e.target.value); setPreset(null); }}
              className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            To
            <input
              type="date"
              value={end}
              onChange={(e) => { setEnd(e.target.value); setPreset(null); }}
              className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>
        {!rangeValid && <p className="text-xs text-red-600">Choose a start date on or before the end date.</p>}
      </div>

      {loading && (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No income or expenses were recorded between {formatDay(data.startDate)} and {formatDay(data.endDate)}.
        </div>
      )}

      {!loading && !error && data && hasRows && (
        <div className="space-y-3">
          {section(data.labels.revenue, data.revenue, data.totalRevenue)}
          {data.cogs.length > 0 && section(data.labels.cogs, data.cogs, data.totalCogs)}
          {data.cogs.length > 0 && subtotal(data.labels.grossProfit, data.grossProfit)}
          {section(data.labels.expenses, data.expenses, data.totalExpenses)}
          {data.otherRevenue.length > 0 && section(data.labels.otherRevenue, data.otherRevenue, data.totalOtherRevenue)}
          {data.otherExpenses.length > 0 && section(data.labels.otherExpenses, data.otherExpenses, data.totalOtherExpenses)}
          <div className="flex items-center justify-between px-4 py-3 text-base font-semibold bg-gray-900 text-white rounded-lg">
            <span>{data.labels.netIncome}</span>
            <span className="tabular-nums">{money.format(data.netIncome)}</span>
          </div>
        </div>
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
