// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface BSRow {
  accountId?: string | null;
  accountNumber?: string | null;
  name: string;
  balance: number;
}

interface BSStandardData {
  asOfDate: string;
  assets: BSRow[];
  liabilities: BSRow[];
  equity: BSRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
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
  assets: BSComparativeRow[];
  liabilities: BSComparativeRow[];
  equity: BSComparativeRow[];
  totalAssets: Array<number | null>;
  totalLiabilities: Array<number | null>;
  totalEquity: Array<number | null>;
}

type BSData = BSStandardData | BSComparativeData;

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function fmtPct(n: number | null) { return n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`; }

type CompareMode = '' | 'previous_period' | 'previous_year';

// Balance-sheet drill: show current-year activity against this account,
// Jan 1 of the as-of date's year through the as-of date itself. Each
// column in the comparative view has its own as-of, so Jan 1 is derived
// per column rather than hard-coded from the report's primary filter.
// The computed rows (Retained Earnings, Net Income) have no source
// account so their cells render as plain text.
function bsDrillUrl(accountId: string | null | undefined, asOfDate: string | undefined): string | null {
  if (!accountId || !asOfDate) return null;
  const year = asOfDate.slice(0, 4);
  const from = `${year}-01-01`;
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
  const { activeCompanyId } = useCompanyContext();

  const queryParams = `as_of_date=${asOfDate}&basis=${basis}${compare ? `&compare=${compare}` : ''}${scope === 'consolidated' ? '&scope=consolidated' : ''}${tagId ? `&tag_id=${tagId}` : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'balance-sheet', asOfDate, basis, compare, activeCompanyId, scope, tagId],
    queryFn: () => apiClient<BSData>(`/reports/balance-sheet?${queryParams}`),
  });

  const isComparative = compare && data && 'columns' in data && data.columns;

  return (
    <ReportShell title="Balance Sheet"
      maxWidth={isComparative ? 'max-w-6xl' : 'max-w-3xl'}
      exportBaseUrl={`/api/v1/reports/balance-sheet?${queryParams}`}
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

  const DrillAmount = ({ accountId, amount }: { accountId: string | null | undefined; amount: number }) => {
    const href = bsDrillUrl(accountId, data.asOfDate);
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

  const Section = ({ title, items, total }: { title: string; items: BSRow[]; total: number }) => (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{title}</h2>
      {items.map((r, i) => (
        <div key={i} className="flex justify-between py-1 text-sm">
          <span>{r.accountNumber ? `${r.accountNumber} — ` : ''}{r.name}</span>
          <DrillAmount accountId={r.accountId} amount={Math.abs(r.balance)} />
        </div>
      ))}
      <div className="flex justify-between py-1 font-semibold border-t mt-1">
        <span>Total {title}</span><span className="font-mono">{fmt(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
      <Section title="Assets" items={data.assets} total={data.totalAssets} />
      <Section title="Liabilities" items={data.liabilities} total={data.totalLiabilities} />
      <Section title="Equity" items={data.equity} total={data.totalEquity} />
      <div className="flex justify-between py-2 font-bold text-lg border-t-2">
        <span>Total Liabilities & Equity</span>
        <span className="font-mono">{fmt(data.totalLiabilitiesAndEquity)}</span>
      </div>
    </div>
  );
}

function ComparativeView({ data }: { data: BSComparativeData }) {
  const navigate = useNavigate();
  const columns: BSComparativeColumn[] = data.columns;
  const isVarianceCol = (col: BSComparativeColumn) => col.type === 'variance' || col.type === 'percent_variance';

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
              const href = bsDrillUrl(row.accountId, col.asOfDate);
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
          <SectionTable title="Assets" items={data.assets} totals={data.totalAssets} />
          <SectionTable title="Liabilities" items={data.liabilities} totals={data.totalLiabilities} />
          <SectionTable title="Equity" items={data.equity} totals={data.totalEquity} />
        </tbody>
      </table>
    </div>
  );
}
