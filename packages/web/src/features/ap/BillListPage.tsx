// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import type { BillSortKey } from '@kis-books/shared';
import { SortableTh } from '../../components/ui/SortableTh';
import { useColumnView } from '../../hooks/useColumnView';
import { useNavigate, Link } from 'react-router-dom';
import { useBills } from '../../api/hooks/useAp';
import { useFeatureFlag } from '../../api/hooks/useFeatureFlag';
import { useSessionState } from '../../hooks/useSessionState';
import { useDebouncedValue, useDebouncedDate } from '../../hooks/useDebouncedValue';
import { useTags } from '../../api/hooks/useTags';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyStateChat } from '../chat/EmptyStateChat';
import type { BillStatus } from '@kis-books/shared';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'bg-yellow-100 text-yellow-800' },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
};

// Rows-per-page choices — server caps GET /bills at 500.
const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', '500'];
const DEFAULT_PAGE_SIZE = '50';
const SORT_KEYS: readonly BillSortKey[] = ['number', 'vendor', 'vendorInvoiceNumber', 'date', 'dueDate', 'status', 'total', 'balance'];
const STATUS_OPTIONS: Array<{ value: BillStatus; label: string }> = [
  { value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' },
];

export function BillListPage() {
  const navigate = useNavigate();
  const billCaptureEnabled = useFeatureFlag('AP_BILL_CAPTURE_V1') === true;
  // Filters persist for the tab session (sessionStorage); search/date
  // input is debounced so the query doesn't fire per keystroke.
  // Sort + the Status value filter live in one persisted view; the Status
  // select and the header popover read and write the same entry (one value
  // ↔ the select, several ↔ "All statuses").
  const view = useColumnView<BillSortKey>('vibe:bills:view', { sortKeys: SORT_KEYS });
  const statusSet = view.filterFor('status');
  const statusFilter = (statusSet.size === 1 ? [...statusSet][0] : '') as BillStatus | '';
  const setStatusFilter = (v: BillStatus | '') => view.setFilter('status', new Set(v ? [v] : []));
  const [search, setSearch] = useSessionState('vibe:bills:search', '');
  // ADR / build plan — Bills list gets date-range and tag filters.
  const [startDate, setStartDate] = useSessionState('vibe:bills:startDate', '');
  const [endDate, setEndDate] = useSessionState('vibe:bills:endDate', '');
  const [tagFilter, setTagFilter] = useSessionState('vibe:bills:tag', '');
  const debouncedSearch = useDebouncedValue(search);
  const debStartDate = useDebouncedDate(startDate);
  const debEndDate = useDebouncedDate(endDate);
  // Server-side pagination — any filter change resets to page 1.
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const limit = parseInt(pageSize, 10);
  const handlePageSizeChange = (size: string) => { setPageSize(size); setOffset(0); };
  useEffect(() => { setOffset(0); }, [view.signature]);

  const { data, isLoading, isError, refetch } = useBills({
    billStatus: statusSet.size > 0 ? ([...statusSet] as BillStatus[]) : undefined,
    sortBy: view.sortCol || undefined,
    sortDir: view.sortCol ? view.sortDir : undefined,
    search: debouncedSearch || undefined,
    startDate: debStartDate || undefined,
    endDate: debEndDate || undefined,
    tagId: tagFilter || undefined,
    limit,
    offset,
  });

  const { data: tagsData } = useTags({ isActive: true });
  const tagsList = tagsData?.tags || [];

  const bills = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/bills/new')}>Enter Bill</Button>
          {billCaptureEnabled && <Button variant="secondary" onClick={() => navigate('/bills/capture')}>Capture bills</Button>}
          <Button variant="secondary" onClick={() => navigate('/pay-bills')}>Pay Bills</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Search by vendor, bill #, vendor invoice #..."
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as BillStatus | ''); setOffset(0); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <select
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setOffset(0); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]"
          >
            <option value="">All Tags</option>
            {tagsList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : isError ? (
          <ErrorMessage message="Couldn't load bills." onRetry={() => refetch()} />
        ) : bills.length === 0 ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500 text-center">
              No bills found. <Link to="/bills/new" className="text-primary-600">Enter your first bill →</Link>
            </p>
            <EmptyStateChat
              screenName="Bills"
              headline="New to Accounts Payable?"
              subhead="Ask the assistant how the bill → pay flow works."
              promptText="Walk me through the bill-to-payment workflow in Vibe MyBooks."
            />
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b text-xs font-medium uppercase text-gray-500">
              <tr>
                <SortableTh padding="py-2 px-3" label="Bill #" {...view.thProps('number')} />
                <SortableTh padding="py-2 px-3" label="Vendor" {...view.thProps('vendor')} />
                <SortableTh padding="py-2 px-3" label="Vendor Inv #" {...view.thProps('vendorInvoiceNumber')} />
                <SortableTh padding="py-2 px-3" label="Date" {...view.thProps('date')} />
                <SortableTh padding="py-2 px-3" label="Due" {...view.thProps('dueDate')} />
                <SortableTh padding="py-2 px-3" label="Status" {...view.thProps('status')} filter={view.filterProps('status', STATUS_OPTIONS, { ariaLabel: 'Filter Status' })} />
                <SortableTh padding="py-2 px-3" label="Total" align="right" {...view.thProps('total')} />
                <SortableTh padding="py-2 px-3" label="Balance" align="right" {...view.thProps('balance')} />
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const status = b.billStatus
                  ? (b.daysOverdue && b.daysOverdue > 0 && b.billStatus !== 'paid' ? 'overdue' : b.billStatus)
                  : 'unpaid';
                const sty = STATUS_LABELS[status] || STATUS_LABELS['unpaid'];
                return (
                  <tr
                    key={b.id}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/bills/${b.id}`)}
                  >
                    <td className="py-2 px-3 text-sm font-mono">{b.txnNumber}</td>
                    <td className="py-2 px-3 text-sm">{b.contactName}</td>
                    <td className="py-2 px-3 text-sm">{b.vendorInvoiceNumber || '—'}</td>
                    <td className="py-2 px-3 text-sm">{b.txnDate}</td>
                    <td className={`py-2 px-3 text-sm ${b.daysOverdue > 0 ? 'text-red-600' : ''}`}>
                      {b.dueDate || '—'}
                      {b.daysOverdue > 0 ? ` (${b.daysOverdue}d)` : ''}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${sty?.color}`}>
                        {sty?.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-mono">
                      ${parseFloat(b.total || '0').toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-mono">
                      ${parseFloat(b.balanceDue || '0').toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {data && (
        <Pagination
          total={data.total}
          limit={limit}
          offset={offset}
          onChange={setOffset}
          unit="bills"
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
