// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Transaction, TransactionFilters,
  BulkUpdateTransactionsInput, BulkUpdateTransactionsResult,
} from '@kis-books/shared';
import { apiClient } from '../client';

export function useTransactions(filters?: TransactionFilters) {
  const params = new URLSearchParams();
  if (filters?.txnType) params.set('txnType', filters.txnType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.contactId) params.set('contactId', filters.contactId);
  if (filters?.accountId) params.set('accountId', filters.accountId);
  // Backend supports a header-level tag filter (any line carries the tag);
  // it was previously dropped here so the Tag dropdown did nothing.
  if (filters?.tagId) params.set('tagId', filters.tagId);
  if (filters?.source) params.set('source', filters.source);
  if (filters?.basis) params.set('basis', filters.basis);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.sortDir) params.set('sortDir', filters.sortDir);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => apiClient<{
      data: Transaction[];
      total: number;
      // Grand totals across the whole filtered set (void excluded). `amount`
      // for the single column; debit/credit when filtered by an account.
      totals?: { amount: string; debit: string; credit: string };
    }>(`/transactions${qs ? `?${qs}` : ''}`),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => apiClient<{ transaction: Transaction }>(`/transactions/${id}`),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiClient<{ transaction: Transaction }>('/transactions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Record<string, unknown> & { id: string }) =>
      apiClient<{ transaction: Transaction }>(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useVoidTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient(`/transactions/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDuplicateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/transactions/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useBulkUpdateTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkUpdateTransactionsInput) =>
      apiClient<BulkUpdateTransactionsResult>('/transactions/bulk-update', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // Category moves change denormalised account balances; invalidate both.
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
