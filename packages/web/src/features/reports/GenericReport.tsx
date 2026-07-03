// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { useDebouncedDate } from '../../hooks/useDebouncedValue';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { ReportTable } from './ReportTable';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'money' | 'text';
}

interface GenericReportProps {
  title: string;
  endpoint: string;
  columns: Column[];
  useDateRange?: boolean;
  useAsOfDate?: boolean;
  // ADR 0XX §5.4 — opt-in split-level tag filter. Pages wire this on
  // for every report in the Phase-5 tag-aware list (P&L, BS, Cash Flow,
  // GL, TB, Transaction Detail, Account Detail, AR/AP Aging,
  // Sales/Expenses-by-X, Invoice/Bill lists, Budget vs. Actuals).
  useTagFilter?: boolean;
  extraParams?: Record<string, string>;
  dataKey?: string;
  // Optional totals footer: maps a column key to the response field
  // carrying its total (e.g. { balance: 'totalBalance' }). When every
  // mapped field resolves to a number, ReportTable renders its totals
  // row. Purely additive — reports without it are unchanged.
  totalsFrom?: Record<string, string>;
}

export function GenericReport({ title, endpoint, columns, useDateRange = true, useAsOfDate, useTagFilter = false, extraParams, dataKey = 'data', totalsFrom }: GenericReportProps) {
  const today = new Date();
  // Selection criteria persist for the tab session — namespaced per
  // report endpoint so the Trial Balance and AR Aging (etc.) each keep
  // their own criteria.
  const [startDate, setStartDate] = useSessionState(`vibe:report-${endpoint}:startDate`, `${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useSessionState(`vibe:report-${endpoint}:endDate`, today.toISOString().split('T')[0]!);
  const [asOfDate, setAsOfDate] = useSessionState(`vibe:report-${endpoint}:asOfDate`, today.toISOString().split('T')[0]!);
  const [scope, setScope] = useSessionState<'company' | 'consolidated'>(`vibe:report-${endpoint}:scope`, 'company');
  const [tagId, setTagId] = useSessionState<string>(`vibe:report-${endpoint}:tagId`, '');
  const { activeCompanyId } = useCompanyContext();

  // Only query once typed dates are complete and stable (native date
  // inputs fire a change per segment).
  const debStartDate = useDebouncedDate(startDate);
  const debEndDate = useDebouncedDate(endDate);
  const debAsOfDate = useDebouncedDate(asOfDate);

  const params = new URLSearchParams(extraParams);
  if (useDateRange) { params.set('start_date', debStartDate); params.set('end_date', debEndDate); }
  if (useAsOfDate) params.set('as_of_date', debAsOfDate);
  if (scope === 'consolidated') params.set('scope', 'consolidated');
  if (useTagFilter && tagId) params.set('tag_id', tagId);

  // Reports return wildly different shapes per endpoint (P&L vs balance-
  // sheet vs trial-balance vs general-ledger), each with arbitrarily-
  // nested sections + lines. Per-endpoint Zod schemas would let us
  // narrow this — left for a follow-up. For now `any` is pragmatic
  // since ReportShell does its own runtime shape handling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', endpoint, debStartDate, debEndDate, debAsOfDate, extraParams, activeCompanyId, scope, tagId],
    queryFn: () => apiClient<any>(`/reports/${endpoint}?${params.toString()}`),
  });

  const exportBaseUrl = `${API_BASE}/reports/${endpoint}?${params.toString()}`;

  // Build the ReportTable totals record from the response when the
  // report opted in via totalsFrom.
  let totals: Record<string, number> | undefined;
  if (totalsFrom && data) {
    const entries = Object.entries(totalsFrom)
      .map(([colKey, field]) => [colKey, data[field]] as const)
      .filter((e): e is readonly [string, number] => typeof e[1] === 'number');
    if (entries.length > 0) totals = Object.fromEntries(entries);
  }

  return (
    <ReportShell title={title}
      exportBaseUrl={exportBaseUrl}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          {useDateRange && <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />}
          {useAsOfDate && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">As of:</span>
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
            </div>
          )}
          {useTagFilter && <ReportTagFilter value={tagId} onChange={setTagId} />}
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" /> :
       isError ? <ErrorMessage onRetry={refetch} /> :
       data?.[dataKey] && data[dataKey].length > 0 ? (
        <ReportTable
          columns={columns}
          data={data[dataKey]}
          totals={totals}
          drillContext={{
            startDate: useDateRange ? startDate : undefined,
            endDate: useDateRange ? endDate : undefined,
            asOfDate: useAsOfDate ? asOfDate : undefined,
          }}
          returnLabel={title}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No data for the selected period.
        </div>
      )}
    </ReportShell>
  );
}
