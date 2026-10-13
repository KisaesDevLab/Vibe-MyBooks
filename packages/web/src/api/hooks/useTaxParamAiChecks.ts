// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// AI parameter check hooks (super admin, OPEN-QUESTIONS Q48). All responses are `{ data: ... }`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiCheckAvailabilityDTO, AiCheckLatestDTO, AiCheckRunDTO, AiCheckDTO, ApplyAiCheckResult, CreateAiCheckRunInput,
} from '@kis-books/shared';
import { apiClient } from '../client';

const BASE = '/admin/tax-param-ai-checks';
const KEY = 'tax-param-ai-checks';
const POLL_MS = 2000;

export const isActiveRun = (r: AiCheckRunDTO | null | undefined): boolean => !!r && (r.status === 'queued' || r.status === 'running');

export function useAiCheckAvailability() {
  return useQuery({
    queryKey: [KEY, 'availability'],
    queryFn: async () => (await apiClient<{ data: AiCheckAvailabilityDTO }>(`${BASE}/availability`)).data,
    staleTime: 60_000,
  });
}

/** Latest check per row for a year: federal (state omitted) or one state. */
export function useAiCheckLatest(year: number | null, state?: string) {
  return useQuery({
    queryKey: [KEY, 'latest', year, state ?? 'US'],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: AiCheckLatestDTO }>(`${BASE}/latest?year=${year}${state ? `&state=${state}` : ''}`)).data,
  });
}

/** Recent runs of the year; refetches while one is active so progress moves without a page reload. */
export function useAiCheckRuns(year: number | null) {
  return useQuery({
    queryKey: [KEY, 'runs', year],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: { runs: AiCheckRunDTO[] } }>(`${BASE}/runs?year=${year}&limit=20`)).data.runs,
    refetchInterval: (q) => ((q.state.data ?? []).some(isActiveRun) ? POLL_MS : false),
  });
}

export function useAiCheck(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'check', id],
    enabled: !!id,
    queryFn: async () => (await apiClient<{ data: AiCheckDTO }>(`${BASE}/checks/${id}`)).data,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useStartAiCheckRun() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreateAiCheckRunInput) =>
      (await apiClient<{ data: AiCheckRunDTO }>(`${BASE}/runs`, { method: 'POST', body: JSON.stringify(input) })).data,
    onSuccess: invalidate,
  });
}

export function useCancelAiCheckRun() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient<{ data: AiCheckRunDTO }>(`${BASE}/runs/${id}/cancel`, { method: 'POST' })).data,
    onSuccess: invalidate,
  });
}

/** Apply a `differs` check's value: an audited override that stays unverified. Refreshes the parameter screens too. */
export function useApplyAiCheck() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: [KEY] }),
    qc.invalidateQueries({ queryKey: ['tax-parameters'] }),
    qc.invalidateQueries({ queryKey: ['tax-state-rules'] }),
  ]);
  return useMutation({
    mutationFn: async (v: { id: string; expectedValue: unknown; updateCitation: boolean }) =>
      (await apiClient<{ data: ApplyAiCheckResult }>(`${BASE}/checks/${v.id}/apply`, {
        method: 'POST', body: JSON.stringify({ expectedValue: v.expectedValue, updateCitation: v.updateCitation }),
      })).data,
    onSuccess: refresh,
    // 409 (value moved / stale): refresh so the admin sees the current state.
    onError: refresh,
  });
}
