// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../api/hooks/useInvoices';
import { useTags } from '../../api/hooks/useTags';
import { useContacts } from '../../api/hooks/useContacts';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Pagination } from '../../components/ui/Pagination';
import { Plus, Search } from 'lucide-react';

const PAGE_SIZE = 50;

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-indigo-100 text-indigo-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-700',
};

export function InvoiceListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilterRaw] = useState('');
  const [search, setSearchRaw] = useState('');
  // ADR / build-plan Phase 8 — Invoices list gets customer + date range
  // + tag filters. All reset offset on change.
  const [customerFilter, setCustomerFilterRaw] = useState('');
  const [startDate, setStartDateRaw] = useState('');
  const [endDate, setEndDateRaw] = useState('');
  const [tagFilter, setTagFilterRaw] = useState('');
  const [offset, setOffset] = useState(0);

  const setStatusFilter = (v: string) => { setStatusFilterRaw(v); setOffset(0); };
  const setSearch = (v: string) => { setSearchRaw(v); setOffset(0); };
  const setCustomerFilter = (v: string) => { setCustomerFilterRaw(v); setOffset(0); };
  const setStartDate = (v: string) => { setStartDateRaw(v); setOffset(0); };
  const setEndDate = (v: string) => { setEndDateRaw(v); setOffset(0); };
  const setTagFilter = (v: string) => { setTagFilterRaw(v); setOffset(0); };

  const { data, isLoading, isError, refetch } = useInvoices({
    status: statusFilter ? statusFilter as 'posted' | 'draft' | 'void' : undefined,
    contactId: customerFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    tagId: tagFilter || undefined,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const { data: tagsData } = useTags({ isActive: true });
  const tagsList = tagsData?.tags || [];
  const { data: contactsData } = useContacts({ limit: 500, isActive: true });
  const customersList = (contactsData?.data || []).filter((c) =>
    c.contactType === 'customer' || c.contactType === 'both',
  );

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const invoices = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Button size="sm" onClick={() => navigate('/invoices/new')}>
          <Plus className="h-4 w-4 mr-1" /> New Invoice
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-gray-400" />
            <input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[220px]">
              <option value="">All Customers</option>
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tag</label>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]">
              <option value="">All Tags</option>
              {tagsList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No invoices found. Create your first invoice.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((inv) => {
                const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.invoiceStatus !== 'paid' && inv.invoiceStatus !== 'void';
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{inv.txnNumber || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{inv.txnDate}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{inv.contactName || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {inv.dueDate || '—'}
                      {isOverdue && <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.invoiceStatus || 'draft'] || statusColors['draft']}`}>
                        {inv.invoiceStatus || 'draft'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">
                      ${parseFloat(inv.total || '0').toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">
                      ${parseFloat(inv.balanceDue || '0').toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        total={data?.total ?? 0}
        limit={PAGE_SIZE}
        offset={offset}
        onChange={setOffset}
        unit="invoices"
      />
    </div>
  );
}
