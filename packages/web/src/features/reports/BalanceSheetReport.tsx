import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { ReportShell } from './ReportShell';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function fmtPct(n: number | null) { return n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`; }

type CompareMode = '' | 'previous_period' | 'previous_year';

function Section({ title, items, total }: { title: string; items: any[]; total: number }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{title}</h2>
      {items.map((r: any, i: number) => (
        <div key={i} className="flex justify-between py-1 text-sm">
          <span>{r.accountNumber ? `${r.accountNumber} — ` : ''}{r.name}</span>
          <span className="font-mono">{fmt(Math.abs(r.balance))}</span>
        </div>
      ))}
      <div className="flex justify-between py-1 font-semibold border-t mt-1">
        <span>Total {title}</span><span className="font-mono">{fmt(total)}</span>
      </div>
    </div>
  );
}

export function BalanceSheetReport() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]!);
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [compare, setCompare] = useState<CompareMode>('');

  const queryParams = `as_of_date=${asOfDate}&basis=${basis}${compare ? `&compare=${compare}` : ''}`;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'balance-sheet', asOfDate, basis, compare],
    queryFn: () => apiClient<any>(`/reports/balance-sheet?${queryParams}`),
  });

  const isComparative = compare && data?.columns;

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
          <select value={basis} onChange={(e) => setBasis(e.target.value as any)}
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
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" /> : data && (
        isComparative
          ? <ComparativeView data={data} />
          : <StandardView data={data} />
      )}
    </ReportShell>
  );
}

function StandardView({ data }: { data: any }) {
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

function ComparativeView({ data }: { data: any }) {
  const columns: Array<{ label: string; type?: string }> = data.columns;
  const isVarianceCol = (col: any) => col.type === 'variance' || col.type === 'percent_variance';

  function CellValue({ value, col }: { value: number | null; col: any }) {
    if (col.type === 'percent_variance') {
      return <span className={`font-mono ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(value)}</span>;
    }
    if (col.type === 'variance') {
      return <span className={`font-mono ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(value ?? 0)}</span>;
    }
    return <span className="font-mono">{fmt(value ?? 0)}</span>;
  }

  function SectionTable({ title, items, totals }: { title: string; items: any[]; totals: any[] }) {
    return (
      <>
        <tr><td colSpan={columns.length + 1} className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-gray-500">{title}</td></tr>
        {items.map((row: any, i: number) => (
          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-1.5 text-sm">{row.name}</td>
            {(row.values as any[]).map((v: any, j: number) => (
              <td key={j} className={`px-3 py-1.5 text-right text-sm ${isVarianceCol(columns[j]) ? 'bg-gray-50' : ''}`}>
                <CellValue value={v} col={columns[j]} />
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-gray-200 bg-gray-50">
          <td className="px-3 py-2 text-sm font-semibold">Total {title}</td>
          {totals.map((v: any, i: number) => (
            <td key={i} className="px-3 py-2 text-right text-sm font-semibold">
              <CellValue value={v} col={columns[i]} />
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
