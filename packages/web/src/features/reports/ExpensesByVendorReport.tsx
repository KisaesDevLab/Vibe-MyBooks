// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Expenses by Vendor — flat vendor→total summary (default) plus a Detail
// view that expands each vendor into the expense accounts it was paid to
// with a vendor total. Backed by /reports/expense-by-vendor
// (?display=detail for the breakdown).

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { useDebouncedDate } from '../../hooks/useDebouncedValue';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface SummaryRow { contact_id: string | null; vendor_name: string; total: string }
interface VendorAccount { accountId: string; accountNumber: string | null; name: string; total: number }
interface VendorGroup { contactId: string | null; vendorName: string; accounts: VendorAccount[]; total: number }
interface ReportData {
  title: string; startDate: string; endDate: string; data: SummaryRow[]; groups?: VendorGroup[];
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' });
}

export function ExpensesByVendorReport() {
  const today = new Date();
  const [startDate, setStartDate] = useSessionState('vibe:report-expvendor:startDate', `${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useSessionState('vibe:report-expvendor:endDate', today.toISOString().split('T')[0]!);
  const [scope, setScope] = useSessionState<'company' | 'consolidated'>('vibe:report-expvendor:scope', 'company');
  const [tagId, setTagId] = useSessionState('vibe:report-expvendor:tagId', '');
  const [view, setView] = useSessionState<'detail' | 'summary'>('vibe:report-expvendor:view', 'detail');
  const { activeCompanyId } = useCompanyContext();

  const debStartDate = useDebouncedDate(startDate);
  const debEndDate = useDebouncedDate(endDate);

  const params = new URLSearchParams({ start_date: debStartDate, end_date: debEndDate });
  if (scope === 'consolidated') params.set('scope', 'consolidated');
  if (tagId) params.set('tag_id', tagId);
  if (view === 'detail') params.set('display', 'detail');
  const queryParams = params.toString();

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['reports', 'expense-by-vendor', debStartDate, debEndDate, activeCompanyId, scope, tagId, view],
    queryFn: () => apiClient<ReportData>(`/reports/expense-by-vendor?${queryParams}`),
  });

  return (
    <ReportShell
      title="Expenses by Vendor"
      maxWidth="max-w-4xl"
      exportBaseUrl={`${API_BASE}/reports/expense-by-vendor?${queryParams}`}
      filters={
        <div className="flex flex-wrap items-center gap-4">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            View
            <select aria-label="Report view mode" value={view} onChange={(e) => setView(e.target.value as 'detail' | 'summary')}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="detail">Detail</option>
              <option value="summary">Summary</option>
            </select>
          </label>
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
          <ReportTagFilter value={tagId} onChange={setTagId} />
        </div>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError ? (
        <ErrorMessage onRetry={refetch} />
      ) : data ? (
        view === 'detail' && data.groups ? <DetailView data={data} /> : <SummaryView data={data} />
      ) : null}
    </ReportShell>
  );
}

function DetailView({ data }: { data: ReportData }) {
  const navigate = useNavigate();
  const groups = data.groups ?? [];
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-gray-500">No expense activity in the selected period.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Expenses by Vendor</h2>
        <p className="text-xs text-gray-500 mt-1">{data.startDate} to {data.endDate}</p>
      </div>
      <div className="divide-y divide-gray-200">
        {groups.map((g) => (
          <div key={g.contactId ?? g.vendorName} className="px-6 py-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">{g.vendorName}</h3>
            <table className="w-full text-xs">
              <thead className="text-gray-500 uppercase">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 font-medium w-[90px]">#</th>
                  <th className="text-left py-1.5 font-medium">Account</th>
                  <th className="text-right py-1.5 font-medium w-[140px]">Total</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {g.accounts.map((a) => (
                  <tr key={a.accountId} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer"
                    onClick={() => navigate(`/transactions?account=${a.accountId}&from=${data.startDate}&to=${data.endDate}`)}
                    title="Click to see transactions">
                    <td className="py-1 text-gray-500">{a.accountNumber || ''}</td>
                    <td className="py-1 font-sans text-gray-700">{a.name}</td>
                    <td className="py-1 text-right">{fmtMoney(a.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="py-1.5 font-sans font-semibold text-gray-700" colSpan={2}>Total {g.vendorName}</td>
                  <td className="py-1.5 text-right font-bold text-gray-900">{fmtMoney(g.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryView({ data }: { data: ReportData }) {
  const navigate = useNavigate();
  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-gray-500">No expense activity in the selected period.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr className="border-b border-gray-200">
            <th className="text-left px-6 py-2.5 font-medium">Vendor</th>
            <th className="text-right px-6 py-2.5 font-medium w-[160px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((row, i) => (
            <tr key={row.contact_id ?? `${row.vendor_name}-${i}`}
              className={`border-b border-gray-100 ${row.contact_id ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
              onClick={() => row.contact_id && navigate(`/contacts/${row.contact_id}`)}
              title={row.contact_id ? 'Open vendor' : undefined}>
              <td className="px-6 py-2 text-gray-800">{row.vendor_name}</td>
              <td className="px-6 py-2 text-right font-mono">{fmtMoney(Number(row.total) || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
