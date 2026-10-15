// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// State-rule admin hooks (super admin). All responses are `{ data: ... }`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StateRulesDTO, StateRuleRowDTO, StateRuleSummaryDTO, SetStateRuleOverrideInput,
  CreateStateYearFromPriorResult, StateRuleDiffRowDTO, StateRuleChangeDTO, VerifyStateRulesResult,
} from '@kis-books/shared';
import { apiClient } from '../client';

const BASE = '/admin/tax-state-rules';
const KEY = 'tax-state-rules';

export function useStateRuleSummaries(year: number | null) {
  return useQuery({
    queryKey: [KEY, year, 'summary'],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: StateRuleSummaryDTO[] }>(`${BASE}/${year}/summary`)).data,
  });
}

export function useStateRules(year: number | null, state: string | null) {
  return useQuery({
    queryKey: [KEY, year, 'state', state],
    enabled: year != null && !!state,
    queryFn: async () => (await apiClient<{ data: StateRulesDTO }>(`${BASE}/${year}/${state}`)).data,
  });
}

export function useStateRuleDiff(year: number | null) {
  return useQuery({
    queryKey: [KEY, year, 'diff'],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: { rows: StateRuleDiffRowDTO[] } }>(`${BASE}/${year}/diff`)).data.rows,
  });
}

export function useStateRuleChanges(year: number | null, limit = 50) {
  return useQuery({
    queryKey: [KEY, year, 'changes', limit],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: { rows: StateRuleChangeDTO[] } }>(`${BASE}/${year}/changes?limit=${limit}`)).data.rows,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useSetStateRuleOverride(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { state: string; key: string } & SetStateRuleOverrideInput) =>
      (await apiClient<{ data: StateRuleRowDTO }>(`${BASE}/${year}/${v.state}/${encodeURIComponent(v.key)}`, {
        method: 'PUT', body: JSON.stringify({ value: v.value, reason: v.reason, ...(v.companion ? { companion: v.companion } : {}) }),
      })).data,
    onSuccess: invalidate,
  });
}

export function useRevertStateRule(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { state: string; key: string }) =>
      apiClient<unknown>(`${BASE}/${year}/${v.state}/${encodeURIComponent(v.key)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreateStateYearFromPrior() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (year: number) =>
      (await apiClient<{ data: CreateStateYearFromPriorResult }>(`${BASE}/${year}/create-from-prior`, { method: 'POST' })).data,
    onSuccess: invalidate,
  });
}

export function useAdoptShippedStateRules(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (keys?: string[]) =>
      ({
        adopted: (await apiClient<{ data: { adopted: string[] } }>(`${BASE}/${year}/adopt-shipped`, {
          method: 'POST', body: JSON.stringify(keys ? { keys } : {}),
        })).data.adopted.length,
      }),
    onSuccess: invalidate,
  });
}

/**
 * R7 in-app Verify: mark one state rule verified (super admin). `expectedValue` is the value shown
 * in the dialog (R6-04): the server refuses (409 TE_PARAM_CHANGED) if the row changed meanwhile.
 */
export function useVerifyStateRule(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { state: string; key: string; note?: string; expectedValue: unknown }) =>
      (await apiClient<{ data: StateRuleRowDTO }>(`${BASE}/${year}/${v.state}/${encodeURIComponent(v.key)}/verify`, {
        method: 'POST', body: JSON.stringify({ ...(v.note ? { note: v.note } : {}), expectedValue: v.expectedValue }),
      })).data,
    onSuccess: invalidate,
    onError: invalidate,
  });
}

/** R7 in-app Verify: every not-yet-verified rule of one jurisdiction's year (explicit confirm). */
export function useVerifyAllStateRules(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { state: string; note?: string }) =>
      (await apiClient<{ data: VerifyStateRulesResult }>(`${BASE}/${year}/${v.state}/verify-all`, {
        method: 'POST', body: JSON.stringify(v.note ? { confirm: true, note: v.note } : { confirm: true }),
      })).data,
    onSuccess: invalidate,
  });
}
