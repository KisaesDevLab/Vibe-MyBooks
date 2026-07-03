// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_BS_LABELS, type BSSectionLabels } from '@kis-books/shared';
import { apiClient, API_BASE } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useCompanySettings } from '../../api/hooks/useCompany';
import { ReportShell } from './ReportShell';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { ReportFooter } from './ReportFooter';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface BSRow {
  accountId?: string | null;
  accountNumber?: string | null;
  name: string;
  balance: number;
  detailType?: string | null;
}

// Present only when the report was requested with group_by=detail_type.
// The computed equity rows (Retained Earnings / Net Income) arrive in a
// dedicated 'Equity (Calculated)' group.
interface BSGroup {
  detailType: string | null;
  label: string;
  entries: BSRow[];
  subtotal: number;
}

interface BSGroups {
  assets: BSGroup[];
  liabilities: BSGroup[];
  equity: BSGroup[];
}

interface BSStandardData {
  asOfDate: string;
  labels?: BSSectionLabels;
  footer?: string;
  assets: BSRow[];
  liabilities: BSRow[];
  equity: BSRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  groups?: BSGroups;
  columns?: undefined;
}

interface BSComparativeColumn {
  label: string;
  type?: 'variance' | 'percent_variance' | string;
  asOfDate?: string;
}

interface BSComparativeRow {
  accountId?: string | null;
  name: string;
  values: Array<number | null>;
}

interface BSComparativeData {
  columns: BSComparativeColumn[];
  labels?: BSSectionLabels;
  footer?: string;
  assets: BSComparativeRow[];
  liabilities: BSComparativeRow[];
  equity: BSComparativeRow[];
  totalAssets: Array<number | null>;
  totalLiabilities: Array<number | null>;
  totalEquity: Array<number | null>;
  totalLiabilitiesAndEquity?: Array<number | null>;
}

type BSData = BSStandardData | BSComparativeData;

// Accounting convention: negative balances render in parentheses —
// ($1,234.56) — rather than with a leading minus.
function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return n < 0 ? `(${abs})` : abs;
}
function fmtPct(n: number | null) { return n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`; }

type CompareMode = '' | 'previous_period' | 'previous_year';

// Balance-sheet drill: show current-FISCAL-year activity against this
// account, from the fiscal year start containing the column's as-of
// date through the as-of date itself (was hardcoded Jan 1, which split
// a non-January fiscal year). The computed rows (Retained Earnings,
// Net Income) have no source account so their cells render as text.
function bsDrillUrl(accountId: string | null | undefined, asOfDate: string | undefined, fyMonth: number = 1): string | null {
  if (!accountId || !asOfDate) return null;
  let year = parseInt(asOfDate.slice(0, 4), 10);
  if (parseInt(asOfDate.slice(5, 7), 10) < fyMonth) year--;
  const from = `${year}-${String(fyMonth).padStart(2, '0')}-01`;
  const qs = new URLSearchParams({ account: accountId, from, to: asOfDate });
  return `/transactions?${qs.toString()}`;
}

const BS_RETURN_STATE = { returnTo: '/reports/balance-sheet', returnLabel: 'Balance Sheet' };

export function BalanceSheetReport() {
  const [asOfDate, setAsOfDate] = useState(todayLocalISO());
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [compare, setCompare] = useState<CompareMode>('');
  const [scope, setScope] = useState<'company' | 'consolidated'>('company');
  const [tagId, setTagId] = useState('');
  const [groupByDetail, setGroupByDetail] = useState(false);
  const { activeCompanyId } = useCompanyContext();

  // Grouping only applies to the standard (non-comparative) view.
  const effectiveGroupBy = groupByDetail && !compare;
  const queryParams = `as_of_date=${asOfDate}&basis=${basis}${compare ? `&compare=${compare}` : ''}${scope === 'consolidated' ? '&scope=consolidated' : ''}${tagId ? `&tag_id=${tagId}` : ''}${effectiveGroupBy ? '&group_by=detail_type' : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'balance-sheet', asOfDate, basis, compare, activeCompanyId, scope, tagId, effectiveGroupBy],
    queryFn: () => apiClient<BSData>(`/reports/balance-sheet?${queryParams}`),
  });

  const isComparative = compare && data && 'columns' in data && data.columns;

  return (
    <ReportShell title="Balance Sheet"
      maxWidth={isComparative ? 'max-w-6xl' : 'max-w-3xl'}
      exportBaseUrl={`${API_BASE}/reports/balance-sheet?${queryParams}`}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">As of:</span>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
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
          </select>
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
          <ReportTagFilter value={tagId} onChange={setTagId} />
          {!compare && (
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={groupByDetail}
                onChange={(e) => setGroupByDetail(e.target.checked)}
                className="rounded border-gray-300"
              />
              Group by detail type
            </label>
          )}
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" /> : data && (
        isComparative
          ? <ComparativeView data={data as BSComparativeData} />
          : <StandardView data={data as BSStandardData} />
      )}
    </ReportShell>
  );
}

function StandardView({ data }: { data: BSStandardData }) {
  const navigate = useNavigate();
  const L = data.labels ?? DEFAULT_BS_LABELS;
  const { data: settingsData } = useCompanySettings();
  const fyMonth = settingsData?.settings?.fiscalYearStartMonth ?? 1;

  const DrillAmount = ({ accountId, amount }: { accountId: string | null | undefined; amount: number }) => {
    const href = bsDrillUrl(accountId, data.asOfDate, fyMonth);
    if (!href) return <span className="font-mono">{fmt(amount)}</span>;
    return (
      <button
        type="button"
        onClick={() => navigate(href, { state: BS_RETURN_STATE })}
        className="font-mono cursor-pointer focus:outline-none focus:underline"
        title="View this year's transactions for this account through the as-of date"
      >
        {fmt(amount)}
      </button>
    );
  };

  // Standard statement presentation: account rows indent one level under
  // the section header; grouped mode indents group members one further.
  const Row = ({ r, indent = 1 }: { r: BSRow; indent?: 1 | 2 }) => (
    <div className={`flex justify-between py-1 text-sm ${indent === 2 ? 'pl-8' : 'pl-4'}`}>
      <span>{r.accountNumber ? `${r.accountNumber} — ` : ''}{r.name}</span>
      {/* Signed: the API now reports L/E in natural (credit-positive)
          convention, so contra balances (Owner Withdraw, overpaid
          cards) render negative and rows foot to the section total.
          The old Math.abs() made line items disagree with totals. */}
      <DrillAmount accountId={r.accountId} amount={r.balance} />
    </div>
  );

  const Section = ({ title, items, total, groups }: { title: string; items: BSRow[]; total: number; groups?: BSGroup[] }) => (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{title}</h2>
      {groups ? (
        groups.map((g, gi) => (
          <div key={gi} className="mb-1">
            <div className="py-1 pl-4 text-xs font-semibold text-gray-500">{g.label}</div>
            {g.entries.map((r, i) => <Row key={i} r={r} indent={2} />)}
            <div className="flex justify-between py-1 pl-8 text-sm font-medium text-gray-700 border-t border-dashed border-gray-200">
              <span>Total {g.label}</span><span className="font-mono">{fmt(g.subtotal)}</span>
            </div>
          </div>
        ))
      ) : (
        items.map((r, i) => <Row key={i} r={r} />)
      )}
      <div className="flex justify-between py-1 font-semibold border-t mt-1">
        <span>Total {title}</span><span className="font-mono">{fmt(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
      <Section title={L.assets} items={data.assets} total={data.totalAssets} groups={data.groups?.assets} />
      <Section title={L.liabilities} items={data.liabilities} total={data.totalLiabilities} groups={data.groups?.liabilities} />
      <Section title={L.equity} items={data.equity} total={data.totalEquity} groups={data.groups?.equity} />
      <div className="flex justify-between py-2 font-bold text-lg border-t-2">
        <span>{L.totalLiabilitiesAndEquity}</span>
        <span className="font-mono">{fmt(data.totalLiabilitiesAndEquity)}</span>
      </div>
      <ReportFooter text={data.footer} />
    </div>
  );
}

function ComparativeView({ data }: { data: BSComparativeData }) {
  const navigate = useNavigate();
  const { data: settingsData } = useCompanySettings();
  const fyMonth = settingsData?.settings?.fiscalYearStartMonth ?? 1;
  const columns: BSComparativeColumn[] = data.columns;
  const isVarianceCol = (col: BSComparativeColumn) => col.type === 'variance' || col.type === 'percent_variance';
  const L = data.labels ?? DEFAULT_BS_LABELS;

  function CellValue({ value, col }: { value: number | null; col: BSComparativeColumn }) {
    if (col.type === 'percent_variance') {
      return <span className={`font-mono ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(value)}</span>;
    }
    if (col.type === 'variance') {
      return <span className={`font-mono ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(value ?? 0)}</span>;
    }
    return <span className="font-mono">{fmt(value ?? 0)}</span>;
  }

  function SectionTable({ title, items, totals }: { title: string; items: BSComparativeRow[]; totals: Array<number | null> }) {
    return (
      <>
        <tr><td colSpan={columns.length + 1} className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-gray-500">{title}</td></tr>
        {items.map((row, i) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-1.5 text-sm">{row.name}</td>
            {row.values.map((v, j) => {
              const col = columns[j]!;
              const href = bsDrillUrl(row.accountId, col.asOfDate, fyMonth);
              return (
                <td key={j} className={`px-3 py-1.5 text-right text-sm ${isVarianceCol(col) ? 'bg-gray-50' : ''}`}>
                  {href ? (
                    <button
                      type="button"
                      onClick={() => navigate(href, { state: BS_RETURN_STATE })}
                      className="cursor-pointer focus:outline-none focus:underline"
                      title="View this year's transactions for this account through the as-of date"
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
        <tr className="border-t border-gray-200 bg-gray-50">
          <td className="px-3 py-2 text-sm font-semibold">Total {title}</td>
          {totals.map((v, i) => (
            <td key={i} className="px-3 py-2 text-right text-sm font-semibold">
              <CellValue value={v} col={columns[i]!} />
            </td>
          ))}
        </tr>
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
                <th key={i} className={`text-right px-3 py-2.5 font-medium text-gray-600 min-w-[110px] ${isVarianceCol(col) ? 'bg-gray-100' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionTable title={L.assets} items={data.assets} totals={data.totalAssets} />
            <SectionTable title={L.liabilities} items={data.liabilities} totals={data.totalLiabilities} />
            <SectionTable title={L.equity} items={data.equity} totals={data.totalEquity} />
            {/* Closing grand total — equals Total Assets when the books balance. */}
            {data.totalLiabilitiesAndEquity && (
              <tr className="border-t-2 border-gray-300">
                <td className="px-3 py-2 text-sm font-bold">{L.totalLiabilitiesAndEquity}</td>
                {data.totalLiabilitiesAndEquity.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right text-sm font-bold">
                    <CellValue value={v} col={columns[i]!} />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ReportFooter text={data.footer} />
    </div>
  );
}
