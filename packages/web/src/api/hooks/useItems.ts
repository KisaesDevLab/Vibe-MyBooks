// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Item, CreateItemInput, UpdateItemInput } from '@kis-books/shared';
import { apiClient } from '../client';

export interface ItemFilters {
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useItems(filters?: ItemFilters) {
  const params = new URLSearchParams();
  if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['items', filters],
    queryFn: () => apiClient<{ data: Item[]; total: number }>(`/items${qs ? `?${qs}` : ''}`),
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: ['items', id],
    queryFn: () => apiClient<{ item: Item }>(`/items/${id}`),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) =>
      apiClient<{ item: Item }>('/items', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateItemInput & { id: string }) =>
      apiClient<{ item: Item }>(`/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useDeactivateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ item: Item }>(`/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useExportItems() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/items/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'items.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useImportItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { items: Array<{ name: string; description?: string; unitPrice?: string; incomeAccountId: string; isTaxable?: boolean }> }) =>
      apiClient('/items/import', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}
