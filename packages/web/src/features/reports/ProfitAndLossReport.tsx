// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PL_LABELS, type PLSectionLabels } from '@kis-books/shared';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { useClearTagOnCompanyChange } from './useClearTagOnCompanyChange';
import { useLocalState, SHOW_ACCT_NUMBERS_KEY } from '../../hooks/useLocalState';
import { useDebouncedDate } from '../../hooks/useDebouncedValue';

// The /reports/profit-loss endpoint returns two shapes depending on whether
// a `compare=` parameter is set. Keep both unions permissive on optional
// sections — the view components branch on the fields they need.
interface PLRow {
  accountId?: string;
  accountNumber?: string | null;
  name: string;
  amount: number;
  detailType?: string | null;
}

// Present only when the report was requested with group_by=detail_type.
interface PLGroup {
  detailType: string | null;
  label: string;
  entries: PLRow[];
  subtotal: number;
}

interface PLGroups {
  revenue: PLGroup[];
  cogs: PLGroup[];
  expenses: PLGroup[];
  otherRevenue: PLGroup[];
  otherExpenses: PLGroup[];
}

interface PLStandardData {
  startDate: string;
  endDate: string;
  labels?: PLSectionLabels;
  footer?: string;
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
  groups?: PLGroups;
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

// Comparative detail-type group (group_by=detail_type with a compare
// mode active): member rows + a per-column subtotal row whose variance
// columns are re-derived from the group's current/prior sums.
interface PLCompGroup {
  detailType: string | null;
  label: string;
  rows: PLComparativeRow[];
  values: Array<number | null>;
}

interface PLCompGroups {
  revenue: PLCompGroup[];
  cogs: PLCompGroup[];
  expenses: PLCompGroup[];
  otherRevenue: PLCompGroup[];
  otherExpenses: PLCompGroup[];
}

interface PLComparativeData {
  startDate: string;
  endDate: string;
  labels?: PLSectionLabels;
  footer?: string;
  columns: PLComparativeColumn[];
  rows: PLComparativeRow[];
  totalRevenue: number[];
  totalCogs: number[];
  totalExpenses: number[];
  totalOtherRevenue?: number[];
  totalOtherExpenses?: number[];
  netIncome: number[];
  groups?: PLCompGroups;
}

// Display mode: detail = flat accounts; grouped = detail-type group
// headers + accounts + subtotals; condensed = group subtotal rows only.
type GroupMode = 'detail' | 'grouped' | 'condensed';

type PLData = PLStandardData | PLComparativeData;
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { ReportFooter } from './ReportFooter';
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
  // Selection criteria persist for the tab session (sessionStorage) so a
  // refresh or route round-trip doesn't reset the user's choices.
  const [startDate, setStartDate] = useSessionState('vibe:report-pl:startDate', `${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useSessionState('vibe:report-pl:endDate', today.toISOString().split('T')[0]!);
  const [basis, setBasis] = useSessionState<'accrual' | 'cash'>('vibe:report-pl:basis', 'accrual');
  const [compare, setCompare] = useSessionState<CompareMode>('vibe:report-pl:compare', '');
  const [scope, setScope] = useSessionState<'company' | 'consolidated'>('vibe:report-pl:scope', 'company');
  const [tagId, setTagId] = useSessionState('vibe:report-pl:tagId', '');
  useClearTagOnCompanyChange(setTagId);
  // Display mode (Detail / Grouped / Condensed). Migrates the previous
  // boolean grouping key gracefully: an old `true` means Grouped.
  const legacyGrouped = (() => {
    try { return window.sessionStorage.getItem('vibe:report-pl:groupBy') === 'true'; } catch { return false; }
  })();
  const [groupMode, setGroupMode] = useSessionState<GroupMode>('vibe:report-pl:groupMode', legacyGrouped ? 'grouped' : 'detail');
  // "% of Revenue" — standard view gets one column; comparison views get
  // a companion % cell per period column (common-size, each against its
  // own period's revenue). Mirrored into the PDF/CSV export via
  // ?show_pct=1. Persisted for the tab session.
  const [showPct, setShowPct] = useSessionState('vibe:report-pl:showPct', false);
  const [showAcctNums, setShowAcctNums] = useLocalState(SHOW_ACCT_NUMBERS_KEY, true);
  const { activeCompanyId } = useCompanyContext();

  // Debounced dates: the native date inputs fire a change per segment
  // while typing — only query once the value is a complete date and the
  // user has paused.
  const debStartDate = useDebouncedDate(startDate);
  const debEndDate = useDebouncedDate(endDate);

  // Grouping applies to BOTH the standard and comparative views.
  // display=condensed and show_pct only affect server-side exports
  // (PDF/CSV mirror the on-screen presentation); the JSON response
  // carries them as additive no-op fields.
  const effectiveGroupBy = groupMode !== 'detail';
  const effectiveShowPct = showPct;
  const queryParams = `start_date=${debStartDate}&end_date=${debEndDate}&basis=${basis}${compare ? `&compare=${compare}` : ''}${scope === 'consolidated' ? '&scope=consolidated' : ''}${tagId ? `&tag_id=${tagId}` : ''}${effectiveGroupBy ? '&group_by=detail_type' : ''}${groupMode === 'condensed' ? '&display=condensed' : ''}${effectiveShowPct ? '&show_pct=1' : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'profit-loss', debStartDate, debEndDate, basis, compare, activeCompanyId, scope, tagId, groupMode, effectiveShowPct],
    queryFn: () => apiClient<PLData>(`/reports/profit-loss?${queryParams}`),
  });

  const isComparative = compare && data && 'columns' in data && data.columns;

  return (
    <ReportShell title="Profit and Loss"
      maxWidth={isComparative ? 'max-w-6xl' : 'max-w-3xl'}
      exportBaseUrl={`${API_BASE}/reports/profit-loss?${queryParams}${!showAcctNums ? '&account_numbers=0' : ''}`}
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
          <ReportTagFilter value={tagId} onChange={setTagId} />
          <label className="flex items-center gap-1.5 text-sm text-gray-600 select-none">
            View:
            <select
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as GroupMode)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              aria-label="Report display mode"
            >
              <option value="detail">Detail</option>
              <option value="grouped">Grouped by detail type</option>
              <option value="condensed">Condensed (group totals)</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPct}
              onChange={(e) => setShowPct(e.target.checked)}
              className="rounded border-gray-300"
            />
            % of Revenue
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none" title="Show account numbers on financial reports">
            <input
              type="checkbox"
              checked={showAcctNums}
              onChange={(e) => setShowAcctNums(e.target.checked)}
              className="rounded border-gray-300"
            />
            Account #
          </label>
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" /> : data && (
        isComparative
          ? <ComparativeView data={data as PLComparativeData} mode={groupMode} showPct={showPct} showAcctNums={showAcctNums} />
          : <StandardView data={data as PLStandardData} showPct={showPct} mode={groupMode} showAcctNums={showAcctNums} />
      )}
    </ReportShell>
  );
}

function StandardView({ data, showPct = false, mode = 'detail', showAcctNums = true }: { data: PLStandardData; showPct?: boolean; mode?: GroupMode; showAcctNums?: boolean }) {
  const navigate = useNavigate();
  // "% of Revenue": each amount as a share of total revenue, one
  // decimal. With zero total revenue every percentage is undefined —
  // render an em dash rather than Infinity/NaN. Negative amounts show
  // negative percentages.
  const pct = (amount: number): string => {
    if (data.totalRevenue === 0) return '—';
    return `${((amount / data.totalRevenue) * 100).toFixed(1)}%`;
  };
  const Pct = ({ amount }: { amount: number }) =>
    showPct ? (
      <span className="font-mono text-xs text-gray-500 w-16 text-right shrink-0">{pct(amount)}</span>
    ) : null;
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

  const Row = ({ r, indent }: { r: PLRow; indent?: boolean }) => (
    <div className={`flex justify-between py-1 text-sm ${indent ? 'pl-4' : ''}`}>
      <span>{showAcctNums && r.accountNumber ? `${r.accountNumber} — ` : ''}{r.name}</span>
      <span className="flex items-baseline gap-3">
        <DrillAmount accountId={r.accountId} amount={r.amount} />
        <Pct amount={r.amount} />
      </span>
    </div>
  );

  const Section = ({ title, items, total, groups }: { title: string; items: PLRow[]; total: number; groups?: PLGroup[] }) => (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{title}</h2>
      {groups && mode === 'condensed' ? (
        // Condensed: one subtotal line per detail-type group, no
        // account rows. Section totals below are unchanged.
        groups.map((g, gi) => (
          <div key={gi} className="flex justify-between py-1 pl-4 text-sm">
            <span>{g.label}</span>
            <span className="flex items-baseline gap-3">
              <span className="font-mono">{fmt(g.subtotal)}</span>
              <Pct amount={g.subtotal} />
            </span>
          </div>
        ))
      ) : groups ? (
        groups.map((g, gi) => (
          <div key={gi} className="mb-1">
            <div className="py-1 text-xs font-semibold text-gray-500">{g.label}</div>
            {g.entries.map((r, i) => <Row key={i} r={r} indent />)}
            <div className="flex justify-between py-1 pl-4 text-sm font-medium text-gray-700 border-t border-dashed border-gray-200">
              <span>Total {g.label}</span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono">{fmt(g.subtotal)}</span>
                <Pct amount={g.subtotal} />
              </span>
            </div>
          </div>
        ))
      ) : (
        items.map((r, i) => <Row key={i} r={r} />)
      )}
      <div className="flex justify-between py-1 font-semibold border-t mt-1">
        <span>Total {title}</span>
        <span className="flex items-baseline gap-3">
          <span className="font-mono">{fmt(total)}</span>
          <Pct amount={total} />
        </span>
      </div>
    </div>
  );

  const Subtotal = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-1.5 font-semibold border-t border-gray-300 bg-gray-50 px-2 -mx-2 rounded">
      <span>{label}</span>
      <span className="flex items-baseline gap-3">
        <span className={`font-mono ${value >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(value)}</span>
        <Pct amount={value} />
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
      <Section title={L.revenue} items={data.revenue} total={data.totalRevenue} groups={data.groups?.revenue} />
      {hasCogs && (
        <>
          <Section title={L.cogs} items={data.cogs ?? []} total={data.totalCogs ?? 0} groups={data.groups?.cogs} />
          <Subtotal label={L.grossProfit} value={data.grossProfit ?? 0} />
        </>
      )}
      <Section title={L.expenses} items={data.expenses} total={data.totalExpenses} groups={data.groups?.expenses} />
      {showOperatingIncome && <Subtotal label={L.operatingIncome} value={data.operatingIncome ?? 0} />}
      {hasOtherRev && <Section title={L.otherRevenue} items={data.otherRevenue ?? []} total={data.totalOtherRevenue ?? 0} groups={data.groups?.otherRevenue} />}
      {hasOtherExp && <Section title={L.otherExpenses} items={data.otherExpenses ?? []} total={data.totalOtherExpenses ?? 0} groups={data.groups?.otherExpenses} />}
      <div className="flex justify-between py-2 font-bold text-lg border-t-2">
        <span>{L.netIncome}</span>
        <span className="flex items-baseline gap-3">
          <span className={`font-mono ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.netIncome)}</span>
          {showPct && <span className="font-mono text-sm text-gray-500 w-16 text-right shrink-0">{pct(data.netIncome)}</span>}
        </span>
      </div>
      <ReportFooter text={data.footer} />
    </div>
  );
}

function ComparativeView({ data, mode = 'detail', showPct = false, showAcctNums = true }: { data: PLComparativeData; mode?: GroupMode; showPct?: boolean; showAcctNums?: boolean }) {
  const navigate = useNavigate();
  const columns: PLComparativeColumn[] = data.columns;
  const isVarianceCol = (col: PLComparativeColumn) => col.type === 'variance' || col.type === 'percent_variance';

  // Common-size columns: each period column gains a companion "%" cell
  // showing the amount as a share of THAT period's total revenue.
  // Variance / % change columns are ratios already and get no companion.
  const hasPctCol = (col: PLComparativeColumn | undefined) => showPct && !!col && !isVarianceCol(col);
  const pctColCount = showPct ? columns.filter((c) => !isVarianceCol(c)).length : 0;
  const tableSpan = columns.length + 1 + pctColCount;
  const pctAt = (value: number | null, i: number): string => {
    const rev = data.totalRevenue?.[i] ?? 0;
    if (rev === 0) return '—';
    return `${(((value ?? 0) / rev) * 100).toFixed(1)}%`;
  };
  const PctCell = ({ value, i, className = '' }: { value: number | null; i: number; className?: string }) =>
    hasPctCol(columns[i]) ? (
      <td className={`px-2 py-1.5 text-right font-mono text-xs text-gray-500 whitespace-nowrap ${className}`}>{pctAt(value, i)}</td>
    ) : null;

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
          <Fragment key={i}>
            <td className={`px-3 py-2 text-right text-sm ${bold ? 'font-bold' : 'font-semibold'}`}>
              <CellValue value={v} col={columns[i]!} />
            </td>
            <PctCell value={v} i={i} />
          </Fragment>
        ))}
      </tr>
    );
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <tr><td colSpan={tableSpan} className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-gray-500">{label}</td></tr>
    );
  }

  function AccountRows({ rows, indent }: { rows: PLComparativeRow[]; indent?: boolean }) {
    return (
      <>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className={`px-3 py-1.5 ${indent ? 'pl-8' : ''}`}>{showAcctNums && row.accountNumber ? `${row.accountNumber} — ` : ''}{row.account}</td>
            {row.values.map((v, j) => {
              const col = columns[j]!;
              const href = drillUrl(row.accountId, col.startDate, col.endDate);
              return (
                <Fragment key={j}>
                  <td className={`px-3 py-1.5 text-right ${isVarianceCol(col) ? 'bg-gray-50' : ''}`}>
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
                  <PctCell value={v} i={j} />
                </Fragment>
              );
            })}
          </tr>
        ))}
      </>
    );
  }

  // Group subtotal row: lighter than section TotalRow so the visual
  // hierarchy stays group < section.
  function GroupSubtotalRow({ label, values }: { label: string; values: Array<number | null> }) {
    return (
      <tr className="border-t border-dashed border-gray-200">
        <td className="px-3 py-1.5 pl-8 text-sm font-medium text-gray-700">{label}</td>
        {values.map((v, i) => (
          <Fragment key={i}>
            <td className="px-3 py-1.5 text-right text-sm font-medium">
              <CellValue value={v} col={columns[i]!} />
            </td>
            <PctCell value={v} i={i} />
          </Fragment>
        ))}
      </tr>
    );
  }

  // One section's body honoring the display mode: detail = flat account
  // rows; grouped = group header + indented accounts + subtotal row;
  // condensed = only the per-group subtotal rows.
  function SectionBody({ rows, groups }: { rows: PLComparativeRow[]; groups?: PLCompGroup[] }) {
    if (!groups || mode === 'detail') return <AccountRows rows={rows} />;
    return (
      <>
        {groups.map((g, gi) => (
          <Fragment key={gi}>
            {mode === 'grouped' && (
              <tr>
                <td colSpan={tableSpan} className="px-3 pt-2 pb-1 pl-6 text-xs font-semibold text-gray-500">{g.label}</td>
              </tr>
            )}
            {mode === 'grouped' && <AccountRows rows={g.rows} indent />}
            <GroupSubtotalRow label={mode === 'condensed' ? g.label : `Total ${g.label}`} values={g.values} />
          </Fragment>
        ))}
      </>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 min-w-[200px]">Account</th>
              {columns.map((col, i) => (
                <Fragment key={i}>
                  <th className={`text-right px-3 py-2.5 font-medium text-gray-600 min-w-[110px] ${isVarianceCol(col) ? 'bg-gray-100' : ''}`}>
                    {col.label}
                  </th>
                  {hasPctCol(col) && (
                    <th className="text-right px-2 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap">%</th>
                  )}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionHeader label={L.revenue} />
            <SectionBody rows={revenueRows} groups={data.groups?.revenue} />
            <TotalRow label={`Total ${L.revenue}`} values={data.totalRevenue} />

            {hasCogs && (
              <>
                <SectionHeader label={L.cogs} />
                <SectionBody rows={cogsRows} groups={data.groups?.cogs} />
                <TotalRow label={`Total ${L.cogs}`} values={data.totalCogs} />
                <TotalRow label={L.grossProfit} values={grossProfit!} />
              </>
            )}

            <SectionHeader label={L.expenses} />
            <SectionBody rows={expenseRows} groups={data.groups?.expenses} />
            <TotalRow label={`Total ${L.expenses}`} values={data.totalExpenses} />

            {showOperatingIncome && <TotalRow label={L.operatingIncome} values={operatingIncome!} />}

            {hasOtherRev && (
              <>
                <SectionHeader label={L.otherRevenue} />
                <SectionBody rows={otherRevRows} groups={data.groups?.otherRevenue} />
                <TotalRow label={`Total ${L.otherRevenue}`} values={data.totalOtherRevenue ?? []} />
              </>
            )}

            {hasOtherExp && (
              <>
                <SectionHeader label={L.otherExpenses} />
                <SectionBody rows={otherExpRows} groups={data.groups?.otherExpenses} />
                <TotalRow label={`Total ${L.otherExpenses}`} values={data.totalOtherExpenses ?? []} />
              </>
            )}

            <TotalRow label={L.netIncome} values={data.netIncome} bold />
          </tbody>
        </table>
      </div>
      <ReportFooter text={data.footer} />
    </div>
  );
}
