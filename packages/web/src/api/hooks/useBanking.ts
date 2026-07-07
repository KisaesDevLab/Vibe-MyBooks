// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BankConnection, BankFeedItem, BankFeedFilters, Reconciliation } from '@kis-books/shared';
import { apiClient, API_BASE } from '../client';

export function useBankConnections() {
  return useQuery({
    queryKey: ['bank-connections'],
    queryFn: () => apiClient<{ connections: BankConnection[] }>('/banking/connections'),
  });
}

export function useCreateBankConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; institutionName?: string }) =>
      apiClient('/banking/connections', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-connections'] }),
  });
}

export function useDisconnectBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-connections'] }),
  });
}

export function useBankFeed(filters?: BankFeedFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.bankConnectionId) params.set('bankConnectionId', filters.bankConnectionId);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.actionableOnly) params.set('actionableOnly', 'true');
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.sortDir) params.set('sortDir', filters.sortDir);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return useQuery({
    queryKey: ['bank-feed', filters],
    queryFn: () => apiClient<{ data: BankFeedItem[]; total: number }>(`/banking/feed${qs ? `?${qs}` : ''}`),
  });
}

export function useCategorizeFeedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; accountId: string; contactId?: string; memo?: string; tagId?: string | null }) =>
      apiClient(`/banking/feed/${id}/categorize`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

// Two-phase workflow: ASSIGN stages a category (no ledger post) — only the
// bank feed changes, so account balances don't move (no accounts invalidate).
export function useAssignFeedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; accountId: string; contactId?: string | null; tagId?: string | null; memo?: string | null }) =>
      apiClient(`/banking/feed/${id}/assign`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); },
  });
}

// APPROVE posts the staged assignment — balances move, so invalidate accounts.
export function useApproveFeedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/feed/${id}/approve`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

// Bulk ASSIGN — stage the same category across many items (no post).
export function useBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; accountId: string; contactId?: string | null; tagId?: string | null; memo?: string | null }) =>
      apiClient('/banking/feed/bulk-assign', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); },
  });
}

export function usePayrollOverlapCheck(feedItemId: string | null) {
  return useQuery({
    queryKey: ['bank-feed', 'payroll-overlap', feedItemId],
    queryFn: () => apiClient<{ overlaps: Array<{ txnId: string; memo: string; date: string; amount: string }> }>(
      `/banking/feed/${feedItemId}/payroll-overlap`,
    ),
    enabled: !!feedItemId,
  });
}

export function useMatchFeedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transactionId }: { id: string; transactionId: string }) =>
      apiClient(`/banking/feed/${id}/match`, { method: 'PUT', body: JSON.stringify({ transactionId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export interface MatchCandidate {
  id: string;
  txnType: string;
  txnNumber: string | null;
  txnDate: string;
  total: string;
  memo: string | null;
  checkNumber: number | null;
  printStatus: string | null;
  contactName: string | null;
}

export function useMatchCandidates(feedItemId: string | null) {
  return useQuery({
    queryKey: ['bank-feed', 'match-candidates', feedItemId],
    queryFn: () => apiClient<{ candidates: MatchCandidate[] }>(`/banking/feed/${feedItemId}/match-candidates`),
    enabled: !!feedItemId,
  });
}

export function useExcludeFeedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/feed/${id}/exclude`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export function useBulkApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemIds: string[]) =>
      apiClient<{ approved: number; skipped: number; failed: number }>('/banking/feed/bulk-approve', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

export function useBulkCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; accountId: string; contactId?: string; memo?: string; tagId?: string | null }) =>
      apiClient('/banking/feed/bulk-categorize', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

// ADR 0XX §7 — bulk set-tag. Posted items retag their journal lines; pending/
// assigned items stage the tag (applied when the item is approved/posted).
export interface BulkSetTagResult { updated: number; failures: Array<{ id: string; error: string }> }
export function useBulkSetTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; tagId: string | null }) =>
      apiClient<BulkSetTagResult>('/banking/feed/bulk-set-tag', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); },
  });
}

export function useBulkSetName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; name: string }) =>
      apiClient('/banking/feed/bulk-set-name', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); },
  });
}

/** Additive cleansing-outcome payload returned by every import/re-cleanse
 *  endpoint. Mirrors CleansingAggregate in
 *  packages/api/src/services/bank-feed.service.ts. */
export interface CleansingAggregateDto {
  processed: number;
  aiCleansed: number;
  aiFailed: number;
  disabled: number;
  firstError?: string;
}

export function useBulkRecleanse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemIds: string[]) =>
      apiClient<{ cleansed: number; cleansing?: CleansingAggregateDto }>(
        '/banking/feed/bulk-recleanse',
        { method: 'POST', body: JSON.stringify({ feedItemIds }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

/** Result of the "Reprocess Rules" bulk action. Mirrors
 *  ReprocessRulesResult in packages/api/src/services/bank-feed.service.ts. */
export interface ReprocessRulesResultDto {
  processed: number;
  matched: number;
  autoCategorized: number;
  suggestionsUpdated: number;
  untouched: number;
}

export function useBulkReprocessRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds?: string[]; allPending?: boolean; bankConnectionId?: string }) =>
      apiClient<ReprocessRulesResultDto>('/banking/feed/bulk-reprocess-rules', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // autoConfirm rules post ledger transactions, so account balances can
    // move — invalidate accounts alongside the feed (mirrors bulk-categorize).
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

export function useBulkExclude() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemIds: string[]) =>
      apiClient('/banking/feed/bulk-exclude', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export interface BankFileImportResult {
  imported: number;
  items: BankFeedItem[];
  cleansing?: CleansingAggregateDto;
}

export function useImportBankFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; accountId: string; mapping?: Record<string, number>; startDate?: string; endDate?: string }) => {
      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('accountId', input.accountId);
      if (input.mapping) formData.append('mapping', JSON.stringify(input.mapping));
      if (input.startDate) formData.append('startDate', input.startDate);
      if (input.endDate) formData.append('endDate', input.endDate);
      const res = await fetch(`${API_BASE}/banking/feed/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'Import failed'); }
      return res.json() as Promise<BankFileImportResult>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['bank-connections'] }); },
  });
}

// ─── Bank Statements (statement-driven reconciliation) ─────────────

export interface BankStatementRow {
  id: string;
  accountId: string;
  accountName: string;
  accountNumber: string | null;
  attachmentId: string | null;
  fileName: string | null;
  periodStart: string | null;
  periodEnd: string;
  openingBalance: string | null;
  closingBalance: string;
  maskedAccountNumber: string | null;
  institutionName: string | null;
  statementType: string | null;
  goldenRuleStatus: 'verified' | 'discrepancy' | 'unknown' | string;
  goldenRuleDelta: string | null;
  reconciliationId: string | null;
  status: 'reconciled' | 'in_progress' | 'not_reconciled';
  unpostedCount: number;
  accountHasInProgress: boolean;
  continuityWarning: { expected: number; actual: number; delta: number } | null;
  createdAt: string | null;
}

export interface StatementGapInfo {
  accountId: string;
  accountName: string;
  missingMonths: string[];
}

export interface BankStatementsResponse {
  statements: BankStatementRow[];
  total: number;
  gaps: StatementGapInfo[];
}

export function useBankStatements(accountId?: string, opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (accountId) params.set('account_id', accountId);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return useQuery({
    queryKey: ['bank-statements', accountId ?? '', opts?.limit ?? 50, opts?.offset ?? 0],
    queryFn: () => apiClient<BankStatementsResponse>(`/banking/statements${qs ? `?${qs}` : ''}`),
  });
}

export function useAutoClearStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reconciliationId: string) =>
      apiClient<{ cleared: number; alreadyCleared: number; unmatched: number }>(
        `/banking/reconciliations/${reconciliationId}/auto-clear-statement`, { method: 'POST' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation'] }),
  });
}

export function useReconciliations(accountId?: string) {
  return useQuery({
    queryKey: ['reconciliations', accountId],
    queryFn: () => apiClient<{ reconciliations: Reconciliation[] }>(`/banking/reconciliations${accountId ? `?account_id=${accountId}` : ''}`),
    enabled: !!accountId,
  });
}

// Server returns the base Reconciliation plus the joined journal_line /
// transaction rows and the derived cleared-balance totals.
// Shape mirrors getReconciliation() in
// packages/api/src/services/reconciliation.service.ts.
export interface ReconciliationLineRow {
  id: string;
  journal_line_id: string;
  is_cleared: boolean;
  cleared_at: string | null;
  debit: string;
  credit: string;
  description: string | null;
  txn_date: string;
  txn_type: string;
  txn_number: string | null;
  memo: string | null;
  // Statement Match Engine wave 1 — additive fields for the suggestions UI.
  check_number: number | null;
  payee_name_on_check: string | null;
  contact_id: string | null;
  contact_name: string | null;
}

// Override clearedBalance/difference — the shared `Reconciliation` type
// stores them as string|null (from the DB decimal column), but
// getReconciliation() parses them into numbers before returning. Using
// Omit+intersection avoids `string & number = never` intersection bugs.
export type ReconciliationWithLines = Omit<Reconciliation, 'clearedBalance' | 'difference'> & {
  lines: ReconciliationLineRow[];
  clearedBalance: number;
  difference: number;
  // Statement-driven reconciliation: the linked bank_statements row (null
  // for manual reconciliations) + the opening-balance continuity warning.
  statement?: {
    id: string;
    periodStart: string | null;
    periodEnd: string;
    openingBalance: string | null;
    closingBalance: string;
    attachmentId: string | null;
    // Statement Match Engine wave 1: stored bank_statement_lines count —
    // gates the "Match statement" button.
    lineCount?: number;
  } | null;
  continuityWarning?: { expected: number; actual: number; delta: number } | null;
};

export function useReconciliation(id: string) {
  return useQuery({
    queryKey: ['reconciliation', id],
    queryFn: () => apiClient<{ reconciliation: ReconciliationWithLines }>(`/banking/reconciliations/${id}`),
    enabled: !!id,
  });
}

export function useStartReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    // Manual start (accountId + statementDate + statementEndingBalance) or
    // statement-driven start (statementId only — the server derives the rest).
    mutationFn: (input: { accountId?: string; statementDate?: string; statementEndingBalance?: string; statementId?: string }) =>
      apiClient<{ reconciliation: Reconciliation }>('/banking/reconciliations', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      qc.invalidateQueries({ queryKey: ['bank-statements'] });
    },
  });
}

export function useUpdateReconciliationLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: Array<{ journalLineId: string; isCleared: boolean }> }) =>
      apiClient(`/banking/reconciliations/${id}/lines`, { method: 'PUT', body: JSON.stringify({ lines }) }),
    // Un-clearing a worksheet line resets its auto/confirmed statement-line
    // match server-side — refresh the open match panel too.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}

export function useCompleteReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/reconciliations/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      qc.invalidateQueries({ queryKey: ['bank-statements'] });
    },
  });
}

// Edit the statement ending balance on an in-progress reconciliation.
export function useUpdateReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statementEndingBalance }: { id: string; statementEndingBalance: string }) =>
      apiClient<{ reconciliation: ReconciliationWithLines }>(`/banking/reconciliations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ statementEndingBalance }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['reconciliation', vars.id] });
    },
  });
}

// Cancel (discard) an in-progress reconciliation, freeing the account to start
// a new one. Refreshes the history list + statements pool (the driving
// statement is unlinked server-side).
export function useCancelReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/reconciliations/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      qc.invalidateQueries({ queryKey: ['bank-statements'] });
    },
  });
}

// Pull transactions posted after the reconciliation was started into the
// worksheet (start() snapshots the lines, so a just-added transaction is
// otherwise invisible). Returns how many rows were added.
export function useRefreshReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ added: number }>(`/banking/reconciliations/${id}/refresh`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}

// ─── Statement Match Engine (wave 1) ───────────────────────────────

export interface StatementLineSummary {
  id: string;
  lineDate: string;
  description: string | null;
  amount: string;
  checkNumber: string | null;
  payee: string | null;
  matchStatus: string;
}

export interface StatementMatchCandidate {
  journalLineId: string;
  transactionId: string;
  txnDate: string;
  txnType: string;
  txnNumber: string | null;
  checkNumber: number | null;
  payee: string | null;
  amount: string;
  description: string | null;
  composite: number;
  amountScore: number;
  dateScore: number;
  nameScore: number;
  pool: 'A' | 'B';
  checkExact: boolean;
  amountDelta: number;
  dateDiffDays: number;
  idLinked?: boolean;
}

// Wave 2: grouped matches (suggest-only; a confirmed set sums exactly).
export interface StatementGroupLine {
  journalLineId: string;
  transactionId: string;
  txnDate: string;
  txnType: string;
  txnNumber: string | null;
  checkNumber: number | null;
  payee: string | null;
  amount: string;
  description: string | null;
  dateDiffDays: number;
}

export interface StatementGroupCandidate {
  kind: 'one_to_many' | 'many_to_one';
  /** one_to_many: the 2..5 worksheet members; many_to_one: exactly one. */
  journalLines: StatementGroupLine[];
  /** many_to_one: every member statement line, primary first. */
  memberStatementLines: StatementLineSummary[];
  sum: string;
  dateSpanDays: number;
}

export interface StatementMatchSuggestion {
  statementLine: StatementLineSummary;
  candidates: StatementMatchCandidate[];
  groupCandidates?: StatementGroupCandidate[];
}

export interface StatementMatchResult {
  autoCleared: number;
  suggestions: StatementMatchSuggestion[];
  unmatchedLines: StatementLineSummary[];
  outstandingCount: number;
  skippedLines: number;
  skippedAmbiguousGroups: number;
}

export interface StatementMatchesView {
  statementId: string;
  counts: { auto: number; confirmed: number; suggested: number; unmatched: number; rejected: number; excluded: number };
  suggestions: StatementMatchSuggestion[];
  unmatchedLines: StatementLineSummary[];
  // OCR-error / non-transaction lines the operator hid (restorable).
  excludedLines: StatementLineSummary[];
  outstandingCount: number;
}

export function useMatchStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reconciliationId: string) =>
      apiClient<StatementMatchResult>(
        `/banking/reconciliations/${reconciliationId}/match-statement`, { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}

export function useStatementMatches(reconciliationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['statement-matches', reconciliationId],
    queryFn: () => apiClient<StatementMatchesView>(`/banking/reconciliations/${reconciliationId}/statement-matches`),
    enabled: enabled && !!reconciliationId,
  });
}

// Wave 2: the same confirm route also accepts grouped forms —
// journalLineIds (one statement line ↔ many worksheet lines) or
// journalLineId + memberStatementLineIds (many statement lines ↔ one line).
export interface ConfirmStatementLinePayload {
  lineId: string;
  journalLineId?: string;
  journalLineIds?: string[];
  memberStatementLineIds?: string[];
}

export function useConfirmStatementLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, ...body }: ConfirmStatementLinePayload) =>
      apiClient<{ line: StatementLineSummary }>(
        `/banking/statement-lines/${lineId}/confirm`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}

// Wave 2 Feature B: "Add to books" — post a transaction from an unmatched
// statement line and clear it on the worksheet.
export interface CreateFromStatementLinePayload {
  lineId: string;
  accountId: string;
  contactId?: string;
  memo?: string;
}

export function useCreateFromStatementLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, ...body }: CreateFromStatementLinePayload) =>
      apiClient<{ line: StatementLineSummary; transactionId: string }>(
        `/banking/statement-lines/${lineId}/create-transaction`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRejectStatementLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) =>
      apiClient<{ line: StatementLineSummary }>(`/banking/statement-lines/${lineId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}

// Exclude / restore an OCR-error statement line. `exclude:false` restores it
// back to the unmatched list.
export function useExcludeStatementLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, exclude }: { lineId: string; exclude: boolean }) =>
      apiClient<{ line: StatementLineSummary }>(
        `/banking/statement-lines/${lineId}/${exclude ? 'exclude' : 'unexclude'}`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}

export function useUndoReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/reconciliations/${id}/undo`, { method: 'POST' }),
    // Undo resets every auto/confirmed statement-line match of the linked
    // statement — the match panel must not keep showing them.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      qc.invalidateQueries({ queryKey: ['statement-matches'] });
    },
  });
}
