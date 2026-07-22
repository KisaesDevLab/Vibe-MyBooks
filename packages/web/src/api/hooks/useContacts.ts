// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Contact, CreateContactInput, UpdateContactInput, ContactFilters } from '@kis-books/shared';
import { apiClient, API_BASE, APP_BASE } from '../client';

export function useContacts(filters?: ContactFilters) {
  const params = new URLSearchParams();
  if (filters?.contactType) params.set('contactType', filters.contactType);
  if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => apiClient<{ data: Contact[]; total: number }>(`/contacts${qs ? `?${qs}` : ''}`),
  });
}

// Category autofill for entry forms: the account to prefill when this contact
// is picked — configured default, else the category from its most recent
// transaction (the same shared resolver batch-entry and the bank feed use).
// Called imperatively on selection. { accountId: null } when there's no hint.
export function fetchSuggestedAccountForContact(id: string) {
  return apiClient<{ accountId: string | null; source: 'default' | 'recent' | null }>(
    `/contacts/${id}/suggest-account`,
  );
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => apiClient<{ contact: Contact }>(`/contacts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) =>
      apiClient<{ contact: Contact }>('/contacts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useBulkUpdateContactType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; contactType: 'customer' | 'vendor' | 'both' }) =>
      apiClient<{ updated: number }>('/contacts/bulk-type', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateContactInput & { id: string }) =>
      apiClient<{ contact: Contact }>(`/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useDeactivateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ contact: Contact }>(`/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useMergeContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sourceId: string; targetId: string }) =>
      apiClient('/contacts/merge', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useExportContacts() {
  return useMutation({
    mutationFn: async (contactType?: string) => {
      const qs = contactType ? `?contactType=${contactType}` : '';
      // Prefix with API_BASE (not a bare /api/v1) so this download works
      // on subpath appliance installs where BASE_URL='/mybooks/'.
      const res = await fetch(`${API_BASE}/contacts/export${qs}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'X-App-Base': APP_BASE,
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { contacts: Array<{ displayName: string; email?: string; phone?: string; companyName?: string }>; contactType: string }) =>
      apiClient('/contacts/import', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useContactTransactions(contactId: string) {
  return useQuery({
    queryKey: ['contacts', contactId, 'transactions'],
    queryFn: () => apiClient<{ data: unknown[]; total: number }>(`/contacts/${contactId}/transactions`),
    enabled: !!contactId,
  });
}
