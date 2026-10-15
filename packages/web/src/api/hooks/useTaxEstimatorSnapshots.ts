// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Tax Estimator Phase 12/13 hooks — immutable estimate snapshots: finalize, history,
// read-only view, compare with live, and the frozen snapshot's PDF. Snapshots are
// never edited (the API answers 409 TE_SNAPSHOT_IMMUTABLE); a change means a new one.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EstimateSnapshotDTO, EstimateSnapshotListDTO, SnapshotCompareDTO, SnapshotReason,
} from '@kis-books/shared';
import { apiClient, API_BASE, getAccessToken } from '../client';
import { getTaxEstimatorFirmId } from './useTaxEstimatorTaxpayers';

const BASE = '/tax-estimator';
export const SNAPSHOTS_KEY = 'tax-estimator-snapshots';

function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const firm = getTaxEstimatorFirmId();
  return apiClient<T>(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...(firm ? { 'X-Firm-Id': firm } : {}) },
  });
}

export function useSnapshots(taxpayerId: string | undefined, taxYear: number, opts: { scenarioId?: string; limit: number; offset: number; enabled?: boolean }) {
  return useQuery({
    queryKey: [SNAPSHOTS_KEY, 'list', taxpayerId, taxYear, opts.scenarioId ?? null, opts.limit, opts.offset],
    enabled: !!taxpayerId && (opts.enabled ?? true),
    queryFn: () => call<EstimateSnapshotListDTO>(
      `/taxpayers/${taxpayerId}/years/${taxYear}/snapshots?limit=${opts.limit}&offset=${opts.offset}${opts.scenarioId ? `&scenarioId=${opts.scenarioId}` : ''}`,
    ),
  });
}

export function useSnapshot(snapshotId: string | undefined) {
  return useQuery({
    queryKey: [SNAPSHOTS_KEY, 'one', snapshotId], enabled: !!snapshotId,
    queryFn: async () => (await call<{ data: EstimateSnapshotDTO }>(`/snapshots/${snapshotId}`)).data,
  });
}

export function useSnapshotCompare(snapshotId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [SNAPSHOTS_KEY, 'compare', snapshotId], enabled: !!snapshotId && enabled,
    queryFn: async () => (await call<{ data: SnapshotCompareDTO }>(`/snapshots/${snapshotId}/compare`)).data,
  });
}

export interface FinalizeInput { throughMonth?: string; reason?: SnapshotReason; note?: string | null }

export function useFinalizeSnapshot(taxpayerId: string, taxYear: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { scenarioId: string; input: FinalizeInput }) => (await call<{ data: EstimateSnapshotDTO }>(
      `/taxpayers/${taxpayerId}/years/${taxYear}/scenarios/${v.scenarioId}/snapshots`,
      { method: 'POST', body: JSON.stringify(v.input) },
    )).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [SNAPSHOTS_KEY] }),
  });
}

/** Auth-aware blob download of a frozen snapshot's PDF. */
export async function downloadSnapshotPdf(snapshotId: string): Promise<void> {
  const token = getAccessToken();
  const firm = getTaxEstimatorFirmId();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (firm) headers['X-Firm-Id'] = firm;
  const res = await fetch(`${API_BASE}${BASE}/snapshots/${snapshotId}/pdf`, { headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `tax-estimate-snapshot-${snapshotId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
