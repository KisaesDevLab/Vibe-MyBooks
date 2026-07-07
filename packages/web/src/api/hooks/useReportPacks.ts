// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Report Packs — React Query hooks + a blob-download helper.
//
// A "report pack" bundles N catalog reports into one combined PDF, rendered
// async by a worker job. These hooks cover the catalog, pack CRUD, run
// creation, and run polling. The generated PDF is a transient artifact — the
// run page downloads it via `downloadPackPdf`, mirroring ReportShell's
// auth-aware blob download.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ReportDef,
  PeriodPreset,
  ReportPackItemOptions,
} from '@kis-books/shared';
import { apiClient, API_BASE } from '../client';

export type PackRunStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';

export interface ReportPack {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  description: string | null;
  periodPreset: PeriodPreset;
  customRangeStart: string | null;
  customRangeEnd: string | null;
  asOfMode: 'range-end' | 'custom';
  asOfCustom: string | null;
  defaultBasis: 'accrual' | 'cash';
  defaultTagId: string | null;
  coverPage: boolean;
  toc: boolean;
  pageNumbers: boolean;
  filenameTemplate: string;
  onError: 'skip' | 'fail';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ReportPackListItem extends ReportPack {
  itemCount: number;
}

export interface ReportPackItemDetail {
  id: string;
  packId: string;
  sortOrder: number;
  reportId: string;
  optionsJson: ReportPackItemOptions;
  createdAt: string;
}

export interface ReportPackDetail extends ReportPack {
  items: ReportPackItemDetail[];
}

export interface PackRunFailure {
  reportId: string;
  message: string;
}

export interface PackRunError {
  message?: string;
  failures?: PackRunFailure[];
}

export interface ReportPackRun {
  id: string;
  packId: string;
  tenantId: string;
  companyId: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  asOfDate: string | null;
  status: PackRunStatus;
  progress: number;
  currentReportId: string | null;
  transientKey: string | null;
  expiresAt: string | null;
  pageCount: number | null;
  byteSize: number | null;
  errorJson: PackRunError | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** POST/PUT body for a pack. All chrome fields optional — server defaults. */
export interface ReportPackInput {
  name: string;
  description?: string | null;
  periodPreset?: PeriodPreset;
  customRangeStart?: string | null;
  customRangeEnd?: string | null;
  asOfMode?: 'range-end' | 'custom';
  asOfCustom?: string | null;
  defaultBasis?: 'accrual' | 'cash';
  defaultTagId?: string | null;
  coverPage?: boolean;
  toc?: boolean;
  pageNumbers?: boolean;
  filenameTemplate?: string;
  onError?: 'skip' | 'fail';
  items: Array<{ reportId: string; options?: ReportPackItemOptions }>;
}

export interface CreateRunInput {
  rangeStart?: string;
  rangeEnd?: string;
  asOfDate?: string;
}

const PACKS_KEY = ['report-packs'] as const;

// ─── Catalog ─────────────────────────────────────────────────────

export function useReportCatalog() {
  return useQuery({
    queryKey: ['report-catalog'],
    queryFn: () => apiClient<{ catalog: ReportDef[] }>('/reports/catalog'),
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Pack CRUD ───────────────────────────────────────────────────

export function useReportPacks() {
  return useQuery({
    queryKey: PACKS_KEY,
    queryFn: () => apiClient<{ packs: ReportPackListItem[] }>('/reports/packs'),
  });
}

export function useReportPack(id: string | undefined) {
  return useQuery({
    queryKey: ['report-packs', id],
    queryFn: () => apiClient<ReportPackDetail>(`/reports/packs/${id}`),
    enabled: !!id,
  });
}

export function useCreateReportPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportPackInput) =>
      apiClient<ReportPackDetail>('/reports/packs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PACKS_KEY }),
  });
}

export function useUpdateReportPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReportPackInput }) =>
      apiClient<ReportPackDetail>(`/reports/packs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PACKS_KEY }),
  });
}

export function useDeleteReportPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/reports/packs/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PACKS_KEY }),
  });
}

export function useDuplicateReportPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<ReportPackDetail>(`/reports/packs/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PACKS_KEY }),
  });
}

// ─── Runs ────────────────────────────────────────────────────────

export function useCreatePackRun() {
  return useMutation({
    mutationFn: ({ packId, input }: { packId: string; input?: CreateRunInput }) =>
      apiClient<ReportPackRun>(`/reports/packs/${packId}/runs`, {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      }),
  });
}

/**
 * Poll a run while it is queued/running; stop once terminal. The
 * refetchInterval callback inspects the latest data — TanStack v5 passes the
 * Query, whose `state.data` carries the last successful response.
 */
export function useReportPackRun(runId: string | undefined) {
  return useQuery({
    queryKey: ['report-pack-run', runId],
    queryFn: () => apiClient<ReportPackRun>(`/reports/packs/runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 1500 : false;
    },
  });
}

/**
 * Download a completed run's combined PDF. The PDF is transient (60-min TTL),
 * so this fetches the blob with the same auth + company headers apiClient
 * sends, then triggers an anchor-click download — mirroring ReportShell's
 * `downloadReport`.
 */
export async function downloadPackPdf(runId: string, filename: string): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const companyId = localStorage.getItem('activeCompanyId');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (companyId) headers['X-Company-Id'] = companyId;
  const res = await fetch(`${API_BASE}/reports/packs/runs/${runId}/pdf`, { headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
