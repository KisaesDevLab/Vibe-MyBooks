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

// ADR 0XX §8 — pre-delete usage check. Fetches counts of every place
// the tag is referenced so the confirm dialog can show an actionable
// "used by N transactions / M budgets" summary.
export interface TagUsageSnapshot {
  tag: Tag;
  usage: {
    transactionLines: number;
    transactions: number;
    budgets: number;
    items: number;
    vendorContacts: number;
    // ADR 0XY §2.1 — customer-only contact defaults are ignored by the
    // resolver but still block a tag delete via the FK on contacts.
    // Surfacing this separately so the UI can explain why the delete
    // is blocked even when the tag "shouldn't" apply to customers.
    customerContacts: number;
    bankRules: number;
    total: number;
  };
}

export function useTagUsage(tagId: string | null | undefined) {
  return useQuery({
    queryKey: ['tag-usage', tagId],
    queryFn: () => apiClient<TagUsageSnapshot>(`/tags/${tagId}/usage`),
    enabled: Boolean(tagId),
    staleTime: 30 * 1000,
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
