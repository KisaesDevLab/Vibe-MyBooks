// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator dashboard cards (OPEN-QUESTIONS.md Q52).
//   Company dashboard: GET /dashboard/tax-estimates (the server decides the audience; null = hidden),
//                      POST /dashboard/tax-estimates/:taxpayerId/refresh (staff).
//   Firm-wide (Tax Estimator home): GET /tax-estimator/dashboard, POST .../dashboard/taxpayers/:id/years/:y/refresh.
// Loading the cards never computes an estimate; only Refresh does (one taxpayer).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyTaxEstimatesDTO, FirmTaxEstDashboardDTO, TaxEstDashboardTaxpayerDTO } from '@kis-books/shared';
import { apiClient } from '../client';
import { getTaxEstimatorFirmId } from './useTaxEstimatorTaxpayers';

export const COMPANY_TAX_EST_KEY = ['dashboard', 'tax-estimates'] as const;
export const FIRM_TAX_EST_KEY = ['tax-estimator', 'dashboard'] as const;

export function useCompanyTaxEstimates() {
  return useQuery({
    queryKey: COMPANY_TAX_EST_KEY,
    queryFn: async () => (await apiClient<{ data: CompanyTaxEstimatesDTO | null }>('/dashboard/tax-estimates')).data,
  });
}

export function useRefreshCompanyTaxEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taxpayerId: string) =>
      (await apiClient<{ data: TaxEstDashboardTaxpayerDTO }>(`/dashboard/tax-estimates/${taxpayerId}/refresh`, { method: 'POST' })).data,
    onSuccess: (card) => {
      qc.setQueryData<CompanyTaxEstimatesDTO | null>(COMPANY_TAX_EST_KEY, (prev) => (prev
        ? { ...prev, taxpayers: prev.taxpayers.map((t) => (t.taxpayerId === card.taxpayerId ? card : t)) }
        : prev));
    },
  });
}

const firmHeaders = (): Record<string, string> => {
  const firm = getTaxEstimatorFirmId();
  return firm ? { 'X-Firm-Id': firm } : {};
};

export function useFirmTaxEstDashboard() {
  return useQuery({
    queryKey: FIRM_TAX_EST_KEY,
    queryFn: async () => (await apiClient<{ data: FirmTaxEstDashboardDTO | null }>('/tax-estimator/dashboard', { headers: firmHeaders() })).data,
  });
}

export function useRefreshFirmTaxEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taxpayerId, taxYear }: { taxpayerId: string; taxYear: number }) =>
      (await apiClient<{ data: { computedAt: string } }>(`/tax-estimator/dashboard/taxpayers/${taxpayerId}/years/${taxYear}/refresh`, { method: 'POST', headers: firmHeaders() })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: FIRM_TAX_EST_KEY }),
  });
}
