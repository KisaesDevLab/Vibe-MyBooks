// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useStartReconciliation, useReconciliation, useUpdateReconciliationLines, useCompleteReconciliation,
  useReconciliations, useUpdateReconciliation, useCancelReconciliation, useRefreshReconciliation,
  useBankStatements, useAutoClearStatement, type BankStatementRow,
  useMatchStatement, useStatementMatches, useConfirmStatementLine, useRejectStatementLine,
  useExcludeStatementLine, useCreateFromStatementLine,
  type StatementMatchResult, type StatementMatchCandidate, type StatementMatchSuggestion,
  type StatementLineSummary, type StatementGroupCandidate, type ConfirmStatementLinePayload,
} from '../../api/hooks/useBanking';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { DatePicker } from '../../components/forms/DatePicker';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { useToast } from '../../components/ui/Toaster';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AlertTriangle, FileText, Sparkles, Wand2, Check, X, Plus, Pencil, RefreshCw, ChevronUp, ChevronDown, FileUp } from 'lucide-react';

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
  const navigate = useNavigate();
  const [accountFilter, setAccountFilter] = useSessionState('vibe:reconcile:accountFilter', '');
  // Default to "not reconciled" so the operator lands on the statements that
  // still need work; '' = All.
  const [statusFilter, setStatusFilter] = useSessionState<BankStatementRow['status'] | ''>('vibe:reconcile:statusFilter', 'not_reconciled');
  const { data, isLoading, isError, refetch } = useBankStatements(accountFilter || undefined);
  const startRecon = useStartReconciliation();
  const toast = useToast();
  const [startingId, setStartingId] = useState('');

  const visibleStatements = (data?.statements ?? []).filter(
    (s) => !statusFilter || s.status === statusFilter,
  );

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
        <Button variant="secondary" size="sm" onClick={() => navigate('/banking/statement-upload')}>
          <FileUp className="h-4 w-4 mr-1" /> Import statement (PDF)
        </Button>
        <div className="w-64">
          <AccountSelector value={accountFilter} onChange={setAccountFilter} accountTypeFilter={['asset', 'liability']} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BankStatementRow['status'] | '')}
          className="rounded-md border-gray-300 text-sm px-3 py-2"
          aria-label="Filter by reconciliation status"
        >
          <option value="">All statuses</option>
          <option value="not_reconciled">Not reconciled</option>
          <option value="in_progress">In progress</option>
          <option value="reconciled">Reconciled</option>
        </select>
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
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-10 text-center">
          <FileUp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No statements on file yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload a bank statement PDF (or image) — we’ll extract the lines so you can reconcile against your books.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigate('/banking/statement-upload')}>
              <FileUp className="h-4 w-4 mr-1" /> Upload statement (PDF)
            </Button>
          </div>
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

          {visibleStatements.length === 0 ? (
            <div className="bg-white rounded-lg border p-6 text-sm text-gray-500">
              No statements match this filter.{' '}
              <button className="text-primary-600 hover:underline" onClick={() => setStatusFilter('')}>Show all</button>
            </div>
          ) : (
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
                {visibleStatements.map((s) => (
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
          )}
        </>
      )}
    </div>
  );
}

// ─── Statement Match Engine (wave 1) ────────────────────────────────

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
};

// Human evidence chips for one candidate: why the engine thinks this is it.
function evidenceChips(c: StatementMatchCandidate): string[] {
  const chips: string[] = [];
  if (c.idLinked) chips.push('Matched via bank feed');
  if (c.pool === 'A') chips.push('Exact amount');
  else chips.push(`Amount differs by $${Math.abs(c.amountDelta).toFixed(2)}`);
  const d = Math.abs(c.dateDiffDays);
  chips.push(d === 0 ? 'Same day' : `${d} day${d === 1 ? '' : 's'} apart`);
  if (c.checkExact && c.checkNumber != null) chips.push(`Check #${c.checkNumber}`);
  else if (!c.idLinked && c.nameScore > 0) chips.push(`Payee ${Math.round(c.nameScore * 100)}%`);
  return chips;
}

// Evidence chips for a grouped set: exact sum is the headline signal.
function groupEvidenceChips(g: StatementGroupCandidate): string[] {
  const n = g.kind === 'one_to_many' ? g.journalLines.length : g.memberStatementLines.length;
  return [
    'Sums exactly',
    `${n} items`,
    g.dateSpanDays === 0 ? 'Same day' : `${g.dateSpanDays}-day span`,
  ];
}

// Wave 2: grouped suggestion — "1 deposit ↔ 3 receipts" with the member
// rows listed, a single Confirm for the whole set, and a set picker when
// the engine found more than one exact-sum set.
function GroupSuggestionCard({
  suggestion, disabled, onConfirm, onReject, pending,
}: {
  suggestion: StatementMatchSuggestion;
  disabled: boolean;
  onConfirm: (payload: ConfirmStatementLinePayload) => void;
  onReject: (lineId: string) => void;
  pending: boolean;
}) {
  const { statementLine: sl } = suggestion;
  const sets = suggestion.groupCandidates ?? [];
  const [pickedIdx, setPickedIdx] = useState(0);
  const g = sets[Math.min(pickedIdx, sets.length - 1)];
  if (!g) return null;

  const isDeposit = parseFloat(sl.amount) > 0;
  const header = g.kind === 'one_to_many'
    ? `1 ${isDeposit ? 'deposit' : 'withdrawal'} ↔ ${g.journalLines.length} ${isDeposit ? 'receipts' : 'payments'}`
    : `${g.memberStatementLines.length} statement lines ↔ 1 book transaction`;

  const handleConfirm = () => {
    if (g.kind === 'one_to_many') {
      onConfirm({ lineId: sl.id, journalLineIds: g.journalLines.map((j) => j.journalLineId) });
    } else {
      onConfirm({
        lineId: sl.id,
        journalLineId: g.journalLines[0]!.journalLineId,
        memberStatementLineIds: g.memberStatementLines.filter((m) => m.id !== sl.id).map((m) => m.id),
      });
    }
  };

  return (
    <div className="border rounded-lg p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm min-w-0">
          <p className="text-xs text-gray-500 uppercase mb-0.5">Grouped match — {header}</p>
          <p className="text-gray-900">
            <span className="font-mono">{sl.lineDate}</span>
            <span className="mx-2">·</span>{sl.description || sl.payee || '—'}
            <span className="mx-2">·</span><span className="font-mono font-medium">{fmtMoney(sl.amount)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" disabled={disabled} loading={pending} onClick={handleConfirm}>
            <Check className="h-4 w-4 mr-1" /> Confirm set
          </Button>
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onReject(sl.id)}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </div>

      {sets.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {sets.map((_, i) => (
            <button key={i} onClick={() => setPickedIdx(i)}
              className={`text-xs px-2 py-1 rounded-md border ${i === pickedIdx ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              Set {i + 1}
            </button>
          ))}
          <span className="text-xs text-gray-500 self-center">Multiple exact-sum sets found — pick one to confirm.</span>
        </div>
      )}

      <div className="mt-2 space-y-1">
        {(g.kind === 'one_to_many' ? g.journalLines : []).map((m) => (
          <div key={m.journalLineId} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm bg-gray-50">
            <span className="font-mono">{m.txnDate}</span>
            <span className="text-gray-500">{m.txnType}{m.txnNumber ? ` #${m.txnNumber}` : ''}{m.checkNumber != null ? ` · check ${m.checkNumber}` : ''}</span>
            <span className="text-gray-900 truncate max-w-[16rem]">{m.payee || m.description || '—'}</span>
            <span className="font-mono font-medium ml-auto">{fmtMoney(m.amount)}</span>
          </div>
        ))}
        {g.kind === 'many_to_one' && (
          <>
            {g.memberStatementLines.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm bg-gray-50">
                <span className="font-mono">{m.lineDate}</span>
                <span className="text-gray-900 truncate max-w-[16rem]">{m.description || m.payee || '—'}</span>
                <span className="font-mono font-medium ml-auto">{fmtMoney(m.amount)}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm border border-primary-200 bg-primary-50">
              <span className="text-xs text-gray-500 uppercase">In your books</span>
              <span className="font-mono">{g.journalLines[0]!.txnDate}</span>
              <span className="text-gray-900 truncate max-w-[16rem]">{g.journalLines[0]!.payee || g.journalLines[0]!.description || '—'}</span>
              <span className="font-mono font-medium ml-auto">{fmtMoney(g.journalLines[0]!.amount)}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="text-sm text-gray-600 mr-1">
          Set total <span className="font-mono font-medium">{fmtMoney(g.sum)}</span> = statement line
        </span>
        {groupEvidenceChips(g).map((chip) => (
          <span key={chip} className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">{chip}</span>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion, disabled, onConfirm, onReject, pending,
}: {
  suggestion: StatementMatchSuggestion;
  disabled: boolean;
  onConfirm: (payload: ConfirmStatementLinePayload) => void;
  onReject: (lineId: string) => void;
  pending: boolean;
}) {
  const { statementLine: sl, candidates } = suggestion;
  const [pickedId, setPickedId] = useState(candidates[0]?.journalLineId ?? '');

  // Wave 2: group-only suggestions render the grouped card instead.
  if (candidates.length === 0 && (suggestion.groupCandidates?.length ?? 0) > 0) {
    return (
      <GroupSuggestionCard
        suggestion={suggestion}
        disabled={disabled}
        onConfirm={onConfirm}
        onReject={onReject}
        pending={pending}
      />
    );
  }

  const picked = candidates.find((c) => c.journalLineId === pickedId) ?? candidates[0];

  return (
    <div className="border rounded-lg p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm min-w-0">
          <p className="text-xs text-gray-500 uppercase mb-0.5">On the statement</p>
          <p className="text-gray-900">
            <span className="font-mono">{sl.lineDate}</span>
            <span className="mx-2">·</span>{sl.description || sl.payee || '—'}
            <span className="mx-2">·</span><span className="font-mono font-medium">{fmtMoney(sl.amount)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" disabled={disabled || !picked} loading={pending}
            onClick={() => picked && onConfirm({ lineId: sl.id, journalLineId: picked.journalLineId })}>
            <Check className="h-4 w-4 mr-1" /> Confirm
          </Button>
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onReject(sl.id)}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {candidates.map((c) => (
          <label key={c.journalLineId}
            className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${
              c.journalLineId === picked?.journalLineId ? 'bg-primary-50 border border-primary-200' : 'border border-transparent hover:bg-gray-50'
            }`}>
            {candidates.length > 1 && (
              <input type="radio" className="rounded-full" checked={c.journalLineId === picked?.journalLineId}
                onChange={() => setPickedId(c.journalLineId)} />
            )}
            <span className="font-mono">{c.txnDate}</span>
            <span className="text-gray-500">{c.txnType}{c.txnNumber ? ` #${c.txnNumber}` : ''}{c.checkNumber != null ? ` · check ${c.checkNumber}` : ''}</span>
            <span className="text-gray-900 truncate max-w-[16rem]">{c.payee || c.description || '—'}</span>
            <span className="font-mono font-medium">{fmtMoney(c.amount)}</span>
            <span className="flex flex-wrap gap-1 ml-auto">
              {evidenceChips(c).map((chip) => (
                <span key={chip} className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">{chip}</span>
              ))}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Wave 2 Feature B: "Add to books" — create a posted transaction from an
// unmatched statement line. Date and amount come from the line (read-only);
// the user picks the category account (and optionally a contact / memo).
function AddToBooksModal({
  line, onClose,
}: {
  line: StatementLineSummary;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [memo, setMemo] = useState(line.description ?? '');
  const createFromLine = useCreateFromStatementLine();
  const toast = useToast();
  const isDeposit = parseFloat(line.amount) > 0;

  const handleCreate = () => {
    createFromLine.mutate({
      lineId: line.id,
      accountId,
      ...(contactId ? { contactId } : {}),
      ...(memo.trim() ? { memo: memo.trim() } : {}),
    }, {
      onSuccess: () => {
        toast.success('Transaction created and cleared on the worksheet.');
        onClose();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create the transaction.'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Add to books</h3>
        <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-mono">{line.lineDate}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-mono font-medium">{fmtMoney(line.amount)} ({isDeposit ? 'deposit' : 'money out'})</span></div>
          {(line.payee || line.description) && (
            <div className="flex justify-between gap-3"><span className="text-gray-500">Payee</span><span className="truncate">{line.payee || line.description}</span></div>
          )}
          {line.checkNumber && (
            <div className="flex justify-between"><span className="text-gray-500">Check #</span><span className="font-mono">{line.checkNumber}</span></div>
          )}
        </div>
        <AccountSelector
          label={isDeposit ? 'Income category' : 'Expense category'}
          value={accountId}
          onChange={setAccountId}
          required
        />
        <ContactSelector label="Contact (optional)" value={contactId} onChange={setContactId} />
        <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        {createFromLine.isError && (
          <p className="text-sm text-red-600">
            {createFromLine.error instanceof Error ? createFromLine.error.message : 'Could not create the transaction.'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={createFromLine.isPending}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!accountId} loading={createFromLine.isPending}>
            Create transaction
          </Button>
        </div>
      </div>
    </div>
  );
}

// Suggestions + unmatched statement lines + outstanding chip, driven by the
// persisted match state (survives reloads).
// The confirm payload a suggestion resolves to on its own — the top-ranked
// candidate for a single match, or the FIRST exact-sum set for a grouped one.
// Used by "Confirm all"; mirrors each card's own Confirm handler. Returns null
// when a suggestion has nothing to confirm.
function defaultConfirmPayload(s: StatementMatchSuggestion): ConfirmStatementLinePayload | null {
  const sl = s.statementLine;
  if (s.candidates.length > 0 && s.candidates[0]) {
    return { lineId: sl.id, journalLineId: s.candidates[0].journalLineId };
  }
  const g = s.groupCandidates?.[0];
  if (g && g.journalLines[0]) {
    if (g.kind === 'one_to_many') {
      return { lineId: sl.id, journalLineIds: g.journalLines.map((j) => j.journalLineId) };
    }
    return {
      lineId: sl.id,
      journalLineId: g.journalLines[0].journalLineId,
      memberStatementLineIds: g.memberStatementLines.filter((m) => m.id !== sl.id).map((m) => m.id),
    };
  }
  return null;
}

function StatementMatchPanel({
  reconId, isComplete, onShowUncleared,
}: {
  reconId: string;
  isComplete: boolean;
  onShowUncleared: () => void;
}) {
  const { data, isLoading, isError, refetch } = useStatementMatches(reconId, true);
  const confirmLine = useConfirmStatementLine();
  const rejectLine = useRejectStatementLine();
  const excludeLine = useExcludeStatementLine();
  const toast = useToast();
  // Wave 2 Feature B: the statement line the "Add to books" modal is open for.
  const [addToBooksLine, setAddToBooksLine] = useState<StatementLineSummary | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);

  if (isLoading) return <LoadingSpinner className="py-6" />;
  if (isError) return <ErrorMessage message="Couldn't load statement match results." onRetry={() => refetch()} />;
  if (!data) return null;

  const handleConfirm = (payload: ConfirmStatementLinePayload) => {
    confirmLine.mutate(payload, {
      onSuccess: () => toast.success('Match confirmed — transaction cleared.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not confirm the match.'),
    });
  };
  const handleReject = (lineId: string) => {
    rejectLine.mutate(lineId, {
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not reject the suggestion.'),
    });
  };

  // Bulk actions. Payloads are captured up front so the per-confirm refetches
  // don't shift the list mid-loop. Confirm posts each match (clears the txn);
  // reject just dismisses the suggestion (recoverable).
  const handleConfirmAll = () => {
    const payloads = data.suggestions
      .map(defaultConfirmPayload)
      .filter((p): p is ConfirmStatementLinePayload => p !== null);
    if (payloads.length === 0) return;
    let failed = 0;
    let settled = 0;
    payloads.forEach((p) =>
      confirmLine.mutate(p, {
        onError: () => { failed++; },
        onSettled: () => {
          settled++;
          if (settled === payloads.length) {
            const ok = payloads.length - failed;
            if (ok > 0) toast.success(`Confirmed ${ok} match${ok === 1 ? '' : 'es'}${failed ? `; ${failed} failed` : ''}.`);
            else toast.error('Could not confirm the matches.');
          }
        },
      }),
    );
  };
  const handleRejectAll = () => {
    const ids = data.suggestions.map((s) => s.statementLine.id);
    ids.forEach((id) => rejectLine.mutate(id));
    if (ids.length > 0) toast.info(`Rejected ${ids.length} suggestion${ids.length === 1 ? '' : 's'}.`);
  };
  const bulkPending = confirmLine.isPending || rejectLine.isPending;

  const rejected = data.unmatchedLines.filter((l) => l.matchStatus === 'rejected');
  const unmatched = data.unmatchedLines.filter((l) => l.matchStatus !== 'rejected');

  return (
    <div className="space-y-4 mb-4">
      {/* Outstanding items — in the books, not on the statement. */}
      {data.outstandingCount > 0 && (
        <button
          onClick={onShowUncleared}
          className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          title="In your books, not on the statement — outstanding checks / deposits in transit. Click to filter the worksheet to uncleared rows."
        >
          {data.outstandingCount} outstanding item{data.outstandingCount === 1 ? '' : 's'} — in your books, not on the statement
        </button>
      )}

      {data.suggestions.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Suggested matches ({data.suggestions.length}) — review and confirm
            </h3>
            {/* Bulk actions — act on every suggestion at once (each uses its
                top candidate / first exact-sum set). Per-row buttons remain. */}
            {!isComplete && data.suggestions.length >= 2 && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={handleConfirmAll} loading={confirmLine.isPending} disabled={bulkPending}>
                  <Check className="h-4 w-4 mr-1" /> Confirm all ({data.suggestions.length})
                </Button>
                <Button size="sm" variant="secondary" onClick={handleRejectAll} disabled={bulkPending}>
                  <X className="h-4 w-4 mr-1" /> Reject all
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {data.suggestions.map((s) => (
              <SuggestionCard
                key={s.statementLine.id}
                suggestion={s}
                disabled={isComplete}
                onConfirm={handleConfirm}
                onReject={handleReject}
                pending={confirmLine.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {(unmatched.length > 0 || rejected.length > 0) && (
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            On the statement, not in your books ({unmatched.length + rejected.length})
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            These statement lines have no matching transaction. Add them to your books directly,
            import them through the bank feed, then run the match again.
          </p>
          <ul className="divide-y divide-gray-100 text-sm">
            {[...unmatched, ...rejected].map((l: StatementLineSummary) => (
              <li key={l.id} className="py-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono">{l.lineDate}</span>
                <span className="text-gray-700 truncate max-w-[24rem]">{l.description || l.payee || '—'}</span>
                {l.checkNumber && <span className="text-xs text-gray-500">check {l.checkNumber}</span>}
                <span className="font-mono font-medium ml-auto">{fmtMoney(l.amount)}</span>
                {l.matchStatus === 'rejected' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">suggestion rejected</span>
                )}
                {!isComplete && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setAddToBooksLine(l)}>
                      <Plus className="h-4 w-4 mr-1" /> Add to books
                    </Button>
                    {/* Hide an OCR error / non-transaction line (e.g. a $0.00
                        "Balance Summary" row) so it stops distorting the rec. */}
                    <Button size="sm" variant="ghost"
                      onClick={() => excludeLine.mutate({ lineId: l.id, exclude: true }, {
                        onSuccess: () => toast.success('Line excluded — hidden from this reconciliation.'),
                        onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not exclude the line.'),
                      })}
                      title="Exclude — this line is an OCR error / not a real transaction">
                      <X className="h-4 w-4 mr-1" /> Exclude
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Excluded OCR-error lines — hidden from the main list but restorable. */}
      {data.excludedLines.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <button
            onClick={() => setShowExcluded((v) => !v)}
            className="text-sm font-medium text-gray-600 hover:text-gray-800 flex items-center gap-1"
          >
            {showExcluded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Excluded lines ({data.excludedLines.length}) — hidden OCR errors / non-transactions
          </button>
          {showExcluded && (
            <ul className="divide-y divide-gray-100 text-sm mt-2">
              {data.excludedLines.map((l: StatementLineSummary) => (
                <li key={l.id} className="py-1.5 flex flex-wrap items-center gap-2 text-gray-500">
                  <span className="font-mono">{l.lineDate}</span>
                  <span className="truncate max-w-[24rem]">{l.description || l.payee || '—'}</span>
                  <span className="font-mono font-medium ml-auto">{fmtMoney(l.amount)}</span>
                  {!isComplete && (
                    <Button size="sm" variant="ghost"
                      onClick={() => excludeLine.mutate({ lineId: l.id, exclude: false }, {
                        onSuccess: () => toast.success('Line restored.'),
                        onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not restore the line.'),
                      })}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {addToBooksLine && (
        <AddToBooksModal line={addToBooksLine} onClose={() => setAddToBooksLine(null)} />
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
  // Statement Match Engine (wave 1): last run's banner + the uncleared-only
  // worksheet filter driven by the outstanding-items chip.
  const [matchResult, setMatchResult] = useState<StatementMatchResult | null>(null);
  const [unclearedOnly, setUnclearedOnly] = useState(false);
  // Inline edit of the statement ending balance (in-progress recs only).
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState('');
  // Confirm before discarding an in-progress reconciliation.
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const startRecon = useStartReconciliation();
  const { data: reconData, isLoading, isError, refetch } = useReconciliation(reconId);
  const updateLines = useUpdateReconciliationLines();
  const completeRecon = useCompleteReconciliation();
  const updateRecon = useUpdateReconciliation();
  const cancelRecon = useCancelReconciliation();
  const refreshRecon = useRefreshReconciliation();
  const autoClear = useAutoClearStatement();
  const matchStatement = useMatchStatement();
  const toast = useToast();
  // On the start screen, surface any in-progress reconciliation for the
  // chosen account so it can be resumed or discarded — otherwise the start
  // guard ("already in progress") is a dead end with no way back in.
  const { data: historyData } = useReconciliations(accountId);
  const inProgressRecon = historyData?.reconciliations.find((r) => r.status === 'in_progress');

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

  const handleSaveBalance = () => {
    updateRecon.mutate(
      { id: reconId, statementEndingBalance: balanceDraft },
      {
        onSuccess: () => {
          setEditingBalance(false);
          toast.success('Ending balance updated.');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update balance.'),
      },
    );
  };

  const handleRefresh = () => {
    refreshRecon.mutate(reconId, {
      onSuccess: (res) => {
        if (res.added > 0) {
          toast.success(`Added ${res.added} new transaction${res.added === 1 ? '' : 's'} to the worksheet.`);
        } else {
          toast.info('No new transactions to add. (Anything dated after the statement date won’t appear here.)');
        }
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not refresh transactions.'),
    });
  };

  const handleCancelRecon = (id: string, { resetView }: { resetView: boolean }) => {
    cancelRecon.mutate(id, {
      onSuccess: () => {
        if (resetView) setReconId('');
        setShowCancelConfirm(false);
        toast.success('Reconciliation canceled.');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not cancel reconciliation.'),
    });
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

  const handleMatchStatement = () => {
    matchStatement.mutate(reconId, {
      onSuccess: (res) => {
        setMatchResult(res);
        toast.success(`Statement match: ${res.autoCleared} auto-cleared, ${res.suggestions.length} suggestions.`);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Statement match failed.'),
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
    if (unclearedOnly) rows = rows.filter((l) => !l.is_cleared);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((l) => {
        // Search text fields AND the amount — both the plain "1500.00" and the
        // grouped "1,500.00" forms, so a query of 1500, 1500.00 or 1,500 hits.
        const amt = amountOf(l);
        const haystack = `${l.description ?? ''} ${l.memo ?? ''} ${l.txn_type ?? ''} ${amt.toFixed(2)} ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        return haystack.toLowerCase().includes(q);
      });
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
  }, [lines, typeFilter, search, sortKey, sortDir, unclearedOnly]);

  if (!reconId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bank Reconciliation</h1>

        {/* Statements table — one-click reconcile from imported statements. */}
        <StatementsTable onStarted={setReconId} />

        <h2 className="text-lg font-semibold text-gray-900 mb-3">Start Manually</h2>
        <div className="max-w-md bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <AccountSelector label="Bank Account" value={accountId} onChange={setAccountId} accountTypeFilter="asset" required />

          {/* An in-progress reconciliation blocks starting a new one — offer a
              way back in (resume) or out (cancel) instead of a dead-end error. */}
          {inProgressRecon && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
              <p className="text-sm text-amber-800">
                A reconciliation is already in progress for this account
                {inProgressRecon.createdAt ? ` (started ${new Date(inProgressRecon.createdAt).toLocaleDateString()})` : ''}.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setReconId(inProgressRecon.id)}>
                  Resume
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCancelRecon(inProgressRecon.id, { resetView: false })}
                  loading={cancelRecon.isPending}
                >
                  <X className="h-4 w-4 mr-1" /> Cancel it
                </Button>
              </div>
            </div>
          )}

          <DatePicker label="Statement Date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} required />
          <MoneyInput label="Statement Ending Balance" value={endingBalance} onChange={setEndingBalance} required />
          <Button onClick={handleStart} loading={startRecon.isPending} disabled={!accountId || !endingBalance || !!inProgressRecon}>
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
  // Select-all state is derived from the currently-visible (filtered) rows.
  const allVisibleCleared = view.length > 0 && view.every((l) => l.is_cleared);
  const someVisibleCleared = view.some((l) => l.is_cleared);

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
          {editingBalance && !isComplete ? (
            <div className="mt-1 space-y-1">
              <MoneyInput value={balanceDraft} onChange={setBalanceDraft} />
              <div className="flex items-center justify-center gap-1">
                <Button size="sm" onClick={handleSaveBalance} loading={updateRecon.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditingBalance(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-lg font-mono font-bold">${parseFloat(recon.statementEndingBalance).toFixed(2)}</p>
              {!isComplete && (
                <button
                  type="button"
                  onClick={() => { setBalanceDraft(recon.statementEndingBalance); setEditingBalance(true); }}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label="Edit statement ending balance"
                  title="Edit ending balance"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
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
          {/* Statement Match Engine (wave 1): scored matcher — visible when
              the linked statement has stored lines. */}
          {(recon.statement.lineCount ?? 0) > 0 && (
            <Button size="sm" onClick={handleMatchStatement} loading={matchStatement.isPending}>
              <Wand2 className="h-4 w-4 mr-1" /> Match statement
            </Button>
          )}
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

      {/* Statement match run banner */}
      {matchResult && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4 text-sm text-primary-900">
          {matchResult.autoCleared} auto-cleared · {matchResult.suggestions.length} suggestion{matchResult.suggestions.length === 1 ? '' : 's'} ·{' '}
          {matchResult.unmatchedLines.length} statement line{matchResult.unmatchedLines.length === 1 ? '' : 's'} unmatched ·{' '}
          {matchResult.outstandingCount} outstanding item{matchResult.outstandingCount === 1 ? '' : 's'}
        </div>
      )}

      {/* Suggestions / unmatched / outstanding (persisted match state) */}
      {recon.statement && (recon.statement.lineCount ?? 0) > 0 && (
        <StatementMatchPanel
          reconId={reconId}
          isComplete={isComplete}
          onShowUncleared={() => setUnclearedOnly(true)}
        />
      )}

      {/* Filter buttons + search */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {([['all', `All (${lines.length})`], ['deposits', `Deposits (${depCount})`], ['payments', `Payments (${payCount})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm border ${typeFilter === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        {unclearedOnly && (
          <button onClick={() => setUnclearedOnly(false)}
            className="px-3 py-1.5 rounded-md text-sm border bg-blue-600 text-white border-blue-600"
            title="Showing uncleared rows only — click to show all">
            Uncleared only ✕
          </button>
        )}
        {/* Pull in transactions entered after this reconciliation was started —
            the worksheet is snapshotted at start, so a just-added transaction
            won't appear until refreshed. */}
        {!isComplete && (
          <Button size="sm" variant="secondary" onClick={handleRefresh} loading={refreshRecon.isPending}
            title="Pull in transactions added since you started this reconciliation">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh transactions
          </Button>
        )}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description / type / amount…"
          className="ml-auto rounded-md border-gray-300 text-sm px-3 py-1.5 min-w-[14rem]" />
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto mb-4">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-2">
                {/* Clear / un-clear every currently-visible row in one call.
                    Targets the filtered `view`, so it respects the active
                    deposits/payments/uncleared/search filters. */}
                <input
                  type="checkbox"
                  className="rounded"
                  disabled={isComplete || view.length === 0 || updateLines.isPending}
                  checked={allVisibleCleared}
                  ref={(el) => { if (el) el.indeterminate = someVisibleCleared && !allVisibleCleared; }}
                  onChange={() =>
                    updateLines.mutate({
                      id: reconId,
                      lines: view.map((l) => ({ journalLineId: l.journal_line_id, isCleared: !allVisibleCleared })),
                    })
                  }
                  aria-label="Select all visible rows"
                  title={allVisibleCleared ? 'Un-clear all visible rows' : 'Clear all visible rows'}
                />
              </th>
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
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => completeRecon.mutate(reconId)} disabled={!isBalanced} loading={completeRecon.isPending}>
            Complete Reconciliation
          </Button>
          <Button variant="secondary" onClick={() => setShowCancelConfirm(true)}>
            <X className="h-4 w-4 mr-1" /> Cancel reconciliation
          </Button>
        </div>
      )}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 flex items-center gap-3 flex-wrap">
          <span>Reconciliation complete.</span>
          <Link to={`/reports/reconciliation-detail?reconciliation_id=${reconId}`} className="text-primary-600 hover:underline font-medium">
            View reconciliation report
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel this reconciliation?"
        message="This discards the in-progress reconciliation and un-clears every line. Nothing is posted to the ledger, and you can start a new reconciliation afterward. This cannot be undone."
        confirmLabel="Cancel reconciliation"
        cancelLabel="Keep working"
        variant="danger"
        onConfirm={() => handleCancelRecon(reconId, { resetView: true })}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}
