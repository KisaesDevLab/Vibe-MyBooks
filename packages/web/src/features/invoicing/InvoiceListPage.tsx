// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../api/hooks/useInvoices';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Plus, Search } from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useInvoices({
    status: statusFilter ? statusFilter as 'posted' | 'draft' | 'void' : undefined,
    search: search || undefined,
    limit: 50,
    offset: 0,
  });

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

      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="void">Void</option>
        </select>
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
      <p className="text-sm text-gray-500 mt-2">{data?.total ?? 0} invoices</p>
    </div>
  );
}
