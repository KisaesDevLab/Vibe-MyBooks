// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BankConnection, BankFeedItem, BankFeedFilters, Reconciliation } from '@kis-books/shared';
import { apiClient } from '../client';

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
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return useQuery({
    queryKey: ['bank-feed', filters],
    queryFn: () => apiClient<{ data: BankFeedItem[]; total: number }>(`/banking/feed${qs ? `?${qs}` : ''}`),
  });
}

export function useCategorizeFeedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; accountId: string; contactId?: string; memo?: string }) =>
      apiClient(`/banking/feed/${id}/categorize`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
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
      apiClient('/banking/feed/bulk-approve', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

export function useBulkCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; accountId: string; contactId?: string; memo?: string }) =>
      apiClient('/banking/feed/bulk-categorize', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); },
  });
}

export function useBulkRecleanse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemIds: string[]) =>
      apiClient('/banking/feed/bulk-recleanse', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
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

export function useImportBankFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; accountId: string; mapping?: Record<string, number> }) => {
      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('accountId', input.accountId);
      if (input.mapping) formData.append('mapping', JSON.stringify(input.mapping));
      const res = await fetch('/api/v1/banking/feed/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'Import failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-feed'] }); qc.invalidateQueries({ queryKey: ['bank-connections'] }); },
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
}

// Override clearedBalance/difference — the shared `Reconciliation` type
// stores them as string|null (from the DB decimal column), but
// getReconciliation() parses them into numbers before returning. Using
// Omit+intersection avoids `string & number = never` intersection bugs.
export type ReconciliationWithLines = Omit<Reconciliation, 'clearedBalance' | 'difference'> & {
  lines: ReconciliationLineRow[];
  clearedBalance: number;
  difference: number;
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
    mutationFn: (input: { accountId: string; statementDate: string; statementEndingBalance: string }) =>
      apiClient<{ reconciliation: Reconciliation }>('/banking/reconciliations', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliations'] }),
  });
}

export function useUpdateReconciliationLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: Array<{ journalLineId: string; isCleared: boolean }> }) =>
      apiClient(`/banking/reconciliations/${id}/lines`, { method: 'PUT', body: JSON.stringify({ lines }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation'] }),
  });
}

export function useCompleteReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/reconciliations/${id}/complete`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation'] }); qc.invalidateQueries({ queryKey: ['reconciliations'] }); },
  });
}

export function useUndoReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/banking/reconciliations/${id}/undo`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reconciliation'] }); qc.invalidateQueries({ queryKey: ['reconciliations'] }); },
  });
}
