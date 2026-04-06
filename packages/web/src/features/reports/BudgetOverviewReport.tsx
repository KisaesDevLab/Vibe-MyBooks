import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { ReportShell } from './ReportShell';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface Budget { id: string; name: string; fiscalYear: number; }
interface OverviewRow {
  accountId: string; accountName: string; accountNumber?: string; accountType: string;
  months: number[]; annualTotal: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

export function BudgetOverviewReport() {
  const [selectedBudgetId, setSelectedBudgetId] = useState('');

  const { data: budgetsData, isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => apiClient<{ budgets: Budget[] }>('/budgets'),
  });

  const budgetId = useMemo(() => {
    if (selectedBudgetId) return selectedBudgetId;
    return budgetsData?.budgets?.[0]?.id ?? '';
  }, [selectedBudgetId, budgetsData]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['budgets', budgetId, 'overview'],
    queryFn: () => apiClient<{ revenue: OverviewRow[]; expenses: OverviewRow[]; budgetName: string; fiscalYear: number }>(`/budgets/${budgetId}/overview`),
    enabled: !!budgetId,
  });

  function SectionRows({ rows, label }: { rows: OverviewRow[]; label: string }) {
    const monthTotals = Array.from({ length: 12 }, (_, i) => rows.reduce((s, r) => s + r.months[i]!, 0));
    const grandTotal = rows.reduce((s, r) => s + r.annualTotal, 0);

    return (
      <>
        <tr className={label === 'Revenue' ? 'bg-blue-50' : 'bg-red-50'}>
          <td colSpan={14} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">{label}</td>
        </tr>
        {rows.map((row) => (
          <tr key={row.accountId} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-1.5 text-sm text-gray-900 sticky left-0 bg-white z-10 min-w-[200px]">
              {row.accountNumber ? `${row.accountNumber} — ` : ''}{row.accountName}
            </td>
            {row.months.map((v, i) => (
              <td key={i} className="px-3 py-1.5 text-right font-mono text-sm">{fmt(v)}</td>
            ))}
            <td className="px-4 py-1.5 text-right font-mono text-sm font-semibold bg-gray-50">{fmt(row.annualTotal)}</td>
          </tr>
        ))}
        <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
          <td className="px-4 py-2 text-sm sticky left-0 bg-gray-50 z-10">Total {label}</td>
          {monthTotals.map((v, i) => (
            <td key={i} className="px-3 py-2 text-right font-mono text-sm">{fmt(v)}</td>
          ))}
          <td className="px-4 py-2 text-right font-mono text-sm font-bold">{fmt(grandTotal)}</td>
        </tr>
      </>
    );
  }

  return (
    <ReportShell
      title="Budget Overview"
      maxWidth="max-w-none"
      filters={
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Budget:</span>
          <select value={budgetId} onChange={(e) => setSelectedBudgetId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" disabled={budgetsLoading}>
            {!budgetsData?.budgets?.length && <option value="">No budgets found</option>}
            {budgetsData?.budgets?.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.fiscalYear})</option>
            ))}
          </select>
        </div>
      }
    >
      {!budgetId ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No budgets available.
        </div>
      ) : isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError ? (
        <ErrorMessage onRetry={() => refetch()} />
      ) : data ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[200px]">Account</th>
                {MONTH_NAMES.map((m) => (
                  <th key={m} className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase min-w-[100px]">{m}</th>
                ))}
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase min-w-[120px] bg-gray-100">Annual</th>
              </tr>
            </thead>
            <tbody>
              <SectionRows rows={data.revenue} label="Revenue" />
              <SectionRows rows={data.expenses} label="Expenses" />
            </tbody>
          </table>
        </div>
      ) : null}
    </ReportShell>
  );
}
