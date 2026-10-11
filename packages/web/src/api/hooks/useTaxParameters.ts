// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax-parameter admin hooks (super admin). All responses are `{ data: ... }`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TaxParametersDTO, TaxParameterRowDTO, TaxParameterYearsDTO, SetTaxParameterOverrideInput,
  CreateYearFromPriorResult, TaxParameterDiffRowDTO, TaxParameterChangeDTO,
} from '@kis-books/shared';
import { apiClient } from '../client';

const BASE = '/admin/tax-parameters';
const KEY = 'tax-parameters';

export function useTaxParameterYears() {
  return useQuery({
    queryKey: [KEY, 'years'],
    queryFn: async () => (await apiClient<{ data: TaxParameterYearsDTO }>(`${BASE}/years`)).data,
  });
}

export function useTaxParameters(year: number | null) {
  return useQuery({
    queryKey: [KEY, year],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: TaxParametersDTO }>(`${BASE}/${year}`)).data,
  });
}

export function useTaxParameterDiff(year: number | null) {
  return useQuery({
    queryKey: [KEY, year, 'diff'],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: { rows: TaxParameterDiffRowDTO[] } }>(`${BASE}/${year}/diff`)).data.rows,
  });
}

export function useTaxParameterChanges(year: number | null, limit = 50) {
  return useQuery({
    queryKey: [KEY, year, 'changes', limit],
    enabled: year != null,
    queryFn: async () => (await apiClient<{ data: { rows: TaxParameterChangeDTO[] } }>(`${BASE}/${year}/changes?limit=${limit}`)).data.rows,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useSetTaxParameterOverride(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { key: string } & SetTaxParameterOverrideInput) =>
      (await apiClient<{ data: TaxParameterRowDTO }>(`${BASE}/${year}/${encodeURIComponent(v.key)}`, {
        method: 'PUT', body: JSON.stringify({ value: v.value, reason: v.reason }),
      })).data,
    onSuccess: invalidate,
  });
}

export function useRevertTaxParameter(year: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (key: string) => apiClient<unknown>(`${BASE}/${year}/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreateTaxYearFromPrior() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (year: number) =>
      (await apiClient<{ data: CreateYearFromPriorResult }>(`${BASE}/${year}/create-from-prior`, { method: 'POST' })).data,
    onSuccess: invalidate,
  });
}

export function useAdoptShippedParameters(year: number) {
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
