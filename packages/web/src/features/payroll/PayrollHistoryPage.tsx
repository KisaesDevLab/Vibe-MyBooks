// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import {
  usePayrollSessions,
  useDeletePayrollSession,
  useReversePayroll,
} from '../../api/hooks/usePayrollImport';
import type { PayrollSessionStatus } from '@kis-books/shared';

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  uploaded: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Uploaded' },
  mapped: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Mapped' },
  validated: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Validated' },
  posted: { bg: 'bg-green-100', text: 'text-green-700', label: 'Posted' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500 line-through', label: 'Reversed' },
};

export function PayrollHistoryPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<PayrollSessionStatus | ''>('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const { data, isLoading } = usePayrollSessions({
    status: statusFilter || undefined,
    limit,
    offset: page * limit,
  });
  const deleteMutation = useDeletePayrollSession();
  const reverseMutation = useReversePayroll();

  const sessions = data?.data || [];
  const total = data?.total || 0;

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this import session?')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleReverse = async (id: string) => {
    const reason = prompt('Reason for reversal:');
    if (!reason) return;
    await reverseMutation.mutateAsync({ sessionId: id, reason });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payroll Import History</h1>
        <Button onClick={() => navigate('/payroll/import')}>New Import</Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(0); }}
            >
              <option value="">All</option>
              <option value="uploaded">Uploaded</option>
              <option value="mapped">Mapped</option>
              <option value="validated">Validated</option>
              <option value="posted">Posted</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Reversed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No payroll imports yet.</p>
            <Button className="mt-4" onClick={() => navigate('/payroll/import')}>Import Payroll</Button>
          </div>
        ) : (
          <>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Rows</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Errors</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">JEs</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map(s => {
                  const badge = STATUS_BADGES[s.status] || STATUS_BADGES['uploaded']!;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium truncate max-w-[200px]">
                        {s.originalFilename}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {s.importMode === 'prebuilt_je' ? 'Mode B' : 'Mode A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.rowCount}</td>
                      <td className="px-4 py-3 text-right">
                        {s.errorCount > 0 ? (
                          <span className="text-red-600">{s.errorCount}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.jeCount}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {s.status === 'posted' && (
                            <button
                              onClick={() => handleReverse(s.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Reverse
                            </button>
                          )}
                          {['uploaded', 'mapped', 'failed'].includes(s.status) && (
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          )}
                          {s.journalEntryId && (
                            <Link
                              to={`/transactions/${s.journalEntryId}`}
                              className="text-xs text-primary-600 hover:text-primary-700"
                            >
                              View JE
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="secondary" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
