// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Account, CreateAccountInput, UpdateAccountInput, AccountFilters } from '@kis-books/shared';
import { apiClient } from '../client';

export function useAccounts(filters?: AccountFilters) {
  const params = new URLSearchParams();
  if (filters?.accountType) params.set('accountType', filters.accountType);
  if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['accounts', filters],
    queryFn: () => apiClient<{ data: Account[]; total: number }>(`/accounts${qs ? `?${qs}` : ''}`),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => apiClient<{ account: Account }>(`/accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      apiClient<{ account: Account }>('/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAccountInput & { id: string }) =>
      apiClient<{ account: Account }>(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useDeactivateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ account: Account }>(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useMergeAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sourceId: string; targetId: string }) =>
      apiClient('/accounts/merge', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useExportAccounts() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/accounts/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart-of-accounts.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useImportAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accounts: Array<{ name: string; accountNumber?: string; accountType: string; detailType?: string }>) =>
      apiClient('/accounts/import', {
        method: 'POST',
        body: JSON.stringify({ accounts }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
