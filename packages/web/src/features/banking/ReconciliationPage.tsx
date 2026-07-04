// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useStartReconciliation, useReconciliation, useUpdateReconciliationLines, useCompleteReconciliation,
  useBankStatements, useAutoClearStatement, type BankStatementRow,
} from '../../api/hooks/useBanking';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { DatePicker } from '../../components/forms/DatePicker';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { useToast } from '../../components/ui/Toaster';
import { AlertTriangle, FileText, Sparkles } from 'lucide-react';

// Open the statement PDF in a new tab via the single-use download token
// (same pattern as ReportShell's openPdfInTab — window.open can't carry an
// Authorization header).
async function openAttachmentInTab(attachmentId: string) {
  const { token } = await apiClient<{ token: string; expiresIn: number }>(
    '/downloads/token', { method: 'POST', body: JSON.stringify({}) },
  );
  window.open(
    `${API_BASE}/attachments/${attachmentId}/download?inline=1&_dl=${encodeURIComponent(token)}`,
    '_blank', 'noopener',
  );
}

const money = (v: string | number | null | undefined) =>
  v == null || v === '' ? '—' : `$${parseFloat(String(v)).toFixed(2)}`;

function StatementStatusChip({ status }: { status: BankStatementRow['status'] }) {
  const styles: Record<BankStatementRow['status'], string> = {
    reconciled: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    not_reconciled: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<BankStatementRow['status'], string> = {
    reconciled: 'Reconciled',
    in_progress: 'In progress',
    not_reconciled: 'Not reconciled',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${styles[status]}`}>{labels[status]}</span>;
}

// Statements on file for the tenant (optionally filtered by account), each
// with derived reconciliation status, readiness, and a one-click Reconcile.
function StatementsTable({ onStarted }: { onStarted: (reconId: string) => void }) {
  const [accountFilter, setAccountFilter] = useSessionState('vibe:reconcile:accountFilter', '');
  const { data, isLoading, isError, refetch } = useBankStatements(accountFilter || undefined);
  const startRecon = useStartReconciliation();
  const toast = useToast();
  const [startingId, setStartingId] = useState('');

  const handleReconcile = (stmt: BankStatementRow) => {
    if (stmt.unpostedCount > 0) {
      const ok = window.confirm(
        `${stmt.unpostedCount} imported item${stmt.unpostedCount === 1 ? '' : 's'} from this statement ` +
        `${stmt.unpostedCount === 1 ? 'is' : 'are'} not posted yet — they won't appear on the worksheet ` +
        'until categorized or matched. Start the reconciliation anyway?',
      );
      if (!ok) return;
    }
    setStartingId(stmt.id);
    startRecon.mutate({ statementId: stmt.id }, {
      onSuccess: (res) => onStarted(res.reconciliation.id),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not start reconciliation.'),
      onSettled: () => setStartingId(''),
    });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Statements on File</h2>
        <div className="w-64">
          <AccountSelector value={accountFilter} onChange={setAccountFilter} accountTypeFilter={['asset', 'liability']} />
        </div>
        {accountFilter && (
          <button className="text-xs text-gray-500 hover:text-gray-700 underline" onClick={() => setAccountFilter('')}>
            Clear filter
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-8" />
      ) : isError ? (
        <ErrorMessage message="Couldn't load statements." onRetry={() => refetch()} />
      ) : !data || data.statements.length === 0 ? (
        <div className="bg-white rounded-lg border p-6 text-sm text-gray-500">
          No statements on file yet. Import a bank statement (Banking → Import Statement) and it will appear here,
          ready for one-click reconciliation.
        </div>
      ) : (
        <>
          {/* Statement coverage gaps per account */}
          {data.gaps.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800 space-y-1">
              {data.gaps.map((g) => (
                <p key={g.accountId} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <span className="font-medium">{g.accountName}:</span>{' '}
                    no statement on file for {g.missingMonths.join(', ')}
                  </span>
                </p>
              ))}
            </div>
          )}

          <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ending Balance</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Readiness</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.statements.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-900">{s.accountName}</span>
                      {s.maskedAccountNumber && <span className="text-gray-400 ml-1">··{s.maskedAccountNumber.slice(-4)}</span>}
                      {s.institutionName && <div className="text-xs text-gray-500">{s.institutionName}</div>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {s.periodStart ? `${s.periodStart} – ` : ''}{s.periodEnd}
                      {s.goldenRuleStatus === 'discrepancy' && (
                        <span
                          className="inline-flex ml-2 text-amber-600 align-middle"
                          title={`Statement didn't reconcile at import (opening + transactions ≠ closing)${s.goldenRuleDelta ? ` — off by $${Math.abs(parseFloat(s.goldenRuleDelta)).toFixed(2)}` : ''}`}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      )}
                      {s.continuityWarning && (
                        <span
                          className="inline-flex ml-1 text-amber-600 align-middle"
                          title={`Opening balance (${money(s.continuityWarning.actual)}) doesn't match the last reconciled ending balance (${money(s.continuityWarning.expected)})`}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{money(s.closingBalance)}</td>
                    <td className="px-4 py-2 text-center">
                      {s.unpostedCount > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                          {s.unpostedCount} not posted
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Ready</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center"><StatementStatusChip status={s.status} /></td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {s.attachmentId && (
                        <Button variant="ghost" size="sm" onClick={() => { void openAttachmentInTab(s.attachmentId!); }} title={s.fileName ?? 'View statement'}>
                          <FileText className="h-4 w-4 mr-1" /> View
                        </Button>
                      )}
                      {s.status === 'not_reconciled' && (
                        <span title={s.accountHasInProgress ? 'A reconciliation is already in progress for this account — finish or cancel it first.' : undefined}>
                          <Button
                            size="sm"
                            onClick={() => handleReconcile(s)}
                            disabled={s.accountHasInProgress || startRecon.isPending}
                            loading={startingId === s.id && startRecon.isPending}
                          >
                            Reconcile
                          </Button>
                        </span>
                      )}
                      {s.status === 'in_progress' && s.reconciliationId && (
                        <Button variant="secondary" size="sm" onClick={() => onStarted(s.reconciliationId!)}>Resume</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

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
  const [autoClearResult, setAutoClearResult] = useState<{ cleared: number; alreadyCleared: number; unmatched: number } | null>(null);

  const startRecon = useStartReconciliation();
  const { data: reconData, isLoading, isError, refetch } = useReconciliation(reconId);
  const updateLines = useUpdateReconciliationLines();
  const completeRecon = useCompleteReconciliation();
  const autoClear = useAutoClearStatement();
  const toast = useToast();

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

  const handleAutoClear = () => {
    autoClear.mutate(reconId, {
      onSuccess: (res) => {
        setAutoClearResult(res);
        toast.success(`Auto-clear: ${res.cleared} cleared, ${res.alreadyCleared} already cleared, ${res.unmatched} unmatched.`);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Auto-clear failed.'),
    });
  };

  const recon = reconData?.reconciliation;
  const lines = recon?.lines || [];

  // Bank account (asset): deposit = debit > 0 (money in); payment = credit > 0.
  const isDeposit = (l: (typeof lines)[number]) => parseFloat(l.debit) > 0;
  const amountOf = (l: (typeof lines)[number]) => (isDeposit(l) ? parseFloat(l.debit) : parseFloat(l.credit));

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

  if (!reconId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bank Reconciliation</h1>

        {/* Statements table — one-click reconcile from imported statements. */}
        <StatementsTable onStarted={setReconId} />

        <h2 className="text-lg font-semibold text-gray-900 mb-3">Start Manually</h2>
        <div className="max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <AccountSelector label="Bank Account" value={accountId} onChange={setAccountId} accountTypeFilter="asset" required />
          <DatePicker label="Statement Date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} required />
          <MoneyInput label="Statement Ending Balance" value={endingBalance} onChange={setEndingBalance} required />
          <Button onClick={handleStart} loading={startRecon.isPending} disabled={!accountId || !endingBalance}>
            Start Reconciliation
          </Button>
          {startRecon.isError && (
            <p className="text-sm text-red-600">
              {startRecon.error instanceof Error ? startRecon.error.message : 'Could not start reconciliation.'}
            </p>
          )}
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
  if (!recon) return <ErrorMessage message="Reconciliation not found." onRetry={() => refetch()} />;

  const diff = recon.difference ?? 0;
  const isBalanced = Math.abs(diff) < 0.01;
  const m = (n: number) => `$${n.toFixed(2)}`;
  const isComplete = recon.status === 'complete';

  // Cleared vs uncleared totals split by deposits vs payments (+ counts).
  const t = lines.reduce((acc, l) => {
    const key = `${isDeposit(l) ? 'dep' : 'pay'}${l.is_cleared ? 'Cleared' : 'Uncleared'}` as keyof typeof acc;
    acc[key] = { sum: acc[key].sum + amountOf(l), count: acc[key].count + 1 };
    return acc;
  }, { depCleared: { sum: 0, count: 0 }, depUncleared: { sum: 0, count: 0 }, payCleared: { sum: 0, count: 0 }, payUncleared: { sum: 0, count: 0 } });
  const depCount = t.depCleared.count + t.depUncleared.count;
  const payCount = t.payCleared.count + t.payUncleared.count;

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
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Reconcile</h1>
        {recon.statement?.attachmentId && (
          <Button variant="ghost" size="sm" onClick={() => { void openAttachmentInTab(recon.statement!.attachmentId!); }}>
            <FileText className="h-4 w-4 mr-1" /> View statement
          </Button>
        )}
        {isComplete && (
          <Link to={`/reports/reconciliation-detail?reconciliation_id=${reconId}`} className="text-sm text-primary-600 hover:underline">
            View report
          </Link>
        )}
      </div>

      {/* Opening-balance continuity warning (statement-driven recs). */}
      {recon.continuityWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Statement opening balance ({m(recon.continuityWarning.actual)}) doesn't match the last reconciled
            ending balance ({m(recon.continuityWarning.expected)}) — cleared transactions may have been changed
            or deleted since the last reconciliation.
          </p>
        </div>
      )}

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

      {/* Auto-clear the linked statement's transactions */}
      {recon.statement && !isComplete && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleAutoClear} loading={autoClear.isPending}>
            <Sparkles className="h-4 w-4 mr-1" /> Auto-clear statement transactions
          </Button>
          {autoClearResult && (
            <span className="text-sm text-gray-600">
              {autoClearResult.cleared} cleared · {autoClearResult.alreadyCleared} already cleared · {autoClearResult.unmatched} unmatched
            </span>
          )}
        </div>
      )}

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
                  <input type="checkbox" checked={line.is_cleared} disabled={isComplete}
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

      {!isComplete && (
        <Button onClick={() => completeRecon.mutate(reconId)} disabled={!isBalanced} loading={completeRecon.isPending}>
          Complete Reconciliation
        </Button>
      )}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 flex items-center gap-3 flex-wrap">
          <span>Reconciliation complete.</span>
          <Link to={`/reports/reconciliation-detail?reconciliation_id=${reconId}`} className="text-primary-600 hover:underline font-medium">
            View reconciliation report
          </Link>
        </div>
      )}
    </div>
  );
}
