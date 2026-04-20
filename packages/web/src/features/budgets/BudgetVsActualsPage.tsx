// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// ADR 0XW §6 — Budget vs Actuals report driven by
// runTagScopedBudgetVsActuals. Respects the selected budget's tag
// scope; cells drill through to the Transactions list pre-filtered by
// account, period, and tag.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useTags } from '../../api/hooks/useTags';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Button } from '../../components/ui/Button';
import { Download } from 'lucide-react';

interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
  tagId: string | null;
  periodType: 'monthly' | 'quarterly' | 'annual';
  status: 'draft' | 'active' | 'archived';
}

interface Cell {
  periodIndex: number;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number | null;
}

interface Row {
  accountId: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  cells: Cell[];
  rowTotal: Cell;
}

interface ActualsReport {
  budget: Budget & { fiscalYearStart: string };
  fiscalYearStart: string;
  tagId: string | null;
  rows: Row[];
  totals: {
    perMonth: Cell[];
    grand: number;
  };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null): string {
  if (n === null || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function BudgetVsActualsPage() {
  const navigate = useNavigate();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');

  const { data: budgetsData } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => apiClient<{ budgets: Budget[] }>('/budgets'),
  });

  const budgets = budgetsData?.budgets || [];
  const activeBudgetId = selectedBudgetId || budgets[0]?.id || '';
  const activeBudget = budgets.find((b) => b.id === activeBudgetId) || null;

  const { data: tagsData } = useTags({ isActive: true });
  const tagName = useMemo(() => {
    if (!activeBudget?.tagId) return null;
    return tagsData?.tags?.find((t) => t.id === activeBudget.tagId)?.name ?? null;
  }, [activeBudget, tagsData]);

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['budgets', activeBudgetId, 'tag-actuals'],
    queryFn: () => apiClient<ActualsReport>(`/budgets/${activeBudgetId}/tag-actuals`),
    enabled: !!activeBudgetId,
    retry: false,
  });

  const downloadCsv = () => {
    if (!report) return;
    const header = [
      'Account',
      'Type',
      ...MONTH_NAMES.flatMap((m) => [`${m} Budget`, `${m} Actual`, `${m} Var`]),
      'Total Budget',
      'Total Actual',
      'Total Var',
      'Total Var %',
    ];
    const rows = report.rows.map((r) => [
      `${r.accountNumber || ''} ${r.accountName}`.trim(),
      r.accountType,
      ...r.cells.flatMap((c) => [c.budget.toFixed(2), c.actual.toFixed(2), c.variance.toFixed(2)]),
      r.rowTotal.budget.toFixed(2),
      r.rowTotal.actual.toFixed(2),
      r.rowTotal.variance.toFixed(2),
      fmtPct(r.rowTotal.variancePct),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-vs-actuals-${activeBudget?.name || 'report'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const drillThrough = (accountId: string, periodIndex: number) => {
    if (!report) return;
    // Compute the period's start / end dates from the fiscal year start.
    const fyStart = new Date(report.fiscalYearStart);
    const monthsPerPeriod =
      report.budget.periodType === 'monthly' ? 1 :
      report.budget.periodType === 'quarterly' ? 3 : 12;
    const startDate = new Date(fyStart);
    startDate.setMonth(startDate.getMonth() + (periodIndex - 1) * monthsPerPeriod);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + monthsPerPeriod);
    endDate.setDate(endDate.getDate() - 1);
    const params = new URLSearchParams({
      accountId,
      startDate: startDate.toISOString().split('T')[0]!,
      endDate: endDate.toISOString().split('T')[0]!,
    });
    if (report.tagId) params.set('tagId', report.tagId);
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budget vs. Actuals</h1>
        <div className="flex items-center gap-2">
          <select
            value={activeBudgetId}
            onChange={(e) => setSelectedBudgetId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {budgets.length === 0 && <option value="">No budgets found</option>}
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.fiscalYear})
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={downloadCsv} disabled={!report}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {activeBudget && (
        <div className="mb-4 flex items-center gap-3 text-sm text-gray-600">
          <span>
            <span className="font-medium text-gray-900">{activeBudget.name}</span>
            {' '}· Fiscal year {activeBudget.fiscalYear}
            {' '}· {activeBudget.periodType}
            {' '}· {activeBudget.status}
          </span>
          {tagName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs font-medium">
              Tag: {tagName}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
              Company-wide
            </span>
          )}
        </div>
      )}

      {!activeBudgetId && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          Create a budget first to see Budget vs Actuals.
        </div>
      )}

      {isLoading && <LoadingSpinner className="py-12" />}
      {isError && (() => {
        // TAG_BUDGETS_V1 off on the server → the tag-scoped endpoint
        // returns a 400 with "TAG_BUDGETS_V1 feature flag is not enabled".
        // Don't surface it as a red error; direct the user to the legacy
        // /vs-actual report instead so they still get something useful.
        const msg = error instanceof Error ? error.message : '';
        const flagOff = msg.includes('TAG_BUDGETS_V1');
        if (flagOff) {
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm text-amber-900 space-y-2">
              <p className="font-medium">Tag-scoped Budget vs. Actuals is disabled on this deployment.</p>
              <p className="text-amber-800">
                Ask your admin to set <code className="bg-amber-100 px-1 rounded">TAG_BUDGETS_V1=true</code> in the API environment to turn on this view.
                Until then, the legacy <a className="underline" href={`/api/v1/budgets/${activeBudgetId}/vs-actual`} target="_blank" rel="noreferrer">Budget vs. Actual</a> endpoint still works company-wide.
              </p>
            </div>
          );
        }
        return (
          <div>
            <ErrorMessage onRetry={() => refetch()} />
            {error instanceof Error && <p className="text-sm text-red-600 mt-2">{error.message}</p>}
          </div>
        );
      })()}

      {report && report.rows.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          This budget has no lines yet. Add amounts in the Budget Editor first.
        </div>
      )}

      {report && report.rows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[200px]">Account</th>
                {MONTH_NAMES.map((m, i) => (
                  <th key={i} className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">{m}</th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase bg-gray-100">Total Budget</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase bg-gray-100">Total Actual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase bg-gray-100">Variance</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase bg-gray-100">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.rows.map((row) => (
                <tr key={row.accountId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                    <span className="font-medium">
                      {row.accountNumber ? `${row.accountNumber} — ` : ''}{row.accountName}
                    </span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">{row.accountType.replace(/_/g, ' ')}</span>
                  </td>
                  {row.cells.map((cell) => {
                    const hasData = cell.budget !== 0 || cell.actual !== 0;
                    return (
                      <td key={cell.periodIndex} className="px-2 py-2 text-right font-mono text-xs">
                        {hasData ? (
                          <button
                            type="button"
                            onClick={() => drillThrough(row.accountId, cell.periodIndex)}
                            className="hover:text-primary-600 hover:underline"
                            title={`Budget: $${fmt(cell.budget)} · Actual: $${fmt(cell.actual)}`}
                          >
                            ${fmt(cell.actual)}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono text-sm bg-gray-50">${fmt(row.rowTotal.budget)}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm bg-gray-50">${fmt(row.rowTotal.actual)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm bg-gray-50 ${row.rowTotal.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    ${fmt(row.rowTotal.variance)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs bg-gray-50 ${row.rowTotal.variancePct === null ? 'text-gray-400' : row.rowTotal.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmtPct(row.rowTotal.variancePct)}
                  </td>
                </tr>
              ))}
              {/* Column totals row */}
              <tr className="font-semibold bg-gray-100 border-t-2 border-gray-300">
                <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10">Total</td>
                {report.totals.perMonth.map((c) => (
                  <td key={c.periodIndex} className="px-2 py-2 text-right font-mono text-xs">${fmt(c.actual)}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-sm">${fmt(report.totals.perMonth.reduce((s, c) => s + c.budget, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-sm">${fmt(report.totals.perMonth.reduce((s, c) => s + c.actual, 0))}</td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
