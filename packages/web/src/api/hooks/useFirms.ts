// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignTenantToFirmInput,
  CreateFirmInput,
  Firm,
  FirmRole,
  FirmUser,
  FirmUserWithProfile,
  InviteFirmUserInput,
  TenantFirmAssignmentWithTenant,
  UpdateFirmInput,
  UpdateFirmUserInput,
} from '@kis-books/shared';
import { apiClient } from '../client';

// 3-tier rules plan, Phase 1 — firms hooks. Mirrors the existing
// hook style in this file family: react-query with invalidation
// on every successful mutation, narrow input/output types from
// shared.

export function useFirms() {
  return useQuery({
    queryKey: ['firms'],
    queryFn: () => apiClient<{ firms: Firm[] }>('/firms'),
    staleTime: 60 * 1000,
  });
}

export function useFirm(firmId: string | null) {
  return useQuery({
    queryKey: ['firms', firmId],
    enabled: !!firmId,
    queryFn: () => apiClient<Firm>(`/firms/${firmId}`),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms'] }),
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

export function useAssignTenantToFirm(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTenantToFirmInput) =>
      apiClient(`/firms/${firmId}/tenants`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'tenants'] }),
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
