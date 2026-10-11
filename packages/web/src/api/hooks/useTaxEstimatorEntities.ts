// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator entity tax setup hooks (MODULE.md D3/D8). Path params name the
// books; the server re-checks them against the firm scope on every call.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EntitySettingsResponse, EntityYearInputsDto, AccountTreatmentDto, TreatmentSuggestion, PagedList,
  BooksReadiness, TaxBasisPl, UpsertEntitySettingsInput, UpsertEntityYearInputsInput, AccountTreatmentInput,
} from '@kis-books/shared';
import { apiClient } from '../client';
import { getTaxEstimatorFirmId } from './useTaxEstimatorTaxpayers';

const KEY = 'tax-estimator-entities';

function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const firm = getTaxEstimatorFirmId();
  return apiClient<T>(`/tax-estimator/entities${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...(firm ? { 'X-Firm-Id': firm } : {}) },
  });
}

const base = (t: string, c: string) => `/${t}/${c}`;

export function useEntitySettings(t: string, c: string) {
  return useQuery({
    queryKey: [KEY, 'settings', t, c],
    queryFn: async () => (await call<{ data: EntitySettingsResponse }>(`${base(t, c)}/settings`)).data,
  });
}

export function useSaveEntitySettings(t: string, c: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertEntitySettingsInput) =>
      (await call<{ data: unknown }>(`${base(t, c)}/settings`, { method: 'PUT', body: JSON.stringify(input) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEntityYearInputs(t: string, c: string, taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'year-inputs', t, c, taxYear],
    queryFn: async () => (await call<{ data: EntityYearInputsDto }>(`${base(t, c)}/year-inputs/${taxYear}`)).data,
  });
}

export function useSaveEntityYearInputs(t: string, c: string, taxYear: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertEntityYearInputsInput) =>
      (await call<{ data: unknown }>(`${base(t, c)}/year-inputs/${taxYear}`, { method: 'PUT', body: JSON.stringify(input) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEntityTreatments(t: string, c: string) {
  return useQuery({
    queryKey: [KEY, 'treatments', t, c],
    queryFn: async () => (await call<{ data: PagedList<AccountTreatmentDto> }>(`${base(t, c)}/treatments?limit=500`)).data,
  });
}

export function useSaveEntityTreatments(t: string, c: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (treatments: AccountTreatmentInput[]) =>
      (await call<{ data: PagedList<AccountTreatmentDto> }>(`${base(t, c)}/treatments`, { method: 'PUT', body: JSON.stringify({ treatments }) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTreatmentSuggestions(t: string, c: string) {
  return useQuery({
    queryKey: [KEY, 'suggestions', t, c],
    queryFn: async () => (await call<{ data: TreatmentSuggestion[] }>(`${base(t, c)}/treatment-suggestions`)).data,
  });
}

export function useEntityReadiness(t: string, c: string, taxYear: number, through: string) {
  const q = new URLSearchParams({ taxYear: String(taxYear) });
  if (through) q.set('through', through);
  return useQuery({
    queryKey: [KEY, 'readiness', t, c, taxYear, through],
    queryFn: async () => (await call<{ data: BooksReadiness }>(`${base(t, c)}/readiness?${q}`)).data,
  });
}

export function useTaxBasisPl(t: string, c: string, taxYear: number, through: string) {
  const q = new URLSearchParams({ taxYear: String(taxYear) });
  if (through) q.set('through', through);
  return useQuery({
    queryKey: [KEY, 'tax-basis-pl', t, c, taxYear, through],
    queryFn: async () => (await call<{ data: TaxBasisPl }>(`${base(t, c)}/tax-basis-pl?${q}`)).data,
  });
}
