// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PL_LABELS, type PLSectionLabels } from '@kis-books/shared';
import { apiClient } from '../../api/client';

// The /reports/profit-loss endpoint returns two shapes depending on whether
// a `compare=` parameter is set. Keep both unions permissive on optional
// sections — the view components branch on the fields they need.
interface PLRow {
  accountId?: string;
  accountNumber?: string | null;
  name: string;
  amount: number;
}

interface PLStandardData {
  startDate: string;
  endDate: string;
  labels?: PLSectionLabels;
  revenue: PLRow[];
  totalRevenue: number;
  cogs?: PLRow[];
  totalCogs?: number;
  grossProfit?: number;
  expenses: PLRow[];
  totalExpenses: number;
  operatingIncome?: number;
  otherRevenue?: PLRow[];
  totalOtherRevenue?: number;
  otherExpenses?: PLRow[];
  totalOtherExpenses?: number;
  netIncome: number;
  columns?: undefined;
}

interface PLComparativeColumn {
  label: string;
  type?: 'variance' | 'percent_variance' | string;
  startDate?: string;
  endDate?: string;
}

interface PLComparativeRow {
  accountId?: string;
  accountNumber?: string | null;
  account: string;
  accountType: string;
  values: Array<number | null>;
}

interface PLComparativeData {
  startDate: string;
  endDate: string;
  labels?: PLSectionLabels;
  columns: PLComparativeColumn[];
  rows: PLComparativeRow[];
  totalRevenue: number[];
  totalCogs: number[];
  totalExpenses: number[];
  totalOtherRevenue?: number[];
  totalOtherExpenses?: number[];
  netIncome: number[];
}

type PLData = PLStandardData | PLComparativeData;
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

// QuickZoom: build the /transactions URL that filters to a given account
// and date range. Returns null when the date range is unknown (variance /
// %-change columns), in which case the cell renders as non-clickable.
function drillUrl(accountId: string | undefined, startDate: string | undefined, endDate: string | undefined): string | null {
  if (!accountId || !startDate || !endDate) return null;
  const qs = new URLSearchParams({ account: accountId, from: startDate, to: endDate });
  return `/transactions?${qs.toString()}`;
}

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function fmtPct(n: number | null) { return n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`; }

type CompareMode = '' | 'previous_period' | 'previous_year' | 'multi_period';

export function ProfitAndLossReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]!);
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [compare, setCompare] = useState<CompareMode>('');
  const [scope, setScope] = useState<'company' | 'consolidated'>('company');
  const { activeCompanyId } = useCompanyContext();

  const queryParams = `start_date=${startDate}&end_date=${endDate}&basis=${basis}${compare ? `&compare=${compare}` : ''}${scope === 'consolidated' ? '&scope=consolidated' : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'profit-loss', startDate, endDate, basis, compare, activeCompanyId, scope],
    queryFn: () => apiClient<PLData>(`/reports/profit-loss?${queryParams}`),
  });

  const isComparative = compare && data && 'columns' in data && data.columns;

  return (
    <ReportShell title="Profit and Loss"
      maxWidth={isComparative ? 'max-w-6xl' : 'max-w-3xl'}
      exportBaseUrl={`/api/v1/reports/profit-loss?${queryParams}`}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <select value={basis} onChange={(e) => setBasis(e.target.value as 'accrual' | 'cash')}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </select>
          <select value={compare} onChange={(e) => setCompare(e.target.value as CompareMode)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">No Comparison</option>
            <option value="previous_period">vs. Previous Period</option>
            <option value="previous_year">vs. Previous Year</option>
            <option value="multi_period">Monthly Breakdown</option>
          </select>
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" /> : data && (
        isComparative
          ? <ComparativeView data={data as PLComparativeData} />
          : <StandardView data={data as PLStandardData} />
      )}
    </ReportShell>
  );
}

function StandardView({ data }: { data: PLStandardData }) {
  const navigate = useNavigate();
  const hasCogs = (data.cogs?.length ?? 0) > 0;
  const hasOtherRev = (data.otherRevenue?.length ?? 0) > 0;
  const hasOtherExp = (data.otherExpenses?.length ?? 0) > 0;
  const showOperatingIncome = hasCogs || hasOtherRev || hasOtherExp;

  const L = data.labels ?? DEFAULT_PL_LABELS;

  const DrillAmount = ({ accountId, amount }: { accountId: string | undefined; amount: number }) => {
    const href = drillUrl(accountId, data.startDate, data.endDate);
    if (!href) return <span className="font-mono">{fmt(amount)}</span>;
    return (
      <button
        type="button"
        onClick={() => navigate(href, { state: { returnTo: '/reports/profit-loss', returnLabel: 'Profit & Loss' } })}
        className="font-mono cursor-pointer focus:outline-none focus:underline"
        title="View transactions for this account and period"
      >
        {fmt(amount)}
      </button>
    );
  };

  const Section = ({ title, items, total }: { title: string; items: PLRow[]; total: number }) => (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{title}</h2>
      {items.map((r, i) => (
        <div key={i} className="flex justify-between py-1 text-sm">
          <span>{r.accountNumber ? `${r.accountNumber} — ` : ''}{r.name}</span>
          <DrillAmount accountId={r.accountId} amount={r.amount} />
        </div>
      ))}
      <div className="flex justify-between py-1 font-semibold border-t mt-1">
        <span>Total {title}</span><span className="font-mono">{fmt(total)}</span>
      </div>
    </div>
  );

  const Subtotal = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-1.5 font-semibold border-t border-gray-300 bg-gray-50 px-2 -mx-2 rounded">
      <span>{label}</span>
      <span className={`font-mono ${value >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(value)}</span>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
      <Section title={L.revenue} items={data.revenue} total={data.totalRevenue} />
      {hasCogs && (
        <>
          <Section title={L.cogs} items={data.cogs ?? []} total={data.totalCogs ?? 0} />
          <Subtotal label={L.grossProfit} value={data.grossProfit ?? 0} />
        </>
      )}
      <Section title={L.expenses} items={data.expenses} total={data.totalExpenses} />
      {showOperatingIncome && <Subtotal label={L.operatingIncome} value={data.operatingIncome ?? 0} />}
      {hasOtherRev && <Section title={L.otherRevenue} items={data.otherRevenue ?? []} total={data.totalOtherRevenue ?? 0} />}
      {hasOtherExp && <Section title={L.otherExpenses} items={data.otherExpenses ?? []} total={data.totalOtherExpenses ?? 0} />}
      <div className="flex justify-between py-2 font-bold text-lg border-t-2">
        <span>{L.netIncome}</span>
        <span className={`font-mono ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.netIncome)}</span>
      </div>
    </div>
  );
}

function ComparativeView({ data }: { data: PLComparativeData }) {
  const navigate = useNavigate();
  const columns: PLComparativeColumn[] = data.columns;
  const isVarianceCol = (col: PLComparativeColumn) => col.type === 'variance' || col.type === 'percent_variance';

  const allRows = data.rows;
  const byType = (t: string) => allRows.filter((r) => r.accountType === t);
  const revenueRows = byType('revenue');
  const cogsRows = byType('cogs');
  const expenseRows = byType('expense');
  const otherRevRows = byType('other_revenue');
  const otherExpRows = byType('other_expense');

  const hasCogs = cogsRows.length > 0;
  const hasOtherRev = otherRevRows.length > 0;
  const hasOtherExp = otherExpRows.length > 0;
  const showOperatingIncome = hasCogs || hasOtherRev || hasOtherExp;

  const L = data.labels ?? DEFAULT_PL_LABELS;

  // Build a subtotal row "a − b" across all period columns. For variance
  // / % variance columns we re-derive from the new current & prior rather
  // than subtracting the source percent figures (which would be nonsense).
  const subtractRow = (a: number[], b: number[]): Array<number | null> => {
    const base: Array<number | null> = a.map((v, i) =>
      columns[i]?.type === 'percent_variance' ? null : (v ?? 0) - (b[i] ?? 0),
    );
    for (let i = 0; i < base.length; i++) {
      const col = columns[i];
      if (col?.type === 'variance') {
        base[i] = (base[0] ?? 0) - (base[1] ?? 0);
      } else if (col?.type === 'percent_variance') {
        const cur = base[0] ?? 0;
        const pr = base[1] ?? 0;
        base[i] = pr === 0 ? null : ((cur - pr) / Math.abs(pr)) * 100;
      }
    }
    return base;
  };
  const grossProfit = hasCogs ? subtractRow(data.totalRevenue, data.totalCogs) : null;
  const operatingIncome = showOperatingIncome
    ? subtractRow((grossProfit ?? data.totalRevenue) as number[], data.totalExpenses)
    : null;

  function CellValue({ value, col }: { value: number | null; col: PLComparativeColumn }) {
    if (col.type === 'percent_variance') {
      return <span className={`font-mono text-right ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(value)}</span>;
    }
    if (col.type === 'variance') {
      return <span className={`font-mono text-right ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(value ?? 0)}</span>;
    }
    return <span className="font-mono text-right">{fmt(value ?? 0)}</span>;
  }

  function TotalRow({ label, values, bold }: { label: string; values: Array<number | null>; bold?: boolean }) {
    return (
      <tr className={bold ? 'border-t-2 border-gray-300' : 'border-t border-gray-200 bg-gray-50'}>
        <td className={`px-3 py-2 text-sm ${bold ? 'font-bold text-base' : 'font-semibold'}`}>{label}</td>
        {values.map((v, i) => (
          <td key={i} className={`px-3 py-2 text-right text-sm ${bold ? 'font-bold' : 'font-semibold'}`}>
            <CellValue value={v} col={columns[i]!} />
          </td>
        ))}
      </tr>
    );
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <tr><td colSpan={columns.length + 1} className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-gray-500">{label}</td></tr>
    );
  }

  function AccountRows({ rows }: { rows: PLComparativeRow[] }) {
    return (
      <>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-1.5">{row.accountNumber ? `${row.accountNumber} — ` : ''}{row.account}</td>
            {row.values.map((v, j) => {
              const col = columns[j]!;
              const href = drillUrl(row.accountId, col.startDate, col.endDate);
              return (
                <td key={j} className={`px-3 py-1.5 text-right ${isVarianceCol(col) ? 'bg-gray-50' : ''}`}>
                  {href ? (
                    <button
                      type="button"
                      onClick={() => navigate(href, { state: { returnTo: '/reports/profit-loss', returnLabel: 'Profit & Loss' } })}
                      className="cursor-pointer focus:outline-none focus:underline"
                      title="View transactions for this account and period"
                    >
                      <CellValue value={v} col={col} />
                    </button>
                  ) : (
                    <CellValue value={v} col={col} />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2.5 font-medium text-gray-600 min-w-[200px]">Account</th>
            {columns.map((col, i) => (
              <th key={i} className={`text-right px-3 py-2.5 font-medium text-gray-600 min-w-[110px] ${isVarianceCol(col) ? 'bg-gray-100' : ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label={L.revenue} />
          <AccountRows rows={revenueRows} />
          <TotalRow label={`Total ${L.revenue}`} values={data.totalRevenue} />

          {hasCogs && (
            <>
              <SectionHeader label={L.cogs} />
              <AccountRows rows={cogsRows} />
              <TotalRow label={`Total ${L.cogs}`} values={data.totalCogs} />
              <TotalRow label={L.grossProfit} values={grossProfit!} />
            </>
          )}

          <SectionHeader label={L.expenses} />
          <AccountRows rows={expenseRows} />
          <TotalRow label={`Total ${L.expenses}`} values={data.totalExpenses} />

          {showOperatingIncome && <TotalRow label={L.operatingIncome} values={operatingIncome!} />}

          {hasOtherRev && (
            <>
              <SectionHeader label={L.otherRevenue} />
              <AccountRows rows={otherRevRows} />
              <TotalRow label={`Total ${L.otherRevenue}`} values={data.totalOtherRevenue ?? []} />
            </>
          )}

          {hasOtherExp && (
            <>
              <SectionHeader label={L.otherExpenses} />
              <AccountRows rows={otherExpRows} />
              <TotalRow label={`Total ${L.otherExpenses}`} values={data.totalOtherExpenses ?? []} />
            </>
          )}

          <TotalRow label={L.netIncome} values={data.netIncome} bold />
        </tbody>
      </table>
    </div>
  );
}
