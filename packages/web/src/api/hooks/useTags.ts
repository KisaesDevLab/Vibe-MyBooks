// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tag, TagGroup, CreateTagInput, UpdateTagInput, TagFilters, SavedReportFilter } from '@kis-books/shared';
import { apiClient } from '../client';

export function useTags(filters?: TagFilters) {
  const params = new URLSearchParams();
  if (filters?.groupId) params.set('group_id', filters.groupId);
  if (filters?.isActive !== undefined) params.set('is_active', String(filters.isActive));
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['tags', filters],
    queryFn: () => apiClient<{ tags: Tag[] }>(`/tags${qs ? `?${qs}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTagGroups() {
  return useQuery({
    queryKey: ['tag-groups'],
    queryFn: () => apiClient<{ groups: (TagGroup & { tags: Tag[] })[] }>('/tags/groups/list'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagInput) => apiClient<{ tag: Tag }>('/tags', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['tag-groups'] }); },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTagInput & { id: string }) => apiClient<{ tag: Tag }>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['tag-groups'] }); },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['tag-groups'] }); },
  });
}

export function useMergeTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sourceTagId: string; targetTagId: string }) => apiClient('/tags/merge', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['tag-groups'] }); },
  });
}

export function useCreateTagGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; isSingleSelect?: boolean }) => apiClient('/tags/groups', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tag-groups'] }),
  });
}

export function useDeleteTagGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/tags/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tag-groups'] }); qc.invalidateQueries({ queryKey: ['tags'] }); },
  });
}

export function useAddTransactionTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, tagIds }: { transactionId: string; tagIds: string[] }) =>
      apiClient(`/tags/transactions/${transactionId}/add`, { method: 'POST', body: JSON.stringify({ tagIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useReplaceTransactionTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, tagIds }: { transactionId: string; tagIds: string[] }) =>
      apiClient(`/tags/transactions/${transactionId}`, { method: 'PUT', body: JSON.stringify({ tagIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useBulkTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transactionIds: string[]; tagIds: string[] }) =>
      apiClient('/tags/bulk-tag', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useSavedFilters(reportType?: string) {
  return useQuery({
    queryKey: ['saved-filters', reportType],
    queryFn: () => apiClient<{ filters: SavedReportFilter[] }>(`/tags/saved-filters${reportType ? `?report_type=${reportType}` : ''}`),
  });
}

export function useSaveFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; reportType: string; filters: Record<string, unknown> }) =>
      apiClient('/tags/saved-filters', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-filters'] }),
  });
}
