import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBills } from '../../api/hooks/useAp';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import type { BillStatus } from '@kis-books/shared';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'bg-yellow-100 text-yellow-800' },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
};

export function BillListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useBills({
    billStatus: statusFilter || undefined,
    search: search || undefined,
    limit: 100,
  });

  const bills = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/bills/new')}>Enter Bill</Button>
          <Button variant="secondary" onClick={() => navigate('/pay-bills')}>Pay Bills</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by vendor, bill #, vendor invoice #..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BillStatus | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : bills.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">
            No bills found. <Link to="/bills/new" className="text-primary-600">Enter your first bill →</Link>
          </p>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Bill #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Vendor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Vendor Inv #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Due</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Total</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Balance</th>
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
    </div>
  );
}
