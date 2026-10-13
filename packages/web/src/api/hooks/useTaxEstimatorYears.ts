// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator Phase 5 hooks — annual settings, scenarios, adjustments, state rows,
// adjustment types, firm settings. The server resolves the firm; only the optional
// X-Firm-Id header is sent (same as the taxpayer hooks).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  YearDetailDTO, YearSummaryDTO, ScenarioDTO, AdjustmentDTO, AdjustmentListDTO, AdjustmentTypeDTO, StateRowDTO,
  FirmSettingsDTO, UpsertYearInput, CreateAdjustmentInput, UpdateAdjustmentInput, ReplaceStateRowsInput,
  CreateAdjustmentTypeInput, UpdateAdjustmentTypeInput, UpsertFirmSettingsInput,
} from '@kis-books/shared';
import { apiClient } from '../client';
import { getTaxEstimatorFirmId } from './useTaxEstimatorTaxpayers';

const BASE = '/tax-estimator';
const KEY = 'tax-estimator-years';
const ADJUSTMENT_PAGE = 500;

function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const firm = getTaxEstimatorFirmId();
  return apiClient<T>(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...(firm ? { 'X-Firm-Id': firm } : {}) },
  });
}
const json = (body: unknown): Pick<RequestInit, 'body'> => ({ body: JSON.stringify(body) });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useYearList(taxpayerId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'list', taxpayerId], enabled: !!taxpayerId,
    queryFn: async () => (await call<{ data: YearSummaryDTO[] }>(`/taxpayers/${taxpayerId}/years`)).data,
  });
}

export function useYear(taxpayerId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'year', taxpayerId, taxYear], enabled: !!taxpayerId,
    queryFn: async () => (await call<{ data: YearDetailDTO }>(`/taxpayers/${taxpayerId}/years/${taxYear}`)).data,
  });
}

export function useSaveYear(taxpayerId: string, taxYear: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: UpsertYearInput) =>
      (await call<{ data: YearDetailDTO }>(`/taxpayers/${taxpayerId}/years/${taxYear}`, { method: 'PUT', ...json(input) })).data,
    onSuccess: invalidate,
  });
}

export function useCreateScenario(taxpayerId: string, taxYear: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (name: string) =>
      (await call<{ data: ScenarioDTO }>(`/taxpayers/${taxpayerId}/years/${taxYear}/scenarios`, { method: 'POST', ...json({ name }) })).data,
    onSuccess: invalidate,
  });
}
export function useRenameScenario() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; name: string }) =>
      (await call<{ data: ScenarioDTO }>(`/scenarios/${v.id}`, { method: 'PATCH', ...json({ name: v.name }) })).data,
    onSuccess: invalidate,
  });
}
/** Q51: share (or stop sharing) a what-if scenario in the client portal. */
export function useScenarioPortalShare() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; showInPortal: boolean }) =>
      (await call<{ data: ScenarioDTO }>(`/scenarios/${v.id}`, { method: 'PATCH', ...json({ showInPortal: v.showInPortal }) })).data,
    onSuccess: invalidate,
  });
}
export function useCloneScenario() {
  const invalidate = useInvalidate();
  return useMutation({
    /** QA D21: the copy is named by the user (blank → "Copy of …"). */
    mutationFn: async (v: { id: string; name?: string }) =>
      (await call<{ data: ScenarioDTO }>(`/scenarios/${v.id}/clone`, { method: 'POST', ...json(v.name ? { name: v.name } : {}) })).data,
    onSuccess: invalidate,
  });
}
export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call<void>(`/scenarios/${id}`, { method: 'DELETE' }),
    // QA D22: never refetch the deleted scenario's adjustments / state rows (they 404); drop them.
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: [KEY, 'adjustments', id] });
      qc.removeQueries({ queryKey: [KEY, 'state-rows', id] });
      return qc.invalidateQueries({ queryKey: [KEY], predicate: (q) => !q.queryKey.includes(id) });
    },
  });
}

export function useAdjustments(scenarioId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'adjustments', scenarioId], enabled: !!scenarioId,
    queryFn: () => call<AdjustmentListDTO>(`/scenarios/${scenarioId}/adjustments?limit=${ADJUSTMENT_PAGE}&offset=0`),
  });
}
export function useCreateAdjustment(scenarioId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreateAdjustmentInput) =>
      (await call<{ data: AdjustmentDTO }>(`/scenarios/${scenarioId}/adjustments`, { method: 'POST', ...json(input) })).data,
    onSuccess: invalidate,
  });
}
export function useUpdateAdjustment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; input: UpdateAdjustmentInput }) =>
      (await call<{ data: AdjustmentDTO }>(`/adjustments/${v.id}`, { method: 'PATCH', ...json(v.input) })).data,
    onSuccess: invalidate,
  });
}
export function useDeleteAdjustment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>(`/adjustments/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useStateRows(scenarioId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'state-rows', scenarioId], enabled: !!scenarioId,
    queryFn: async () => (await call<{ data: StateRowDTO[] }>(`/scenarios/${scenarioId}/state-rows`)).data,
  });
}
export function useReplaceStateRows(scenarioId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: ReplaceStateRowsInput) =>
      (await call<{ data: StateRowDTO[] }>(`/scenarios/${scenarioId}/state-rows`, { method: 'PUT', ...json(input) })).data,
    onSuccess: invalidate,
  });
}

export function useAdjustmentTypes() {
  return useQuery({
    queryKey: [KEY, 'types'],
    queryFn: async () => (await call<{ data: AdjustmentTypeDTO[] }>('/adjustment-types')).data,
  });
}
export function useCreateAdjustmentType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreateAdjustmentTypeInput) =>
      (await call<{ data: AdjustmentTypeDTO }>('/adjustment-types', { method: 'POST', ...json(input) })).data,
    onSuccess: invalidate,
  });
}
export function useUpdateAdjustmentType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; input: UpdateAdjustmentTypeInput }) =>
      (await call<{ data: AdjustmentTypeDTO }>(`/adjustment-types/${v.id}`, { method: 'PATCH', ...json(v.input) })).data,
    onSuccess: invalidate,
  });
}
export function useDeleteAdjustmentType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>(`/adjustment-types/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useFirmSettings() {
  return useQuery({
    queryKey: [KEY, 'firm-settings'],
    queryFn: async () => (await call<{ data: FirmSettingsDTO }>('/firm-settings')).data,
  });
}
export function useSaveFirmSettings() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: UpsertFirmSettingsInput) =>
      (await call<{ data: FirmSettingsDTO }>('/firm-settings', { method: 'PUT', ...json(input) })).data,
    onSuccess: invalidate,
  });
}
