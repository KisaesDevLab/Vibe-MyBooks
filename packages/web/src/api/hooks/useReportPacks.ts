// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

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
  pageFooter: string | null;
  filenameTemplate: string;
  onError: 'skip' | 'fail';
  letterId: string | null;
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
  pageFooter?: string | null;
  filenameTemplate?: string;
  onError?: 'skip' | 'fail';
  letterId?: string | null;
  items: Array<{ reportId: string; options?: ReportPackItemOptions }>;
}

/** Active engagement-letter option for the pack builder's picker. */
export interface ReportPackLetterOption {
  id: string;
  name: string;
  letterType: string;
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

// Active engagement letters (SSARS 21) selectable for a pack. Managed by the
// super-admin; every user building a pack can pick one to include.
export function useReportPackLetters() {
  return useQuery({
    queryKey: ['report-packs', 'letters'],
    queryFn: () => apiClient<{ letters: ReportPackLetterOption[] }>('/reports/letters'),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Pack CRUD ───────────────────────────────────────────────────

export function useReportPacks() {
  return useQuery({
    queryKey: PACKS_KEY,
    queryFn: () => apiClient<{ packs: ReportPackListItem[] }>('/reports/packs'),
  });
}

// Whether the background report-pack worker + Redis are reachable. When they
// aren't, packs still generate inline in the API — this just surfaces it.
export function useReportPackWorkerHealth() {
  return useQuery({
    queryKey: ['report-packs', 'worker-health'],
    queryFn: () => apiClient<{ redisReachable: boolean; workerRunning: boolean }>('/reports/packs/worker-health'),
    staleTime: 30_000,
    refetchInterval: 60_000,
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

// ─── Pack templates (super admin saves; staff apply) ────────────

export interface ReportPackTemplate {
  id: string;
  name: string;
  description: string | null;
  reportCount: number;
  reportIds: string[];
  createdAt: string;
  updatedAt: string;
}

const TEMPLATES_KEY = ['report-pack-templates'] as const;

export function useReportPackTemplates(enabled = true) {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => apiClient<{ templates: ReportPackTemplate[] }>('/reports/pack-templates'),
    enabled,
  });
}

export function useSavePackAsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packId, name, description }: { packId: string; name?: string; description?: string | null }) =>
      apiClient<{ template: ReportPackTemplate }>(`/reports/packs/${packId}/save-as-template`, {
        method: 'POST', body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useApplyPackTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name?: string }) =>
      apiClient<ReportPackDetail>(`/reports/pack-templates/${templateId}/apply`, {
        method: 'POST', body: JSON.stringify(name ? { name } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PACKS_KEY }),
  });
}

export function useRenamePackTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient<{ template: ReportPackTemplate }>(`/reports/pack-templates/${id}`, {
        method: 'PUT', body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeletePackTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<void>(`/reports/pack-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
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
/** Pull the filename out of a Content-Disposition header (filename* first). */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try { return decodeURIComponent(star[1].trim()); } catch { /* fall through */ }
  }
  const plain = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || null;
}

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
  // The server renders the pack's filename template ({tenant}, {range}, …);
  // `filename` is only the fallback when the header is missing.
  a.download = filenameFromDisposition(res.headers.get('Content-Disposition')) ?? filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
