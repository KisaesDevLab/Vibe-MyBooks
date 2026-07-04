// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReconciliations, useUndoReconciliation } from '../../api/hooks/useBanking';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { useToast } from '../../components/ui/Toaster';

export function ReconciliationHistoryPage() {
  const [accountId, setAccountId] = useState('');
  const { data, isLoading, isError, refetch } = useReconciliations(accountId);
  const undoRecon = useUndoReconciliation();
  const toast = useToast();
  // History is ordered by statement date DESC, so the first completed row is the
  // most recent — the ONLY one eligible to undo (server enforces this too).
  const latestCompleteId = data?.reconciliations.find((r) => r.status === 'complete')?.id;
  const onUndo = (id: string) => undoRecon.mutate(id, {
    onSuccess: () => toast.success('Reconciliation undone.'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not undo reconciliation.'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reconciliation History</h1>
      <div className="max-w-xs mb-4">
        <AccountSelector label="Bank Account" value={accountId} onChange={setAccountId} accountTypeFilter="asset" />
      </div>

      {!accountId ? (
        <p className="text-sm text-gray-500">Select a bank account to view history.</p>
      ) : isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError ? (
        <ErrorMessage message="Couldn't load reconciliation history." onRetry={() => refetch()} />
      ) : !data?.reconciliations.length ? (
        <p className="text-sm text-gray-500">No reconciliations for this account.</p>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statement Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ending Balance</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.reconciliations.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.statementDate}</td>
                  <td className="px-4 py-2 text-right font-mono">${parseFloat(r.statementEndingBalance).toFixed(2)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {r.status === 'complete' && (
                      <Link
                        to={`/reports/reconciliation-detail?reconciliation_id=${r.id}`}
                        className="text-sm text-primary-600 hover:underline mr-3"
                      >
                        Report
                      </Link>
                    )}
                    {r.status === 'complete' && r.id === latestCompleteId ? (
                      <Button variant="ghost" size="sm" onClick={() => onUndo(r.id)} loading={undoRecon.isPending}>Undo</Button>
                    ) : r.status === 'complete' ? (
                      <span className="text-xs text-gray-400" title="Undo a newer reconciliation first">Locked</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
