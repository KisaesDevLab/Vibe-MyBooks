import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Transaction, TransactionFilters } from '@kis-books/shared';
import { apiClient } from '../client';

export function useTransactions(filters?: TransactionFilters) {
  const params = new URLSearchParams();
  if (filters?.txnType) params.set('txnType', filters.txnType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.contactId) params.set('contactId', filters.contactId);
  if (filters?.accountId) params.set('accountId', filters.accountId);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => apiClient<{ data: Transaction[]; total: number }>(`/transactions${qs ? `?${qs}` : ''}`),
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
