// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminFirmSummary,
  TenantFirmState,
  AssignTenantToFirmInput,
  CreateFirmInput,
  Firm,
  FirmRole,
  FirmUser,
  FirmWithMyRole,
  FirmUserWithProfile,
  InviteFirmUserInput,
  StaffTenantAccessRow,
  TenantAccessRole,
  TenantFirmAssignmentWithTenant,
  UpdateFirmInput,
  UpdateFirmUserInput,
  VibePmSettingsView,
  VibePmSettingsInput,
  PeerTestTokenResult,
  PmClientLinkView,
  PmLinkOptions,
  CreatePmClientLinkInput,
} from '@kis-books/shared';
import { apiClient } from '../client';

// 3-tier rules plan, Phase 1 — firms hooks. Mirrors the existing
// hook style in this file family: react-query with invalidation
// on every successful mutation, narrow input/output types from
// shared.

export function useFirms(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['firms'],
    queryFn: () => apiClient<{ firms: Firm[] }>('/firms'),
    staleTime: 60 * 1000,
    enabled: opts.enabled ?? true,
  });
}

export function useFirm(firmId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId],
    enabled: !!firmId,
    queryFn: () => apiClient<FirmWithMyRole>(`/firms/${firmId}`),
  });
}

export function useCreateFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFirmInput) =>
      apiClient<Firm>('/firms', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms'] }),
  });
}

export function useUpdateFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { firmId: string; patch: UpdateFirmInput }) =>
      apiClient<Firm>(`/firms/${input.firmId}`, {
        method: 'PATCH',
        body: JSON.stringify(input.patch),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['firms'] });
      qc.invalidateQueries({ queryKey: ['firms', vars.firmId] });
    },
  });
}

export function useDeleteFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (firmId: string) =>
      apiClient<{ deleted: boolean }>(`/firms/${firmId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms'] });
      qc.invalidateQueries({ queryKey: ['admin', 'firms'] });
    },
  });
}

// ─── Admin (super admin) ─────────────────────────────────────────

export function useAdminFirms(params: { search?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['admin', 'firms', params],
    queryFn: () => apiClient<{ firms: AdminFirmSummary[]; total: number }>(`/admin/firms${suffix}`),
  });
}

// Set (or clear with null) the firm managing a tenant — admin tenant detail.
export function useSetTenantFirm(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (firmId: string | null) =>
      apiClient<TenantFirmState>(`/admin/tenants/${tenantId}/firm`, {
        method: 'POST',
        body: JSON.stringify({ firmId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      qc.invalidateQueries({ queryKey: ['admin', 'firms'] });
      qc.invalidateQueries({ queryKey: ['firms'] });
    },
  });
}

// Firm staff
export function useFirmUsers(firmId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId, 'users'],
    enabled: !!firmId,
    queryFn: () => apiClient<{ users: FirmUserWithProfile[] }>(`/firms/${firmId}/users`),
  });
}

export function useInviteFirmUser(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteFirmUserInput) =>
      apiClient<FirmUser>(`/firms/${firmId}/users`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'users'] }),
  });
}

export function useUpdateFirmUser(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { firmUserId: string; patch: UpdateFirmUserInput }) =>
      apiClient<FirmUser>(`/firms/${firmId}/users/${input.firmUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(input.patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'users'] }),
  });
}

export function useRemoveFirmUser(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (firmUserId: string) =>
      apiClient<{ deleted: boolean }>(`/firms/${firmId}/users/${firmUserId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'users'] }),
  });
}

// A firm staffer's per-tenant access across the firm's managed tenants —
// the matrix behind the "Tenant access" dialog on the firm-staff page.
export function useStaffTenantAccess(firmId: string, firmUserId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId, 'users', firmUserId, 'tenant-access'],
    enabled: !!firmUserId,
    queryFn: () =>
      apiClient<{ access: StaffTenantAccessRow[] }>(
        `/firms/${firmId}/users/${firmUserId}/tenant-access`,
      ),
  });
}

export function useSetStaffTenantAccess(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { firmUserId: string; access: Array<{ tenantId: string; role: TenantAccessRole }> }) =>
      apiClient<{ access: StaffTenantAccessRow[] }>(
        `/firms/${firmId}/users/${input.firmUserId}/tenant-access`,
        { method: 'PUT', body: JSON.stringify({ access: input.access }) },
      ),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['firms', firmId, 'users', vars.firmUserId, 'tenant-access'] }),
  });
}

// Tenant assignments
export function useFirmTenants(firmId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId, 'tenants'],
    enabled: !!firmId,
    queryFn: () =>
      apiClient<{ assignments: TenantFirmAssignmentWithTenant[] }>(
        `/firms/${firmId}/tenants`,
      ),
  });
}

// Tenants the caller may assign to this firm — for a searchable picker instead
// of a raw-UUID field. Only fetched while the assign dialog is open.
export function useAssignableTenants(firmId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['firms', firmId, 'assignable-tenants'],
    enabled,
    queryFn: () =>
      apiClient<{ tenants: Array<{ tenantId: string; name: string; slug: string }> }>(
        `/firms/${firmId}/assignable-tenants`,
      ),
  });
}

export function useAssignTenantToFirm(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTenantToFirmInput) =>
      apiClient(`/firms/${firmId}/tenants`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms', firmId, 'tenants'] });
      qc.invalidateQueries({ queryKey: ['firms', firmId, 'assignable-tenants'] });
    },
  });
}

export function useUnassignTenantFromFirm(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) =>
      apiClient<{ unassigned: boolean }>(`/firms/${firmId}/tenants/${tenantId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'tenants'] }),
  });
}

// Re-exports for convenience.
export type { Firm, FirmUser, FirmUserWithProfile, FirmRole, TenantFirmAssignmentWithTenant };

// ─── Vibe Practice Management peer (docs/vibe-pm-integration.md) ──

export function useVibePmSettings(firmId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId, 'integrations', 'vibe-pm'],
    enabled: !!firmId,
    queryFn: () => apiClient<VibePmSettingsView>(`/firms/${firmId}/integrations/vibe-pm`),
  });
}

export function useSaveVibePmSettings(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VibePmSettingsInput) =>
      apiClient<VibePmSettingsView>(`/firms/${firmId}/integrations/vibe-pm`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'integrations', 'vibe-pm'] }),
  });
}

export function useTestPeerToken(firmId: string) {
  return useMutation({
    mutationFn: (token: string) =>
      apiClient<PeerTestTokenResult>(`/firms/${firmId}/integrations/vibe-pm/test-token`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  });
}

export function usePmLinks(firmId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId, 'pm-links'],
    enabled: !!firmId,
    queryFn: () => apiClient<{ links: PmClientLinkView[] }>(`/firms/${firmId}/pm-links`),
  });
}

export function usePmLinkOptions(firmId: string, tenantId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId, 'pm-links', 'options', tenantId],
    enabled: !!tenantId,
    queryFn: () => apiClient<PmLinkOptions>(`/firms/${firmId}/pm-links/options?tenantId=${encodeURIComponent(tenantId!)}`),
  });
}

export function useCreatePmLink(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePmClientLinkInput) =>
      apiClient<PmClientLinkView>(`/firms/${firmId}/pm-links`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'pm-links'] }),
  });
}

export function useDeletePmLink(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiClient<void>(`/firms/${firmId}/pm-links/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'pm-links'] }),
  });
}
