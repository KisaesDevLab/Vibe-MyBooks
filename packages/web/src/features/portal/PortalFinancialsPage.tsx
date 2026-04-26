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
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    setReports(null);
    setError(null);
    fetch(`/api/portal/financials?companyId=${activeCompanyId}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (r.status === 403) {
          setError('Financial reports are not enabled for your account.');
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d) setReports(d.reports);
      })
      .catch(() => setError('Failed to load reports.'));
  }, [activeCompanyId]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
          {error}
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
        <p className="text-sm text-gray-500">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <FileText className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No reports published yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenId(openId === r.id ? null : r.id)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {r.periodStart} → {r.periodEnd}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Published {new Date(r.publishedAt).toLocaleDateString()} · v{r.version}
                  </p>
                </div>
                {r.pdfUrl && (
                  <a
                    href={`/api/portal/financials/${r.id}/download`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                )}
              </div>
              {openId === r.id && r.data && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <ReportSnapshot data={r.data} layout={r.layout ?? []} />
                </div>
              )}
            </button>
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

function ReportSnapshot({ data, layout }: { data: Record<string, unknown>; layout: unknown[] }) {
  const kpiValues = (data['kpis'] as Record<string, unknown>) ?? {};
  const kpiNames = (data['kpi_names'] as Record<string, string>) ?? {};
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
          return (
            <div key={blockId} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {keys.map((k) => (
                <div key={k} className="rounded border border-gray-200 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    {kpiNames[k] ?? k.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-gray-900">
                    {kpiValues[k] !== undefined ? String(kpiValues[k]) : '—'}
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
        if (t === 'block' || t === 'chart' || t === 'report') {
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
interface BsSummary { assets: number; liabilities: number; equity: number }
interface PlVsPriorYear { current: PlSummary; prior: PlSummary | null }
interface TopRow { name: string; amount: number }

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
    case 'top_vendors': {
      const rows = (payload.data as TopRow[]) ?? [];
      if (rows.length === 0) return null;
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
            {payload.type === 'top_customers' ? 'Top customers' : 'Top vendors'}
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
      return (
        <section className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Balance sheet</p>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-700">Total assets</td><td className="py-1 text-right font-medium">{fmtMoney(b.assets)}</td></tr>
              <tr><td className="py-1 text-gray-700">Total liabilities</td><td className="py-1 text-right font-medium">{fmtMoney(b.liabilities)}</td></tr>
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
            tickFormatter={(v: unknown) => fmtMoney(Number(v))}
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
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: unknown) => fmtMoney(Number(v))} width={70} />
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
