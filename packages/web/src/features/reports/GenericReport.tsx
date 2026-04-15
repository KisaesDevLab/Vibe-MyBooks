import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { ReportTable } from './ReportTable';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
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
  extraParams?: Record<string, string>;
  dataKey?: string;
}

export function GenericReport({ title, endpoint, columns, useDateRange = true, useAsOfDate, extraParams, dataKey = 'data' }: GenericReportProps) {
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]!);
  const [asOfDate, setAsOfDate] = useState(today.toISOString().split('T')[0]!);
  const [scope, setScope] = useState<'company' | 'consolidated'>('company');
  const { activeCompanyId } = useCompanyContext();

  const params = new URLSearchParams(extraParams);
  if (useDateRange) { params.set('start_date', startDate); params.set('end_date', endDate); }
  if (useAsOfDate) params.set('as_of_date', asOfDate);
  if (scope === 'consolidated') params.set('scope', 'consolidated');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', endpoint, startDate, endDate, asOfDate, extraParams, activeCompanyId, scope],
    queryFn: () => apiClient<any>(`/reports/${endpoint}?${params.toString()}`),
  });

  const exportBaseUrl = `/api/v1/reports/${endpoint}?${params.toString()}`;

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
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" /> :
       isError ? <ErrorMessage onRetry={refetch} /> :
       data?.[dataKey] && data[dataKey].length > 0 ? (
        <ReportTable
          columns={columns}
          data={data[dataKey]}
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
