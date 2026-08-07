// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// TB report family index (Phase 12): renders any of the thirteen TB
// reports inline (columns come from the server's _exportColumns, so
// screen, CSV, PDF, and pack sections all share one definition) with
// CSV/PDF downloads. Options (12.8): as-of date, basis, and the flux
// thresholds; persisted per session like other report params.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useTbProfile } from '../../api/hooks/useTb';
import { useSessionState } from '../../hooks/useSessionState';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Download } from 'lucide-react';

const TB_REPORTS = [
  { id: 'tb-workpaper', label: 'TB Workpaper (5-column)' },
  { id: 'tb-grouped', label: 'Grouped Trial Balance' },
  { id: 'tb-return-order', label: 'Tax Return Order' },
  { id: 'tb-tax-basis-pl', label: 'Tax-Basis P&L' },
  { id: 'tb-flux', label: 'Flux Analysis' },
  { id: 'tb-aje-listing', label: 'AJE Listing' },
  { id: 'tb-bookkeeper-letter', label: 'Bookkeeper Letter' },
  { id: 'tb-rje-listing', label: 'Tax RJE Listing' },
  { id: 'tb-code-summary', label: 'Tax Code Summary' },
  { id: 'tb-m1', label: 'Schedule M-1 Preview' },
  { id: 'tb-m2', label: 'Schedule M-2 Rollforward' },
  { id: 'tb-workpaper-index', label: 'Workpaper Index' },
  { id: 'tb-diagnostics', label: 'Diagnostics Report' },
] as const;

interface Col { key: string; label: string; align?: string }
interface ReportData {
  title: string;
  data: Array<Record<string, unknown>>;
  _exportColumns: Col[];
}

const fmtCell = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    return v < 0
      ? `(${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(v);
};

export function TbReportsPage() {
  const toast = useToast();
  const { data: profileData } = useTbProfile();
  const [reportId, setReportId] = useSessionState('vibe:tb-reports:report', 'tb-workpaper');
  const [endDate, setEndDate] = useSessionState('vibe:tb-reports:endDate', '');
  const [basis, setBasis] = useSessionState<'accrual' | 'cash'>('vibe:tb-reports:basis', 'accrual');
  const [thresholdAmount, setThresholdAmount] = useSessionState('vibe:tb-reports:fluxAmt', '0');
  const [thresholdPct, setThresholdPct] = useSessionState('vibe:tb-reports:fluxPct', '0');
  const effEnd = endDate || profileData?.fiscal.currentFiscalYearEnd || `${new Date().getFullYear()}-12-31`;

  const params = new URLSearchParams({ as_of_date: effEnd, basis });
  if (reportId === 'tb-flux') {
    params.set('threshold_amount', thresholdAmount);
    params.set('threshold_pct', thresholdPct);
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tb', 'report', reportId, effEnd, basis, thresholdAmount, thresholdPct],
    retry: false,
    queryFn: () => apiClient<ReportData>(`/reports/${reportId}?${params}`),
  });

  const download = async (format: 'csv' | 'pdf') => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/v1/reports/${reportId}?${params}&format=${format}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        'X-Company-Id': localStorage.getItem('activeCompanyId') ?? '',
      },
    });
    if (!res.ok) {
      toast.error(`${format.toUpperCase()} export failed`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportId}-${effEnd}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">TB Reports</h1>
          <p className="text-sm text-gray-500">The Trial Balance report family — also available in Report Packs for bulk PDF generation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => download('csv')}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button variant="secondary" size="sm" onClick={() => download('pdf')}><Download className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        <select value={reportId} onChange={(e) => setReportId(e.target.value)} aria-label="Report"
          className="rounded-lg border border-gray-300 px-3 py-2">
          {TB_REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <input type="date" value={effEnd} onChange={(e) => setEndDate(e.target.value)} aria-label="As of"
          className="rounded-lg border border-gray-300 px-3 py-2" />
        <select value={basis} onChange={(e) => setBasis(e.target.value as 'accrual' | 'cash')} aria-label="Basis"
          className="rounded-lg border border-gray-300 px-2 py-2">
          <option value="accrual">Accrual</option>
          <option value="cash">Cash</option>
        </select>
        {reportId === 'tb-flux' && (
          <>
            <label className="text-gray-600">Threshold $
              <input type="number" value={thresholdAmount} onChange={(e) => setThresholdAmount(e.target.value)}
                className="ml-1 w-24 rounded-lg border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-gray-600">Threshold %
              <input type="number" value={thresholdPct} onChange={(e) => setThresholdPct(e.target.value)}
                className="ml-1 w-20 rounded-lg border border-gray-300 px-2 py-1.5" />
            </label>
          </>
        )}
      </div>

      {isLoading && <LoadingSpinner className="py-16" />}
      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {isApiError(error) ? error.message : 'Report failed to build.'}
        </div>
      )}
      {data && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <div className="px-4 pt-3 pb-1 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">{data.title}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                {data._exportColumns.map((c) => (
                  <th key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row, i) => {
                const isBanner = String(row[data._exportColumns[0]?.key ?? ''] ?? '') === '---'
                  || String(row['account_number'] ?? '') === '---'
                  || String(row['item'] ?? '').startsWith('---');
                return (
                  <tr key={i} className={isBanner ? 'bg-gray-50 font-medium' : 'border-b border-gray-50'}>
                    {data._exportColumns.map((c) => (
                      <td key={c.key} className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right font-mono tabular-nums text-xs' : ''}`}>
                        {isBanner && c.key === data._exportColumns[0]?.key ? '' : fmtCell(row[c.key]).replace(/^---\s*/, '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {data.data.length === 0 && (
                <tr><td colSpan={data._exportColumns.length} className="px-3 py-6 text-sm text-gray-500">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
