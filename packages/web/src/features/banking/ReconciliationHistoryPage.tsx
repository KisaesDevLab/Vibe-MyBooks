import { useState } from 'react';
import { useReconciliations, useUndoReconciliation } from '../../api/hooks/useBanking';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function ReconciliationHistoryPage() {
  const [accountId, setAccountId] = useState('');
  const { data, isLoading } = useReconciliations(accountId);
  const undoRecon = useUndoReconciliation();

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
                  <td className="px-4 py-2 text-right">
                    {r.status === 'complete' && (
                      <Button variant="ghost" size="sm" onClick={() => undoRecon.mutate(r.id)}>Undo</Button>
                    )}
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
