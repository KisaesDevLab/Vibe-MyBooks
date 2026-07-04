// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 17.4 + 17.5 — portal-side
// list of published reports plus an interactive in-page renderer
// for the data snapshot. No transaction-level detail (Double model).

interface PublishedReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string;
  version: number;
  pdfUrl: string | null;
  data: Record<string, unknown> | null;
  layout: unknown[] | null;
}

export function PortalFinancialsPage() {
  const { activeCompanyId } = usePortal();
  const [reports, setReports] = useState<PublishedReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 403 is an access state ("not enabled"), not a transient failure —
  // only transient failures get a Retry button.
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    setReports(null);
    setError(null);
    setRetryable(false);
    // BASE_URL prefix (trailing slash included) keeps this working on
    // appliance subpath installs (/mybooks/api/portal/...), matching
    // every other portal fetch (see PortalLayout.tsx).
    fetch(`${import.meta.env.BASE_URL}api/portal/financials?companyId=${activeCompanyId}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (r.status === 403) {
          if (!cancelled) setError('Financial reports are not enabled for your account.');
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d && !cancelled) setReports(d.reports);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load reports.');
          setRetryable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, attempt]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          {retryable && (
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-2 text-sm font-medium text-amber-900 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Financials</h1>
      <p className="text-sm text-gray-600 mb-6">
        Reports your bookkeeper has published for you. Click any report to view its details.
      </p>

      {!reports ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <FileText className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No reports published yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            // Only the header row toggles the report open/closed. The
            // expanded snapshot is a sibling of the toggle button (never
            // nested inside it) so clicks inside the open report don't
            // collapse it, and the PDF link isn't an <a> inside a <button>.
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between gap-3 p-4">
                <button
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  aria-expanded={openId === r.id}
                  className="flex-1 text-left rounded-md hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {r.periodStart} → {r.periodEnd}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Published {new Date(r.publishedAt).toLocaleDateString()} · v{r.version}
                  </p>
                </button>
                {r.pdfUrl && (
                  <a
                    href={`${import.meta.env.BASE_URL}api/portal/financials/${r.id}/download`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline flex-shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                )}
              </div>
              {openId === r.id && r.data && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                  <ReportSnapshot data={r.data} layout={r.layout ?? []} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Compact axis-tick labels ($1.2M / $340k) so big numbers don't clip in
// the fixed-width Y axis. Tooltips keep the full-precision fmtMoney.
function fmtMoneyTick(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const trim = (x: number) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}k`;
  return `${sign}$${Math.round(abs)}`;
}

// F7 — red/amber/green target dot on KPI tiles (parity with the
// builder preview + PDF). No status → no dot.
const KPI_STATUS_COLORS: Record<string, string> = {
  green: 'bg-green-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};

function KpiStatusDot({ status }: { status?: string }) {
  const color = status ? KPI_STATUS_COLORS[status] : undefined;
  if (!color) return null;
  return (
    <span
      title={`Status: ${status}`}
      className={`inline-block h-2 w-2 rounded-full mr-1.5 align-middle ${color}`}
    />
  );
}

function ReportSnapshot({ data, layout }: { data: Record<string, unknown>; layout: unknown[] }) {
  const kpiValues = (data['kpis'] as Record<string, unknown>) ?? {};
  const kpiNames = (data['kpi_names'] as Record<string, string>) ?? {};
  const kpiStatus = (data['kpi_status'] as Record<string, string>) ?? {};
  const aiSummary = (data['ai_summary'] as string) ?? '';
  const textOverrides = (data['text_overrides'] as Record<string, string>) ?? {};
  const blocks = (data['blocks'] as Record<string, { type: string; data?: unknown; error?: string }>) ?? {};

  return (
    <div className="space-y-4">
      {layout.map((blockRaw, i) => {
        const block = blockRaw as Record<string, unknown>;
        const t = block['type'] as string;
        const blockId = (block['id'] as string | undefined) ?? `idx-${i}`;
        if (t === 'kpi-row') {
          const keys = (block['kpis'] as string[]) ?? [];
          if (keys.length === 0) {
            // Parity with the builder preview's empty-row hint.
            return (
              <p key={blockId} className="text-xs text-gray-500 italic">
                No KPIs selected.
              </p>
            );
          }
          return (
            <div key={blockId} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {keys.map((k) => (
                <div key={k} className="rounded border border-gray-200 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    {kpiNames[k] ?? k.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-gray-900">
                    <KpiStatusDot status={kpiStatus[k]} />
                    {kpiValues[k] != null ? String(kpiValues[k]) : '—'}
                  </p>
                </div>
              ))}
            </div>
          );
        }
        if (t === 'ai_summary') {
          return (
            <div key={blockId} className="text-sm text-gray-800 whitespace-pre-wrap">
              {aiSummary || <em className="text-gray-500">No summary saved.</em>}
            </div>
          );
        }
        if (t === 'text') {
          const overrideKey = (block['id'] as string | undefined) ?? String(i);
          const override = textOverrides[overrideKey] ?? textOverrides[String(i)];
          const label = override ?? (block['placeholder'] as string) ?? '';
          if (!label) return null;
          return (
            <p key={blockId} className="text-sm text-gray-800 whitespace-pre-wrap">
              {label}
            </p>
          );
        }
        if (t === 'image') {
          const src = (block['src'] as string) ?? '';
          if (!src) return null;
          return (
            <img
              key={blockId}
              src={src}
              alt=""
              className="max-w-full rounded"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          );
        }
        if (t === 'block' || t === 'chart' || t === 'report' || t === 'tag-segment') {
          const payloadKey =
            (block['id'] as string | undefined) ??
            (block['name'] as string | undefined) ??
            (block['report'] as string | undefined) ??
            (block['key'] as string | undefined) ??
            'unknown';
          const payload = blocks[payloadKey];
          return <PortalBlockRender key={blockId} block={block} payload={payload} />;
        }
        return null;
      })}
    </div>
  );
}

interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}
interface PlSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpense: number;
  netIncome: number;
}
interface BsSections {
  currentAssets: number;
  fixedAssets: number;
  otherAssets: number;
  currentLiabilities: number;
  longTermLiabilities: number;
}
interface BsSummary { assets: number; liabilities: number; equity: number; sections?: BsSections }
interface PlVsPriorYear { current: PlSummary; prior: PlSummary | null }
interface BudgetVsActualSummary {
  budgetName: string;
  fiscalYear: number;
  rows: Array<{ account: string; budgeted: number; actual: number; variance: number; variancePct: number | null }>;
  totals: { budgeted: number; actual: number; variance: number };
  truncated: boolean;
}
interface TagSegmentRow { tagId: string; tagName: string; revenue: number; expenses: number; netIncome: number }
interface SalesTaxSummary { totalSales: number; totalTax: number }
interface TopRow { name: string; amount: number }
interface TrendPoint { month: string; label: string; amount: number }
interface CfSummary { netIncome: number; operating: number; investing: number; financing: number; netChange: number }
interface TbSummary {
  rows: Array<{ account: string; debit: number; credit: number }>;
  totalDebits: number;
  totalCredits: number;
  truncated: boolean;
}
interface BankBalancesSummary {
  asOfDate: string;
  accounts: Array<{ name: string; balance: number; isInactive: boolean }>;
  totalBalance: number;
}

function PortalBlockRender({
  block,
  payload,
}: {
  block: Record<string, unknown>;
  payload: { type: string; data?: unknown; error?: string } | undefined;
}) {
  const name =
    (block['name'] as string | undefined) ??
    (block['report'] as string | undefined) ??
    (block['key'] as string | undefined) ??
    'Section';
  if (!payload || payload.error) {
    // For client-facing portal we silently skip errored blocks rather
    // than show technical messages.
    return null;
  }
  const friendly = name.replace(/_/g, ' ');
  switch (payload.type) {
    case 'top_customers':
    case 'top_vendors':
    case 'expense_by_category': {
      const rows = (payload.data as TopRow[]) ?? [];
      if (rows.length === 0) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
            {payload.type === 'top_customers'
              ? 'Top customers'
              : payload.type === 'top_vendors'
                ? 'Top vendors'
                : 'Expenses by category'}
          </p>
          <ul className="text-sm divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.name} className="flex justify-between py-1">
                <span className="text-gray-800">{r.name}</span>
                <span className="text-gray-900 font-medium">{fmtMoney(r.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case 'ar_aging':
    case 'ap_aging': {
      const b = (payload.data as AgingBuckets) ?? null;
      if (!b || b.total === 0) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
            {payload.type === 'ar_aging' ? 'Receivables aging' : 'Payables aging'}
          </p>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <AgingCell label="Current" v={b.current} />
            <AgingCell label="1–30" v={b.days1to30} />
            <AgingCell label="31–60" v={b.days31to60} />
            <AgingCell label="61–90" v={b.days61to90} />
            <AgingCell label="90+" v={b.over90} />
          </div>
          <p className="mt-1 text-right text-xs text-gray-700">
            Total <strong>{fmtMoney(b.total)}</strong>
          </p>
        </section>
      );
    }
    case 'pl_bar': {
      const p = (payload.data as PlSummary) ?? null;
      if (!p) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Profit &amp; loss</p>
          <PortalPlBarChart p={p} />
        </section>
      );
    }
    case 'profit_loss': {
      const p = (payload.data as PlSummary) ?? null;
      if (!p) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Profit &amp; loss</p>
          <PortalPlTable p={p} />
        </section>
      );
    }
    case 'balance_sheet': {
      const b = (payload.data as BsSummary) ?? null;
      if (!b) return null;
      const s = b.sections;
      const sub = (label: string, v: number) => (
        <tr key={label}>
          <td className="py-0.5 pl-4 text-xs text-gray-500">{label}</td>
          <td className="py-0.5 text-right text-xs text-gray-600">{fmtMoney(v)}</td>
        </tr>
      );
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Balance sheet</p>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-700">Total assets</td><td className="py-1 text-right font-medium">{fmtMoney(b.assets)}</td></tr>
              {s && sub('Current assets', s.currentAssets)}
              {s && sub('Fixed assets', s.fixedAssets)}
              {s && sub('Other assets', s.otherAssets)}
              <tr><td className="py-1 text-gray-700">Total liabilities</td><td className="py-1 text-right font-medium">{fmtMoney(b.liabilities)}</td></tr>
              {s && sub('Current liabilities', s.currentLiabilities)}
              {s && sub('Long-term liabilities', s.longTermLiabilities)}
              <tr><td className="py-1 text-gray-700">Total equity</td><td className="py-1 text-right font-medium">{fmtMoney(b.equity)}</td></tr>
            </tbody>
          </table>
        </section>
      );
    }
    case 'pl_vs_prior_year': {
      const d = (payload.data as PlVsPriorYear) ?? null;
      if (!d) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">P&amp;L vs. prior year</p>
          <PortalPlVsPriorChart d={d} />
        </section>
      );
    }
    case 'revenue_trend_12m':
    case 'expense_trend_12m':
    case 'cash_balance_trend':
    case 'net_income_trend_12m':
    case 'gross_margin_trend_12m': {
      const pts = (payload.data as TrendPoint[]) ?? [];
      if (pts.length === 0) return null;
      const heading =
        payload.type === 'revenue_trend_12m'
          ? 'Revenue trend (12 months)'
          : payload.type === 'expense_trend_12m'
            ? 'Expense trend (12 months)'
            : payload.type === 'net_income_trend_12m'
              ? 'Net income trend (12 months)'
              : payload.type === 'gross_margin_trend_12m'
                ? 'Gross margin % trend (12 months)'
                : 'Cash balance trend (12 months)';
      const color =
        payload.type === 'expense_trend_12m'
          ? '#f59e0b'
          : payload.type === 'cash_balance_trend'
            ? '#0ea5e9'
            : payload.type === 'net_income_trend_12m' || payload.type === 'gross_margin_trend_12m'
              ? '#16a34a'
              : '#4f46e5';
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{heading}</p>
          <PortalTrendChart
            points={pts}
            color={color}
            percent={payload.type === 'gross_margin_trend_12m'}
          />
        </section>
      );
    }
    case 'cash_flow': {
      const c = (payload.data as CfSummary) ?? null;
      if (!c) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Cash flow</p>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-700">Operating activities</td><td className="py-1 text-right font-medium">{fmtMoney(c.operating)}</td></tr>
              <tr><td className="py-1 text-gray-700">Investing activities</td><td className="py-1 text-right">{fmtMoney(c.investing)}</td></tr>
              <tr><td className="py-1 text-gray-700">Financing activities</td><td className="py-1 text-right">{fmtMoney(c.financing)}</td></tr>
              <tr className="border-t border-gray-200"><td className="py-1 text-gray-900 font-semibold">Net change in cash</td><td className="py-1 text-right font-bold">{fmtMoney(c.netChange)}</td></tr>
              <tr><td className="py-1 text-gray-500 text-xs">Net income (accrual)</td><td className="py-1 text-right text-xs text-gray-500">{fmtMoney(c.netIncome)}</td></tr>
            </tbody>
          </table>
        </section>
      );
    }
    case 'trial_balance': {
      const t = (payload.data as TbSummary) ?? null;
      if (!t || t.rows.length === 0) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Trial balance</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                <th className="text-left py-1 font-semibold">Account</th>
                <th className="text-right py-1 font-semibold">Debit</th>
                <th className="text-right py-1 font-semibold">Credit</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.account} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 pr-2 text-gray-800">{r.account}</td>
                  <td className="py-1 text-right text-gray-900">{r.debit !== 0 ? fmtMoney(r.debit) : ''}</td>
                  <td className="py-1 text-right text-gray-900">{r.credit !== 0 ? fmtMoney(r.credit) : ''}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="py-1 text-gray-900">Totals</td>
                <td className="py-1 text-right">{fmtMoney(t.totalDebits)}</td>
                <td className="py-1 text-right">{fmtMoney(t.totalCredits)}</td>
              </tr>
            </tbody>
          </table>
          {t.truncated && (
            <p className="mt-1 text-[11px] text-gray-500">
              Showing the first {t.rows.length} accounts.
            </p>
          )}
        </section>
      );
    }
    case 'bank_balances': {
      const b = (payload.data as BankBalancesSummary) ?? null;
      if (!b || b.accounts.length === 0) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Bank account balances</p>
          <table className="w-full text-sm">
            <tbody>
              {b.accounts.map((a) => (
                <tr key={a.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 pr-2 text-gray-800">{a.name}</td>
                  <td className="py-1 text-right text-gray-900 font-medium">{fmtMoney(a.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="py-1 text-gray-900">Total</td>
                <td className="py-1 text-right">{fmtMoney(b.totalBalance)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      );
    }
    case 'budget_vs_actual': {
      const d = (payload.data as BudgetVsActualSummary) ?? null;
      if (!d || d.rows.length === 0) return null;
      const varClass = (v: number) => (v < 0 ? 'text-red-600' : 'text-gray-900');
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
            Budget vs. actual — {d.budgetName}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                <th className="text-left py-1 font-semibold">Account</th>
                <th className="text-right py-1 font-semibold">Budget</th>
                <th className="text-right py-1 font-semibold">Actual</th>
                <th className="text-right py-1 font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.account} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 pr-2 text-gray-800">{r.account}</td>
                  <td className="py-1 text-right text-gray-900">{fmtMoney(r.budgeted)}</td>
                  <td className="py-1 text-right text-gray-900">{fmtMoney(r.actual)}</td>
                  <td className={`py-1 text-right font-medium ${varClass(r.variance)}`}>{fmtMoney(r.variance)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="py-1 text-gray-900">Net income</td>
                <td className="py-1 text-right">{fmtMoney(d.totals.budgeted)}</td>
                <td className="py-1 text-right">{fmtMoney(d.totals.actual)}</td>
                <td className={`py-1 text-right ${varClass(d.totals.variance)}`}>{fmtMoney(d.totals.variance)}</td>
              </tr>
            </tbody>
          </table>
          {d.truncated && (
            <p className="mt-1 text-[11px] text-gray-500">
              Showing the first {d.rows.length} budget lines.
            </p>
          )}
        </section>
      );
    }
    case 'tag_segments': {
      const rows = (payload.data as TagSegmentRow[]) ?? [];
      if (rows.length === 0) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Tag segments</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                <th className="text-left py-1 font-semibold">Segment</th>
                <th className="text-right py-1 font-semibold">Revenue</th>
                <th className="text-right py-1 font-semibold">Expenses</th>
                <th className="text-right py-1 font-semibold">Net income</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tagId} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 pr-2 text-gray-800">{r.tagName}</td>
                  <td className="py-1 text-right text-gray-900">{fmtMoney(r.revenue)}</td>
                  <td className="py-1 text-right text-gray-900">{fmtMoney(r.expenses)}</td>
                  <td className={`py-1 text-right font-medium ${r.netIncome < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {fmtMoney(r.netIncome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    }
    case 'sales_tax': {
      const s = (payload.data as SalesTaxSummary) ?? null;
      if (!s) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Sales tax liability</p>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-700">Taxable sales</td><td className="py-1 text-right">{fmtMoney(s.totalSales)}</td></tr>
              <tr className="border-t border-gray-200"><td className="py-1 text-gray-900 font-semibold">Sales tax collected</td><td className="py-1 text-right font-bold">{fmtMoney(s.totalTax)}</td></tr>
            </tbody>
          </table>
        </section>
      );
    }
    default:
      return (
        <div className="text-sm text-gray-700 border-l-2 border-gray-200 pl-3">{friendly}</div>
      );
  }
}

function AgingCell({ label, v }: { label: string; v: number }) {
  return (
    <div className="border border-gray-200 rounded p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{fmtMoney(v)}</p>
    </div>
  );
}
function PortalPlBarChart({ p }: { p: PlSummary }) {
  const data = [
    { name: 'Revenue', amount: p.revenue },
    { name: 'COGS', amount: p.cogs },
    { name: 'Gross Profit', amount: p.grossProfit },
    { name: 'Op. Expense', amount: p.operatingExpense },
    { name: 'Net Income', amount: p.netIncome },
  ];
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={fmtMoneyTick}
            width={70}
          />
          <Tooltip formatter={((v: unknown) => fmtMoney(Number(v))) as never} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.amount < 0 ? '#dc2626' : '#4f46e5'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PortalTrendChart({
  points,
  color,
  percent,
}: {
  points: TrendPoint[];
  color: string;
  percent?: boolean;
}) {
  const data = points.map((p) => ({ name: p.label, amount: p.amount }));
  const fmtPctTick = (v: unknown) => `${Number(v)}%`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-40} textAnchor="end" height={38} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={percent ? fmtPctTick : fmtMoneyTick} width={70} />
          <Tooltip
            formatter={((v: unknown) =>
              percent ? fmtPct(Number(v)) : fmtMoney(Number(v))) as never}
          />
          <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={entry.amount < 0 ? '#dc2626' : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PortalPlVsPriorChart({ d }: { d: PlVsPriorYear }) {
  const data = [
    { name: 'Revenue',     Current: d.current.revenue,          'Prior YR': d.prior?.revenue ?? 0 },
    { name: 'COGS',        Current: d.current.cogs,             'Prior YR': d.prior?.cogs ?? 0 },
    { name: 'Gross Profit',Current: d.current.grossProfit,      'Prior YR': d.prior?.grossProfit ?? 0 },
    { name: 'Op. Expense', Current: d.current.operatingExpense, 'Prior YR': d.prior?.operatingExpense ?? 0 },
    { name: 'Net Income',  Current: d.current.netIncome,        'Prior YR': d.prior?.netIncome ?? 0 },
  ];
  return (
    <div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtMoneyTick} width={70} />
            <Tooltip formatter={((v: unknown) => fmtMoney(Number(v))) as never} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Current" fill="#4f46e5" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Prior YR" fill="#9ca3af" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!d.prior && (
        <p className="mt-1 text-[11px] text-amber-700">
          No prior-year data on file — Prior YR bars show 0.
        </p>
      )}
    </div>
  );
}

function PortalPlTable({ p }: { p: PlSummary }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr><td className="py-1 text-gray-700">Revenue</td><td className="py-1 text-right font-medium">{fmtMoney(p.revenue)}</td></tr>
        <tr><td className="py-1 text-gray-700">COGS</td><td className="py-1 text-right">{fmtMoney(p.cogs)}</td></tr>
        <tr><td className="py-1 text-gray-700">Gross profit</td><td className="py-1 text-right font-medium">{fmtMoney(p.grossProfit)}</td></tr>
        <tr><td className="py-1 text-gray-700">Operating expense</td><td className="py-1 text-right">{fmtMoney(p.operatingExpense)}</td></tr>
        <tr className="border-t border-gray-200"><td className="py-1 text-gray-900 font-semibold">Net income</td><td className="py-1 text-right font-bold">{fmtMoney(p.netIncome)}</td></tr>
      </tbody>
    </table>
  );
}

export default PortalFinancialsPage;
