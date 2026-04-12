import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

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
    queryFn: () => apiClient<any>(`/reports/profit-loss?${queryParams}`),
  });

  const isComparative = compare && data?.columns;

  return (
    <ReportShell title="Profit and Loss"
      maxWidth={isComparative ? 'max-w-6xl' : 'max-w-3xl'}
      exportBaseUrl={`/api/v1/reports/profit-loss?${queryParams}`}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
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
            <option value="multi_period">Monthly Breakdown</option>
          </select>
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
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
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Revenue</h2>
        {data.revenue.map((r: any, i: number) => (
          <div key={i} className="flex justify-between py-1 text-sm">
            <span>{r.accountNumber ? `${r.accountNumber} — ` : ''}{r.name}</span>
            <span className="font-mono">{fmt(r.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between py-1 font-semibold border-t mt-1">
          <span>Total Revenue</span><span className="font-mono">{fmt(data.totalRevenue)}</span>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Expenses</h2>
        {data.expenses.map((e: any, i: number) => (
          <div key={i} className="flex justify-between py-1 text-sm">
            <span>{e.accountNumber ? `${e.accountNumber} — ` : ''}{e.name}</span>
            <span className="font-mono">{fmt(e.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between py-1 font-semibold border-t mt-1">
          <span>Total Expenses</span><span className="font-mono">{fmt(data.totalExpenses)}</span>
        </div>
      </div>
      <div className="flex justify-between py-2 font-bold text-lg border-t-2">
        <span>Net Income</span>
        <span className={`font-mono ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.netIncome)}</span>
      </div>
    </div>
  );
}

function ComparativeView({ data }: { data: any }) {
  const columns: Array<{ label: string; type?: string }> = data.columns;
  const isVarianceCol = (col: any) => col.type === 'variance' || col.type === 'percent_variance';
  const revenueRows = (data.rows as any[]).filter((r) => r.accountType === 'revenue');
  const expenseRows = (data.rows as any[]).filter((r) => r.accountType === 'expense');

  function CellValue({ value, col }: { value: number | null; col: any }) {
    if (col.type === 'percent_variance') {
      return <span className={`font-mono text-right ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(value)}</span>;
    }
    if (col.type === 'variance') {
      return <span className={`font-mono text-right ${(value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(value ?? 0)}</span>;
    }
    return <span className="font-mono text-right">{fmt(value ?? 0)}</span>;
  }

  function TotalRow({ label, values, bold }: { label: string; values: any[]; bold?: boolean }) {
    return (
      <tr className={bold ? 'border-t-2 border-gray-300' : 'border-t border-gray-200 bg-gray-50'}>
        <td className={`px-3 py-2 text-sm ${bold ? 'font-bold text-base' : 'font-semibold'}`}>{label}</td>
        {values.map((v: any, i: number) => (
          <td key={i} className={`px-3 py-2 text-right text-sm ${bold ? 'font-bold' : 'font-semibold'}`}>
            <CellValue value={v} col={columns[i]} />
          </td>
        ))}
      </tr>
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
          {/* Revenue */}
          <tr><td colSpan={columns.length + 1} className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-gray-500">Revenue</td></tr>
          {revenueRows.map((row: any, i: number) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-1.5">{row.accountNumber ? `${row.accountNumber} — ` : ''}{row.account}</td>
              {(row.values as any[]).map((v: any, j: number) => (
                <td key={j} className={`px-3 py-1.5 text-right ${isVarianceCol(columns[j]) ? 'bg-gray-50' : ''}`}>
                  <CellValue value={v} col={columns[j]} />
                </td>
              ))}
            </tr>
          ))}
          <TotalRow label="Total Revenue" values={data.totalRevenue} />

          {/* Expenses */}
          <tr><td colSpan={columns.length + 1} className="px-3 pt-4 pb-1 text-xs font-semibold uppercase text-gray-500">Expenses</td></tr>
          {expenseRows.map((row: any, i: number) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-1.5">{row.accountNumber ? `${row.accountNumber} — ` : ''}{row.account}</td>
              {(row.values as any[]).map((v: any, j: number) => (
                <td key={j} className={`px-3 py-1.5 text-right ${isVarianceCol(columns[j]) ? 'bg-gray-50' : ''}`}>
                  <CellValue value={v} col={columns[j]} />
                </td>
              ))}
            </tr>
          ))}
          <TotalRow label="Total Expenses" values={data.totalExpenses} />

          {/* Net Income */}
          <TotalRow label="Net Income" values={data.netIncome} bold />
        </tbody>
      </table>
    </div>
  );
}
