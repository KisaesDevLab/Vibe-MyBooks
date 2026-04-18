// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlaidItem, PlaidAccount, PlaidItemActivity } from '@kis-books/shared';
import { apiClient } from '../client';

export function usePlaidItems() {
  return useQuery({
    queryKey: ['plaid', 'items'],
    queryFn: () => apiClient<{ items: PlaidItem[] }>('/plaid/items'),
  });
}

export function usePlaidItemDetail(itemId: string) {
  return useQuery({
    queryKey: ['plaid', 'items', itemId],
    queryFn: () => apiClient<{ item: PlaidItem; accounts: PlaidAccount[] }>(`/plaid/items/${itemId}`),
    enabled: !!itemId,
  });
}

export function useCreateLinkToken() {
  return useMutation({
    mutationFn: () => apiClient<{ linkToken: string }>('/plaid/link-token', { method: 'POST' }),
  });
}

export interface ExchangeTokenInput {
  publicToken: string;
  institutionId?: string;
  institutionName?: string;
  accounts?: Array<{ id: string; name?: string; type?: string; subtype?: string; mask?: string }>;
  linkSessionId?: string;
  forceNew?: boolean;
}

export interface ExchangeTokenResult {
  item: PlaidItem;
  isExisting?: boolean;
  accounts?: PlaidAccount[];
}

export function useExchangeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExchangeTokenInput) =>
      apiClient<ExchangeTokenResult>('/plaid/exchange', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export interface PlaidInstitutionCheckResult {
  exists: boolean;
  existingItemId?: string;
  accountCount?: number;
  hiddenCount?: number;
}

export function useCheckInstitution() {
  return useMutation({
    mutationFn: (institutionId: string) =>
      apiClient<PlaidInstitutionCheckResult>(`/plaid/check-institution?institutionId=${institutionId}`),
  });
}

// Tier 1: Unmap company from item
export function useUnmapCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, deletePendingItems }: { itemId: string; deletePendingItems?: boolean }) =>
      apiClient(`/plaid/items/${itemId}/unmap-company`, { method: 'POST', body: JSON.stringify({ deletePendingItems }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

// Tier 2: Delete entire connection
export function useRemovePlaidItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, deleteFeedItems }: { itemId: string; deleteFeedItems?: boolean }) =>
      apiClient(`/plaid/items/${itemId}`, { method: 'DELETE', body: JSON.stringify({ deleteFeedItems }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

// Two-step mapping: assign account to company + COA + sync date
export function useAssignPlaidAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, tenantId, coaAccountId, syncStartDate }: {
      accountId: string; tenantId?: string; coaAccountId: string; syncStartDate?: string | null;
    }) => apiClient(`/plaid/accounts/${accountId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ tenantId, coaAccountId, syncStartDate }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export function useUnmapPlaidAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => apiClient(`/plaid/accounts/${accountId}/unmap`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export function useRemapPlaidAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, coaAccountId }: { accountId: string; coaAccountId: string }) =>
      apiClient(`/plaid/accounts/${accountId}/remap`, { method: 'PUT', body: JSON.stringify({ coaAccountId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export function useUpdateSyncDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, syncStartDate }: { accountId: string; syncStartDate: string | null }) =>
      apiClient(`/plaid/accounts/${accountId}/sync-date`, { method: 'PUT', body: JSON.stringify({ syncStartDate }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export function useTogglePlaidSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, enabled }: { accountId: string; enabled: boolean }) =>
      apiClient(`/plaid/accounts/${accountId}/sync-toggle`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export interface PlaidAccountSuggestion {
  coaAccountId: string;
  coaAccountNumber?: string | null;
  coaAccountName: string;
  confidence: string;
}

export function usePlaidAccountSuggestions(accountId: string) {
  return useQuery({
    queryKey: ['plaid', 'suggestions', accountId],
    queryFn: () => apiClient<{ suggestions: PlaidAccountSuggestion[] }>(`/plaid/accounts/${accountId}/suggestions`),
    enabled: !!accountId,
  });
}

export function useSyncPlaidItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiClient(`/plaid/items/${itemId}/sync`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plaid'] }),
  });
}

export function useCreateUpdateLinkToken() {
  return useMutation({
    mutationFn: (itemId: string) => apiClient<{ linkToken: string }>('/plaid/link-token/update', { method: 'POST', body: JSON.stringify({ itemId }) }),
  });
}

export function usePlaidActivity(itemId: string) {
  return useQuery({
    queryKey: ['plaid', 'activity', itemId],
    queryFn: () => apiClient<{ activity: PlaidItemActivity[] }>(`/plaid/items/${itemId}/activity`),
    enabled: !!itemId,
  });
}

// Keep backward compatibility aliases
export { useAssignPlaidAccount as useMapPlaidAccount };
