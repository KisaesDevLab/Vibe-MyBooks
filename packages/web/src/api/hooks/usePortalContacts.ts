// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 8 — bookkeeper-side
// portal-contact admin hooks. Backed by /api/v1/practice/portal/...

export interface PortalContactSummary {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: 'active' | 'paused' | 'deleted';
  lastSeenAt: string | null;
  createdAt: string;
  companyCount: number;
}

export interface PortalContactCompanyLink {
  companyId: string;
  companyName: string;
  role: string;
  assignable: boolean;
  financialsAccess: boolean;
  filesAccess: boolean;
  questionsForUsAccess: boolean;
}

export interface PortalContactDetail {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: 'active' | 'paused' | 'deleted';
  lastSeenAt: string | null;
  createdAt: string;
  companies: PortalContactCompanyLink[];
}

export interface CreatePortalContactInput {
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companies: Array<{
    companyId: string;
    role?: string;
    assignable?: boolean;
    financialsAccess?: boolean;
    filesAccess?: boolean;
    questionsForUsAccess?: boolean;
  }>;
}

export interface UpdatePortalContactInput {
  email?: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: 'active' | 'paused';
}

export interface PracticePortalSettings {
  remindersEnabled: boolean;
  reminderCadenceDays: number[];
  openTrackingEnabled: boolean;
  assignableQuestionsEnabled: boolean;
  customDomain: string | null;
  brandingLogoUrl: string | null;
  brandingPrimaryColor: string | null;
  announcementText: string | null;
  announcementEnabled: boolean;
  previewEnabled: boolean;
  previewAllowedRoles: string[];
}

export function usePortalContacts(opts?: { status?: string; companyId?: string }) {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.companyId) params.set('companyId', opts.companyId);
  const qs = params.toString();
  return useQuery({
    queryKey: ['practice', 'portal', 'contacts', opts ?? {}],
    queryFn: () =>
      apiClient<{ contacts: PortalContactSummary[] }>(
        `/practice/portal/contacts${qs ? `?${qs}` : ''}`,
      ),
  });
}

export function usePortalContact(id: string | undefined) {
  return useQuery({
    queryKey: ['practice', 'portal', 'contacts', id],
    queryFn: () =>
      apiClient<{ contact: PortalContactDetail }>(`/practice/portal/contacts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePortalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortalContactInput) =>
      apiClient<{ id: string }>('/practice/portal/contacts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'portal', 'contacts'] }),
  });
}

export function useUpdatePortalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePortalContactInput }) =>
      apiClient<{ ok: boolean }>(`/practice/portal/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'portal', 'contacts'] }),
  });
}

export function useDeletePortalContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ ok: boolean }>(`/practice/portal/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'portal', 'contacts'] }),
  });
}

export function useSetPortalContactCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      companies,
    }: {
      id: string;
      companies: CreatePortalContactInput['companies'];
    }) =>
      apiClient<{ ok: boolean }>(`/practice/portal/contacts/${id}/companies`, {
        method: 'PUT',
        body: JSON.stringify({ companies }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['practice', 'portal', 'contacts'] });
      qc.invalidateQueries({ queryKey: ['practice', 'portal', 'contacts', vars.id] });
    },
  });
}

export function usePortalPracticeSettings() {
  return useQuery({
    queryKey: ['practice', 'portal', 'settings', 'practice'],
    queryFn: () =>
      apiClient<{ settings: PracticePortalSettings }>('/practice/portal/settings/practice'),
  });
}

export function useUpdatePortalPracticeSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PracticePortalSettings>) =>
      apiClient<{ settings: PracticePortalSettings }>('/practice/portal/settings/practice', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['practice', 'portal', 'settings', 'practice'] }),
  });
}
