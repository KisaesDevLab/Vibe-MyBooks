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
  // 'unit': tax codes resolve per activity unit (Tax Mapping shows a
  // sub-row per unit; the account-level code is the default unit's).
  taxCodeMappingMode: 'account' | 'unit';
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
    mutationFn: (input: { returnForm: string; pinnedSeedVersionId?: string | null; sCorpElectionDate?: string | null; defaultActivityType?: string; unitNumberPlacement?: 'suffix' | 'prefix'; taxCodeMappingMode?: 'account' | 'unit' }) =>
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

// Units and tag routing reshape the workpaper's segments, the assignment
// surface and the diagnostics — invalidate all of them, not just the
// units list, or the Mapping page keeps stale slices on screen.
const UNIT_DEPENDENT_KEYS: string[][] = [
  ['tb', 'activity-units'], ['tb', 'tag-mappings'], ['tb', 'workpaper'],
  ['tb', 'assignments'], ['tb', 'diagnostics'], ['tb', 'available-codes'], ['tb', 'export-validate'],
];
function invalidateUnitDependents(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of UNIT_DEPENDENT_KEYS) queryClient.invalidateQueries({ queryKey: key });
}

export function useCreateActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { activityType: string; displayName: string }) =>
      apiClient<{ unit: TbActivityUnit }>('/tb/activity-units', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateUnitDependents(queryClient),
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
    onSuccess: () => invalidateUnitDependents(queryClient),
  });
}

export interface TbDefaultUnitImpact {
  accountsLosingCoverage: Array<{ accountId: string; accountNumber: string | null; name: string }>;
  mismatches: Array<{ accountId: string; accountNumber: string | null; name: string; code: string; codeActivity: string }>;
}

// In unit mapping mode the first call returns { requiresConfirm: true,
// impact } and nothing changes; re-post with confirm (and optionally
// convertOldDefault) to apply.
export function useSetDefaultActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirm, convertOldDefault }: { id: string; confirm?: boolean; convertOldDefault?: boolean }) =>
      apiClient<{ unit: TbActivityUnit | null; requiresConfirm: boolean; impact: TbDefaultUnitImpact | null }>(
        `/tb/activity-units/${id}/set-default`,
        { method: 'POST', body: JSON.stringify({ confirm: !!confirm, convertOldDefault: !!convertOldDefault }) },
      ),
    onSuccess: (res) => { if (!res.requiresConfirm) invalidateUnitDependents(queryClient); },
  });
}

export function useArchiveActivityUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ mode: 'archived' | 'deleted' }>(`/tb/activity-units/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateUnitDependents(queryClient),
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
    onSuccess: () => invalidateUnitDependents(queryClient),
  });
}

// ── Copy mappings between units (unit mapping mode) ────────────────

export interface TbCopyAssignmentsInput {
  sourceUnitId: string | null;
  targetUnitIds: string[];
  mode: 'skip_existing' | 'overwrite';
  accountIds?: string[];
  dryRun?: boolean;
}

export interface TbCopyAssignmentsResult {
  dryRun: boolean;
  mode: 'skip_existing' | 'overwrite';
  sourceUnitId: string | null;
  copied: number;
  skippedExisting: number;
  skippedIncompatible: number;
  perTarget: Array<{
    unitId: string; displayName: string; instanceNumber: number; activityType: string;
    copied: number; overwritten: number; skippedExisting: number; skippedIncompatible: number;
    incompatible: Array<{ accountId: string; code: string; reason: 'existing' | 'incompatible_activity' | 'missing_from_seed' | 'inactive_firm_code' }>;
  }>;
}

export function useCopyAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TbCopyAssignmentsInput) =>
      apiClient<TbCopyAssignmentsResult>('/tb/assignments/copy', { method: 'POST', body: JSON.stringify({ ...input, dryRun: false }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'export-validate'] });
    },
  });
}

// Dry-run preview for the copy dialog; re-fetches as the selection changes.
export function useCopyAssignmentsPreview(input: TbCopyAssignmentsInput | null) {
  return useQuery({
    queryKey: ['tb', 'assignments-copy-preview', input],
    enabled: !!input && input.targetUnitIds.length > 0,
    queryFn: () => apiClient<TbCopyAssignmentsResult>('/tb/assignments/copy', { method: 'POST', body: JSON.stringify({ ...input, dryRun: true }) }),
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
