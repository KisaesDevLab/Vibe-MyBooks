// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_CF_LABELS, type CFSectionLabels } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { ReportFooter } from './ReportFooter';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface CFData {
  startDate: string;
  endDate: string;
  labels?: CFSectionLabels;
  footer?: string;
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  netChange: number;
}

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

export function CashFlowReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]!);
  const [scope, setScope] = useState<'company' | 'consolidated'>('company');
  const [tagId, setTagId] = useState('');
  const { activeCompanyId } = useCompanyContext();

  const queryParams = `start_date=${startDate}&end_date=${endDate}${scope === 'consolidated' ? '&scope=consolidated' : ''}${tagId ? `&tag_id=${tagId}` : ''}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'cash-flow', startDate, endDate, activeCompanyId, scope, tagId],
    queryFn: () => apiClient<CFData>(`/reports/cash-flow?${queryParams}`),
  });

  return (
    <ReportShell title="Cash Flow Statement"
      maxWidth="max-w-3xl"
      exportBaseUrl={`/api/v1/reports/cash-flow?${queryParams}`}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
          <ReportTagFilter value={tagId} onChange={setTagId} />
        </div>
      }>
      {isLoading ? <LoadingSpinner className="py-12" />
        : isError ? <ErrorMessage message="Failed to load cash flow statement." onRetry={() => refetch()} />
        : data ? <StandardView data={data} />
        : null}
    </ReportShell>
  );
}

function StandardView({ data }: { data: CFData }) {
  const L = data.labels ?? DEFAULT_CF_LABELS;
  const Row = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-1.5 text-sm">
      <span>{label}</span>
      <span className={`font-mono ${value >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(value)}</span>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-2">
      <Row label={L.operatingActivities} value={data.operatingActivities} />
      <Row label={L.investingActivities} value={data.investingActivities} />
      <Row label={L.financingActivities} value={data.financingActivities} />
      <div className="flex justify-between py-2 font-bold text-lg border-t-2 mt-2">
        <span>{L.netChange}</span>
        <span className={`font-mono ${data.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.netChange)}</span>
      </div>
      <ReportFooter text={data.footer} />
    </div>
  );
}
