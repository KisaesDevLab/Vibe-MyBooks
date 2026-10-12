// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator Phase 11 hooks — live estimate, readiness, payment ledger, PDF download.
// The estimate is a POST (it computes); it is read through useQuery because it is idempotent
// and server-cached. The server resolves the firm; only the optional X-Firm-Id header is sent.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EstimateResultDTO, EstimateReadinessDTO, PaymentLedgerDTO, EstimatePaymentDTO, CreatePaymentInput, UpdatePaymentInput,
} from '@kis-books/shared';
import { apiClient, API_BASE, getAccessToken } from '../client';
import { getTaxEstimatorFirmId } from './useTaxEstimatorTaxpayers';

const BASE = '/tax-estimator';
const KEY = 'tax-estimator-estimate';
const PAYMENT_PAGE = 500;

function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const firm = getTaxEstimatorFirmId();
  return apiClient<T>(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...(firm ? { 'X-Firm-Id': firm } : {}) },
  });
}
const json = (body: unknown): Pick<RequestInit, 'body'> => ({ body: JSON.stringify(body) });

export function useEstimate(taxpayerId: string | undefined, taxYear: number, scenarioId: string | undefined, throughMonth?: string) {
  return useQuery({
    queryKey: [KEY, 'estimate', taxpayerId, taxYear, scenarioId, throughMonth ?? null],
    enabled: !!taxpayerId && !!scenarioId,
    queryFn: async () => (await call<{ data: EstimateResultDTO }>(
      `/taxpayers/${taxpayerId}/years/${taxYear}/scenarios/${scenarioId}/estimate`,
      { method: 'POST', ...json(throughMonth ? { throughMonth } : {}) },
    )).data,
  });
}

/** Up to three scenarios computed side by side (scenario compare). */
export function useEstimates(taxpayerId: string | undefined, taxYear: number, scenarioIds: string[], throughMonth?: string) {
  return useQuery({
    queryKey: [KEY, 'estimates', taxpayerId, taxYear, scenarioIds.join(','), throughMonth ?? null],
    enabled: !!taxpayerId && scenarioIds.length > 0,
    queryFn: async () => Promise.all(scenarioIds.map(async (sid) => (await call<{ data: EstimateResultDTO }>(
      `/taxpayers/${taxpayerId}/years/${taxYear}/scenarios/${sid}/estimate`,
      { method: 'POST', ...json(throughMonth ? { throughMonth } : {}) },
    )).data)),
  });
}

export function useEstimateReadiness(taxpayerId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'readiness', taxpayerId, taxYear], enabled: !!taxpayerId,
    queryFn: async () => (await call<{ data: EstimateReadinessDTO }>(`/taxpayers/${taxpayerId}/years/${taxYear}/readiness`)).data,
  });
}

export function usePaymentLedger(taxpayerId: string | undefined, taxYear: number, scenarioId?: string) {
  return useQuery({
    queryKey: [KEY, 'payments', taxpayerId, taxYear, scenarioId ?? null], enabled: !!taxpayerId,
    queryFn: async () => (await call<{ data: PaymentLedgerDTO }>(
      `/taxpayers/${taxpayerId}/years/${taxYear}/payments?limit=${PAYMENT_PAGE}&offset=0${scenarioId ? `&scenarioId=${scenarioId}` : ''}`,
    )).data,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreatePayment(taxpayerId: string, taxYear: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreatePaymentInput) =>
      (await call<{ data: EstimatePaymentDTO }>(`/taxpayers/${taxpayerId}/years/${taxYear}/payments`, { method: 'POST', ...json(input) })).data,
    onSuccess: invalidate,
  });
}
export function useUpdatePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; input: UpdatePaymentInput }) =>
      (await call<{ data: EstimatePaymentDTO }>(`/payments/${v.id}`, { method: 'PATCH', ...json(v.input) })).data,
    onSuccess: invalidate,
  });
}
export function useDeletePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Auth-aware blob download of the standalone estimate PDF (same pattern as downloadPackPdf). */
export async function downloadEstimatePdf(taxpayerId: string, taxYear: number, scenarioId: string, throughMonth?: string): Promise<void> {
  const token = getAccessToken();
  const firm = getTaxEstimatorFirmId();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (firm) headers['X-Firm-Id'] = firm;
  const res = await fetch(`${API_BASE}${BASE}/taxpayers/${taxpayerId}/years/${taxYear}/scenarios/${scenarioId}/pdf`, {
    method: 'POST', headers, body: JSON.stringify(throughMonth ? { throughMonth } : {}),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `tax-estimate-${taxYear}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
