// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useMemo } from 'react';
import { useStartReconciliation, useReconciliation, useUpdateReconciliationLines, useCompleteReconciliation } from '../../api/hooks/useBanking';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { DatePicker } from '../../components/forms/DatePicker';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function ReconciliationPage() {
  const [reconId, setReconId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [statementDate, setStatementDate] = useState(todayLocalISO());
  const [endingBalance, setEndingBalance] = useState('');
  // Row controls (hooks must be unconditional — declared before early returns).
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposits' | 'payments'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'type' | 'description' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const startRecon = useStartReconciliation();
  const { data: reconData, isLoading, isError, refetch } = useReconciliation(reconId);
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
  // Without an explicit error path, a fetch failure produced a blank
  // page (`if (!recon) return null`) — operators saw nothing happen
  // after clicking Start Reconciliation. Surface the failure with a
  // retry button so a transient network blip is recoverable without
  // re-entering the statement balance.
  if (isError) return <ErrorMessage message="Couldn't load this reconciliation." onRetry={() => refetch()} />;
  const recon = reconData?.reconciliation;
  if (!recon) return <ErrorMessage message="Reconciliation not found." onRetry={() => refetch()} />;

  const lines = recon.lines || [];
  const diff = recon.difference ?? 0;
  const isBalanced = Math.abs(diff) < 0.01;
  const m = (n: number) => `$${n.toFixed(2)}`;

  // Bank account (asset): deposit = debit > 0 (money in); payment = credit > 0.
  const isDeposit = (l: typeof lines[number]) => parseFloat(l.debit) > 0;
  const amountOf = (l: typeof lines[number]) => (isDeposit(l) ? parseFloat(l.debit) : parseFloat(l.credit));

  // Cleared vs uncleared totals split by deposits vs payments (+ counts).
  const t = lines.reduce((acc, l) => {
    const key = `${isDeposit(l) ? 'dep' : 'pay'}${l.is_cleared ? 'Cleared' : 'Uncleared'}` as keyof typeof acc;
    acc[key] = { sum: acc[key].sum + amountOf(l), count: acc[key].count + 1 };
    return acc;
  }, { depCleared: { sum: 0, count: 0 }, depUncleared: { sum: 0, count: 0 }, payCleared: { sum: 0, count: 0 }, payUncleared: { sum: 0, count: 0 } });
  const depCount = t.depCleared.count + t.depUncleared.count;
  const payCount = t.payCleared.count + t.payUncleared.count;

  const view = useMemo(() => {
    let rows = lines;
    if (typeFilter === 'deposits') rows = rows.filter(isDeposit);
    else if (typeFilter === 'payments') rows = rows.filter((l) => !isDeposit(l));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((l) => `${l.description ?? ''} ${l.memo ?? ''} ${l.txn_type ?? ''}`.toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let c = 0;
      if (sortKey === 'date') c = String(a.txn_date).localeCompare(String(b.txn_date));
      else if (sortKey === 'type') c = String(a.txn_type).localeCompare(String(b.txn_type));
      else if (sortKey === 'description') c = String(a.description || a.memo || '').localeCompare(String(b.description || b.memo || ''));
      else c = amountOf(a) - amountOf(b);
      return c * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, typeFilter, search, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortArrow = (key: typeof sortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const TotalCard = ({ label, cleared, uncleared }: { label: string; cleared: { sum: number; count: number }; uncleared: { sum: number; count: number } }) => (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
      <div className="flex justify-between text-sm"><span className="text-green-700">Cleared</span><span className="font-mono">{m(cleared.sum)} <span className="text-gray-400">({cleared.count})</span></span></div>
      <div className="flex justify-between text-sm"><span className="text-amber-700">Uncleared</span><span className="font-mono">{m(uncleared.sum)} <span className="text-gray-400">({uncleared.count})</span></span></div>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Reconcile</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
          <p className="text-lg font-mono">${recon.clearedBalance.toFixed(2)}</p>
        </div>
        <div className={`rounded-lg border p-4 text-center ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-gray-500 uppercase">Difference</p>
          <p className={`text-lg font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>${Math.abs(diff).toFixed(2)}</p>
        </div>
      </div>

      {/* Cleared / uncleared totals split by deposits vs payments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <TotalCard label="Deposits (money in)" cleared={t.depCleared} uncleared={t.depUncleared} />
        <TotalCard label="Payments (money out)" cleared={t.payCleared} uncleared={t.payUncleared} />
      </div>

      {/* Filter buttons + search */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {([['all', `All (${lines.length})`], ['deposits', `Deposits (${depCount})`], ['payments', `Payments (${payCount})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm border ${typeFilter === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description / type…"
          className="ml-auto rounded-md border-gray-300 text-sm px-3 py-1.5 min-w-[14rem]" />
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto mb-4">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-2" />
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('date')}>Date{sortArrow('date')}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('type')}>Type{sortArrow('type')}</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('description')}>Description{sortArrow('description')}</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('amount')}>Payment{sortArrow('amount')}</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('amount')}>Deposit{sortArrow('amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {view.map((line) => (
              <tr key={line.id} className={line.is_cleared ? 'bg-green-50' : ''}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={line.is_cleared}
                    onChange={(e) => handleToggleLine(line.journal_line_id, e.target.checked)} className="rounded" />
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
        {view.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            {lines.length === 0
              ? 'No uncleared transactions for this account up to the statement date. Check the account and statement date, or post the transactions first.'
              : 'No rows match the current filter.'}
          </div>
        )}
      </div>

      <Button onClick={() => completeRecon.mutate(reconId)} disabled={!isBalanced} loading={completeRecon.isPending}>
        Complete Reconciliation
      </Button>
    </div>
  );
}
