// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useStartReconciliation, useReconciliation, useUpdateReconciliationLines, useCompleteReconciliation } from '../../api/hooks/useBanking';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { DatePicker } from '../../components/forms/DatePicker';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function ReconciliationPage() {
  const [reconId, setReconId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]!);
  const [endingBalance, setEndingBalance] = useState('');

  const startRecon = useStartReconciliation();
  const { data: reconData, isLoading } = useReconciliation(reconId);
  const updateLines = useUpdateReconciliationLines();
  const completeRecon = useCompleteReconciliation();

  const handleStart = () => {
    startRecon.mutate({
      accountId,
      statementDate,
      statementEndingBalance: endingBalance,
    }, { onSuccess: (data) => setReconId(data.reconciliation.id) });
  };

  const handleToggleLine = (journalLineId: string, isCleared: boolean) => {
    updateLines.mutate({ id: reconId, lines: [{ journalLineId, isCleared }] });
  };

  if (!reconId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bank Reconciliation</h1>
        <div className="max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <AccountSelector label="Bank Account" value={accountId} onChange={setAccountId} accountTypeFilter="asset" required />
          <DatePicker label="Statement Date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} required />
          <MoneyInput label="Statement Ending Balance" value={endingBalance} onChange={setEndingBalance} required />
          <Button onClick={handleStart} loading={startRecon.isPending} disabled={!accountId || !endingBalance}>
            Start Reconciliation
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner className="py-12" />;
  const recon = reconData?.reconciliation;
  if (!recon) return null;

  const lines = recon.lines || [];
  const diff = recon.difference ?? 0;
  const isBalanced = Math.abs(diff) < 0.01;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Reconcile</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-xs text-gray-500 uppercase">Statement Balance</p>
          <p className="text-lg font-mono font-bold">${parseFloat(recon.statementEndingBalance).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-xs text-gray-500 uppercase">Beginning</p>
          <p className="text-lg font-mono">${parseFloat(recon.beginningBalance).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-xs text-gray-500 uppercase">Cleared</p>
          <p className="text-lg font-mono">${recon.clearedBalance?.toFixed(2) ?? '0.00'}</p>
        </div>
        <div className={`rounded-lg border p-4 text-center ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-gray-500 uppercase">Difference</p>
          <p className={`text-lg font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
            ${Math.abs(diff).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden mb-4">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-2" />
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deposit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line: any) => (
              <tr key={line.id} className={line.is_cleared ? 'bg-green-50' : ''}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={line.is_cleared}
                    onChange={(e) => handleToggleLine(line.journal_line_id, e.target.checked)}
                    className="rounded" />
                </td>
                <td className="px-4 py-2">{line.txn_date}</td>
                <td className="px-4 py-2">{line.txn_type}</td>
                <td className="px-4 py-2">{line.description || line.memo || '—'}</td>
                <td className="px-4 py-2 text-right font-mono">{parseFloat(line.credit) > 0 ? `$${parseFloat(line.credit).toFixed(2)}` : ''}</td>
                <td className="px-4 py-2 text-right font-mono">{parseFloat(line.debit) > 0 ? `$${parseFloat(line.debit).toFixed(2)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={() => completeRecon.mutate(reconId)} disabled={!isBalanced} loading={completeRecon.isPending}>
        Complete Reconciliation
      </Button>
    </div>
  );
}
