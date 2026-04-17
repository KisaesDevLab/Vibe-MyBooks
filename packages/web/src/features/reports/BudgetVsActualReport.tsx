// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PL_LABELS, type PLSectionLabels } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
}

interface BvsARow {
  accountId: string;
  accountName: string;
  accountNumber?: string;
  accountType: string;
  budget: number;
  actual: number;
  varianceDollar: number;
  variancePercent: number | null;
}

interface BvsAData {
  labels?: PLSectionLabels;
  revenue: BvsARow[];
  cogs: BvsARow[];
  expenses: BvsARow[];
  otherRevenue: BvsARow[];
  otherExpenses: BvsARow[];
  totalRevenueBudget: number;
  totalRevenueActual: number;
  totalCogsBudget: number;
  totalCogsActual: number;
  totalExpenseBudget: number;
  totalExpenseActual: number;
  totalOtherRevenueBudget: number;
  totalOtherRevenueActual: number;
  totalOtherExpenseBudget: number;
  totalOtherExpenseActual: number;
  netIncomeBudget: number;
  netIncomeActual: number;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pctFmt(n: number | null): string {
  if (n === null || !isFinite(n)) return '--';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function varianceColor(accountType: string, variance: number): string {
  if (variance === 0) return '';
  const isIncome = accountType === 'revenue' || accountType === 'other_revenue';
  const favorable = isIncome ? variance > 0 : variance < 0;
  return favorable ? 'text-green-600' : 'text-red-600';
}

export function BudgetVsActualReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]!);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
  const { activeCompanyId } = useCompanyContext();

  // Fetch budgets for dropdown
  const { data: budgetsData, isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets', activeCompanyId],
    queryFn: () => apiClient<{ budgets: Budget[] }>('/budgets'),
  });

  // Auto-select first budget
  const budgetId = useMemo(() => {
    if (selectedBudgetId) return selectedBudgetId;
    return budgetsData?.budgets?.[0]?.id ?? '';
  }, [selectedBudgetId, budgetsData]);

  // Fetch budget vs actual data
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['budgets', budgetId, 'vs-actual', startDate, endDate, activeCompanyId],
    queryFn: () =>
      apiClient<BvsAData>(
        `/budgets/${budgetId}/vs-actual?start_date=${startDate}&end_date=${endDate}`,
      ),
    enabled: !!budgetId,
  });

  const exportBaseUrl = budgetId
    ? `/api/v1/budgets/${budgetId}/vs-actual?start_date=${startDate}&end_date=${endDate}`
    : '';

  const renderRow = (row: BvsARow) => (
    <tr key={row.accountId} className="hover:bg-gray-50">
      <td className="px-4 py-2 text-sm text-gray-900">
        {row.accountNumber ? `${row.accountNumber} — ` : ''}{row.accountName}
      </td>
      <td className="px-4 py-2 text-right font-mono text-sm">{fmt(row.budget)}</td>
      <td className="px-4 py-2 text-right font-mono text-sm">{fmt(row.actual)}</td>
      <td className={`px-4 py-2 text-right font-mono text-sm ${varianceColor(row.accountType, row.varianceDollar)}`}>
        {fmt(row.varianceDollar)}
      </td>
      <td className={`px-4 py-2 text-right font-mono text-sm ${varianceColor(row.accountType, row.varianceDollar)}`}>
        {pctFmt(row.variancePercent)}
      </td>
    </tr>
  );

  const renderRollupRow = (label: string, budget: number, actual: number, type: string) => {
    const varDollar = actual - budget;
    const varPct = budget !== 0 ? ((actual - budget) / Math.abs(budget)) * 100 : null;
    return (
      <tr className="font-semibold border-t bg-gray-50">
        <td className="px-4 py-2 text-sm">{label}</td>
        <td className="px-4 py-2 text-right font-mono text-sm">{fmt(budget)}</td>
        <td className="px-4 py-2 text-right font-mono text-sm">{fmt(actual)}</td>
        <td className={`px-4 py-2 text-right font-mono text-sm ${varianceColor(type, varDollar)}`}>
          {fmt(varDollar)}
        </td>
        <td className={`px-4 py-2 text-right font-mono text-sm ${varianceColor(type, varDollar)}`}>
          {pctFmt(varPct)}
        </td>
      </tr>
    );
  };

  return (
    <ReportShell
      title="Budget vs Actual"
      exportBaseUrl={exportBaseUrl || undefined}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Budget:</span>
            <select
              value={budgetId}
              onChange={(e) => setSelectedBudgetId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              disabled={budgetsLoading}
            >
              {!budgetsData?.budgets?.length && <option value="">No budgets found</option>}
              {budgetsData?.budgets?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.fiscalYear})
                </option>
              ))}
            </select>
          </div>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </div>
      }
    >
      {!budgetId ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No budgets available. Create a budget in the Budget Editor first.
        </div>
      ) : isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError ? (
        <ErrorMessage onRetry={() => refetch()} />
      ) : data ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">$ Variance</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const hasCogs = (data.cogs?.length ?? 0) > 0;
                const hasOtherRev = (data.otherRevenue?.length ?? 0) > 0;
                const hasOtherExp = (data.otherExpenses?.length ?? 0) > 0;
                const L = data.labels ?? DEFAULT_PL_LABELS;
                const sectionHeader = (label: string, tone: string) => (
                  <tr className={tone}>
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">{label}</td>
                  </tr>
                );
                return (
                  <>
                    {sectionHeader(L.revenue, 'bg-blue-50')}
                    {data.revenue.map(renderRow)}
                    {renderRollupRow(`Total ${L.revenue}`, data.totalRevenueBudget, data.totalRevenueActual, 'revenue')}

                    {hasCogs && (
                      <>
                        {sectionHeader(L.cogs, 'bg-amber-50')}
                        {data.cogs.map(renderRow)}
                        {renderRollupRow(`Total ${L.cogs}`, data.totalCogsBudget, data.totalCogsActual, 'expense')}
                        {renderRollupRow(L.grossProfit, data.totalRevenueBudget - data.totalCogsBudget, data.totalRevenueActual - data.totalCogsActual, 'revenue')}
                      </>
                    )}

                    {sectionHeader(L.expenses, 'bg-red-50')}
                    {data.expenses.map(renderRow)}
                    {renderRollupRow(`Total ${L.expenses}`, data.totalExpenseBudget, data.totalExpenseActual, 'expense')}

                    {hasOtherRev && (
                      <>
                        {sectionHeader(L.otherRevenue, 'bg-blue-50')}
                        {data.otherRevenue.map(renderRow)}
                        {renderRollupRow(`Total ${L.otherRevenue}`, data.totalOtherRevenueBudget, data.totalOtherRevenueActual, 'revenue')}
                      </>
                    )}

                    {hasOtherExp && (
                      <>
                        {sectionHeader(L.otherExpenses, 'bg-red-50')}
                        {data.otherExpenses.map(renderRow)}
                        {renderRollupRow(`Total ${L.otherExpenses}`, data.totalOtherExpenseBudget, data.totalOtherExpenseActual, 'expense')}
                      </>
                    )}

                    {renderRollupRow(L.netIncome, data.netIncomeBudget, data.netIncomeActual, 'revenue')}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No data for the selected period.
        </div>
      )}
    </ReportShell>
  );
}
