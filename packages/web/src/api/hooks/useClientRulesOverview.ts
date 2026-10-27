// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClientAccountMapping,
  ClientRulesOverviewResponse,
  ClientRulesOverviewSortKey,
  ClientRulesPostResult,
} from '@kis-books/shared';
import { apiClient } from '../client';

const BASE = '/practice/client-rules-overview';

export interface ClientRulesOverviewFilters {
  limit: number;
  offset: number;
  search?: string;
  sortBy?: ClientRulesOverviewSortKey;
  sortDir?: 'asc' | 'desc';
  includeExcluded?: boolean;
}

export function useClientRulesOverview(filters: ClientRulesOverviewFilters) {
  const params = new URLSearchParams({ limit: String(filters.limit), offset: String(filters.offset) });
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDir) params.set('sortDir', filters.sortDir);
  if (filters.includeExcluded) params.set('includeExcluded', 'true');
  return useQuery({
    queryKey: ['client-rules-overview', filters],
    queryFn: () => apiClient<ClientRulesOverviewResponse>(`${BASE}?${params.toString()}`),
    staleTime: 30 * 1000,
    // Re-sorting or paging keeps the current table on screen until the
    // next page arrives, instead of flashing the skeleton.
    placeholderData: keepPreviousData,
  });
}

export function usePostClientRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenantIds: string[]; ruleIds?: string[] }) =>
      apiClient<ClientRulesPostResult>(`${BASE}/post`, { method: 'POST', body: JSON.stringify(input) }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['client-rules-overview'] });
      queryClient.invalidateQueries({ queryKey: ['client-banking-status'] });
    },
  });
}

// Keep a client off the overview and out of bulk posting (or bring it back).
export function useSetClientExcluded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, excluded }: { tenantId: string; excluded: boolean }) =>
      apiClient<{ excluded: boolean }>(`${BASE}/tenants/${tenantId}/exclusion`, {
        method: 'PUT',
        body: JSON.stringify({ excluded }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-rules-overview'] }),
  });
}

export interface MappableAccount {
  id: string;
  name: string;
  accountNumber: string | null;
  accountType: string;
}

export function useClientMappingOptions(tenantId: string | null) {
  return useQuery({
    queryKey: ['client-rules-overview', 'mapping-options', tenantId],
    queryFn: () => apiClient<{ accounts: MappableAccount[]; mappings: ClientAccountMapping[] }>(
      `${BASE}/tenants/${tenantId}/mapping-options`,
    ),
    enabled: !!tenantId,
  });
}

export function useSaveClientMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, ...input }: ClientAccountMapping & { tenantId: string }) =>
      apiClient<ClientAccountMapping>(`${BASE}/tenants/${tenantId}/mappings`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-rules-overview'] }),
  });
}
