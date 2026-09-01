// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// TanStack Query hooks for the Trial Balance module (/api/v1/tb).
// Query-key roots: ['tb', <area>] — invalidate coarse per area.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// ── Types (wire shapes from the tb router) ──────────────────────────

export interface TbProfile {
  id: string;
  returnForm: '1040' | '1065' | '1120' | '1120S';
  pinnedSeedVersionId: string | null;
  sCorpElectionDate: string | null;
  defaultActivityType: 'business' | 'rental' | 'farm' | 'farm_rental';
  // Where vendor exports attach the unit number on unit-split account rows.
  unitNumberPlacement: 'suffix' | 'prefix';
}

export interface TbFiscal {
  fiscalYearStartMonth: number;
  accountingMethod: 'accrual' | 'cash' | null;
  currentTaxYear: number;
  currentFiscalYearEnd: string;
  priorFiscalYearEnd: string;
}

export interface TbSeedVersion {
  id: string;
  taxYear: number;
  version: number;
  label: string | null;
  rowCount: number;
}

export interface TbActivityUnit {
  id: string;
  activityType: 'business' | 'rental' | 'farm' | 'farm_rental';
  instanceNumber: number;
  displayName: string;
  isDefault: boolean;
  archivedAt: string | null;
}

export interface TbTagMapping {
  id: string;
  name: string;
  color: string | null;
  lineUsage: number;
  activityUnitId: string | null;
}

export interface TbFirmCode {
  id: string;
  code: string;
  description: string;
  returnForm: string;
  activityType: string;
  sortOrder: number;
  isM1Adjustment: boolean;
  ultrataxCode: string | null;
  cchCode: string | null;
  lacerteCode: string | null;
  gosystemCode: string | null;
  genericCode: string | null;
  isActive: boolean;
}

// ── Profile ────────────────────────────────────────────────────────

export function useTbProfile() {
  return useQuery({
    queryKey: ['tb', 'profile'],
    queryFn: () => apiClient<{ profile: TbProfile | null; pinnedVersion: TbSeedVersion | null; fiscal: TbFiscal }>('/tb/profile'),
  });
}

export function useUpsertTbProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { returnForm: string; pinnedSeedVersionId?: string | null; sCorpElectionDate?: string | null; defaultActivityType?: string; unitNumberPlacement?: 'suffix' | 'prefix' }) =>
      apiClient<{ profile: TbProfile }>('/tb/profile', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb'] }),
  });
}

// ── Activity units ─────────────────────────────────────────────────

export function useActivityUnits(includeArchived = false) {
  return useQuery({
    queryKey: ['tb', 'activity-units', includeArchived],
    queryFn: () => apiClient<{ units: TbActivityUnit[] }>(`/tb/activity-units?includeArchived=${includeArchived}`),
  });
}

export function useCreateActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { activityType: string; displayName: string }) =>
      apiClient<{ unit: TbActivityUnit }>('/tb/activity-units', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'activity-units'] }),
  });
}

export function useRenameActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, displayName, instanceNumber }: { id: string; displayName: string; instanceNumber?: number }) =>
      apiClient<{ unit: TbActivityUnit }>(`/tb/activity-units/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ displayName, ...(instanceNumber !== undefined ? { instanceNumber } : {}) }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'activity-units'] }),
  });
}

export function useSetDefaultActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ unit: TbActivityUnit }>(`/tb/activity-units/${id}/set-default`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'activity-units'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'tag-mappings'] });
    },
  });
}

export function useArchiveActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ mode: 'archived' | 'deleted' }>(`/tb/activity-units/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'activity-units'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'tag-mappings'] });
    },
  });
}

// ── Tag mappings ───────────────────────────────────────────────────

export function useTagMappings() {
  return useQuery({
    queryKey: ['tb', 'tag-mappings'],
    queryFn: () => apiClient<{ tags: TbTagMapping[]; defaultUnitId: string | null }>('/tb/tag-mappings'),
  });
}

export function useMapTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, activityUnitId }: { tagId: string; activityUnitId: string | null }) =>
      activityUnitId
        ? apiClient(`/tb/tag-mappings/${tagId}`, { method: 'PUT', body: JSON.stringify({ activityUnitId }) })
        : apiClient(`/tb/tag-mappings/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'tag-mappings'] }),
  });
}

// ── Firm custom codes ──────────────────────────────────────────────

export function useFirmCodes(includeInactive = false) {
  return useQuery({
    queryKey: ['tb', 'firm-codes', includeInactive],
    queryFn: () => apiClient<{ codes: TbFirmCode[]; ownedByFirm: boolean }>(`/tb/firm-codes?includeInactive=${includeInactive}`),
  });
}

export function useSaveFirmCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TbFirmCode> & { code?: string }) =>
      id
        ? apiClient<{ code: TbFirmCode }>(`/tb/firm-codes/${id}`, { method: 'PUT', body: JSON.stringify(input) })
        : apiClient<{ code: TbFirmCode }>('/tb/firm-codes', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'firm-codes'] }),
  });
}

export function useDeactivateFirmCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ code: TbFirmCode }>(`/tb/firm-codes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'firm-codes'] }),
  });
}
