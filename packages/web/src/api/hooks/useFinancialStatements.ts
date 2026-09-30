// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// TanStack Query hooks for report-ready financial statements
// (/api/v1/tb/fs, FINANCIAL_STATEMENTS_V1). Query-key root: ['tb', 'fs'].

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FsCreateReportInput, FsDraftOverrides, FsFrontMatter, FsLayout, FsLetterhead, FsLetterheadInput, FsLetterInput,
  FsLayoutTemplateInput, FsRenderedReport, FsReportSettings, FsSourceData, FsStyle, FsStylePresetInput,
  FsCashFlowClass,
} from '@kis-books/shared';
import { API_BASE, apiClient, getAccessToken, refreshAccessToken, ApiError } from '../client';

const ROOT = ['tb', 'fs'] as const;

export interface FsReportListItem {
  id: string;
  name: string;
  periodEnd: string;
  periodStart: string | null;
  periodType: string | null;
  framework: 'gaap' | 'cash' | 'tax';
  bookBasis: 'accrual' | 'cash';
  status: 'draft' | 'final';
  updatedAt: string;
  currentVersion: { versionNo: number; finalizedAt: string; publishedAt: string | null; stale: boolean } | null;
}

export interface FsVersionSummary {
  id: string;
  versionNo: number;
  status: 'final' | 'superseded';
  finalizedAt: string;
  validationOverride: boolean;
  overrideReason: string | null;
  pageCount: number;
  publishedAt: string | null;
  publishedInstanceId: string | null;
  stale: boolean;
}

export interface FsReportDetail {
  report: { id: string; name: string; status: 'draft' | 'final'; currentVersionId: string | null; settings: FsReportSettings; frontMatter: FsFrontMatter; updatedAt: string };
  layout: { id: string; name: string; layout: FsLayout; style: FsStyle; updatedAt: string };
  versions: FsVersionSummary[];
  glVersionStamp: number;
}

export interface FsLibraryLetter { id: string; name: string; letterType: 'compilation' | 'preparation'; title: string | null; bodyHtml: string; isActive: boolean; isDefault: boolean }
export interface FsLibraryPreset { id: string; name: string; styleJson: FsStyle; builtinKey: string | null; isDefault: boolean }
export interface FsLibraryTemplate { id: string; name: string; description: string | null; entityKind: string; layoutJson: FsLayout; isDefault: boolean }
export interface FsLibrary {
  ownedByFirm: boolean;
  letterhead: (FsLetterhead & { id: string; accountantSignature: string | null }) | null;
  letters: FsLibraryLetter[];
  presets: FsLibraryPreset[];
  templates: FsLibraryTemplate[];
}

export interface FsPreviewData {
  source: FsSourceData;
  letterhead: FsLetterhead | null;
  letter: { title: string; bodyHtml: string } | null;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// ── Library ─────────────────────────────────────────────────────────

export function useFsLibrary() {
  return useQuery({ queryKey: [...ROOT, 'library'], queryFn: () => apiClient<FsLibrary>('/tb/fs/library') });
}

function useLibraryMutation<I>(fn: (input: I) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, 'library'] }) });
}

export const useSaveLetterhead = () => useLibraryMutation((input: FsLetterheadInput) => apiClient('/tb/fs/library/letterhead', { method: 'PUT', ...json(input) }));
export const useSaveLetter = () => useLibraryMutation((input: FsLetterInput & { id?: string }) => {
  const { id, ...body } = input;
  return id ? apiClient(`/tb/fs/library/letters/${id}`, { method: 'PUT', ...json(body) }) : apiClient('/tb/fs/library/letters', { method: 'POST', ...json(body) });
});
export const useDeleteLetter = () => useLibraryMutation((id: string) => apiClient(`/tb/fs/library/letters/${id}`, { method: 'DELETE' }));
export const useSavePreset = () => useLibraryMutation((input: FsStylePresetInput & { id?: string }) => {
  const { id, ...body } = input;
  return id ? apiClient(`/tb/fs/library/presets/${id}`, { method: 'PUT', ...json(body) }) : apiClient('/tb/fs/library/presets', { method: 'POST', ...json(body) });
});
export const useDeletePreset = () => useLibraryMutation((id: string) => apiClient(`/tb/fs/library/presets/${id}`, { method: 'DELETE' }));
export const useSaveTemplate = () => useLibraryMutation((input: Partial<FsLayoutTemplateInput> & { id?: string }) => {
  const { id, ...body } = input;
  return id ? apiClient(`/tb/fs/library/templates/${id}`, { method: 'PUT', ...json(body) }) : apiClient('/tb/fs/library/templates', { method: 'POST', ...json(body) });
});
export const useDeleteTemplate = () => useLibraryMutation((id: string) => apiClient(`/tb/fs/library/templates/${id}`, { method: 'DELETE' }));

// ── Reports ─────────────────────────────────────────────────────────

export function useFsReports(page: { limit: number; offset: number }) {
  return useQuery({
    queryKey: [...ROOT, 'reports', page],
    queryFn: () => apiClient<{ reports: FsReportListItem[]; total: number }>(`/tb/fs/reports?limit=${page.limit}&offset=${page.offset}`),
  });
}

export function useFsReport(id: string | undefined) {
  return useQuery({
    queryKey: [...ROOT, 'report', id],
    queryFn: () => apiClient<FsReportDetail>(`/tb/fs/reports/${id}`),
    enabled: !!id,
  });
}

export function useFsLayouts() {
  return useQuery({ queryKey: [...ROOT, 'layouts'], queryFn: () => apiClient<{ layouts: Array<{ id: string; name: string; updatedAt: string }> }>('/tb/fs/layouts') });
}

export function useFsAccounts() {
  return useQuery({
    queryKey: [...ROOT, 'accounts'],
    queryFn: () => apiClient<{ accounts: Array<{ id: string; number: string | null; name: string; accountType: string }> }>('/tb/fs/accounts'),
    staleTime: 60_000,
  });
}

export function useFsBindPreview() {
  return useMutation({
    mutationFn: (templateId: string | null) => apiClient<{ unresolved: Array<{ nodeId: string; statementId: string; leadsheetCode: string | null; caption: string }>; groupings: Array<{ id: string; code: string | null; name: string }> }>(
      '/tb/fs/layouts/bind-preview', { method: 'POST', ...json({ templateId }) },
    ),
  });
}

export function useCreateFsReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FsCreateReportInput) => apiClient<{ report: { id: string } }>('/tb/fs/reports', { method: 'POST', ...json(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT] }),
  });
}

export function useUpdateFsReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; settings?: FsReportSettings; frontMatter?: FsFrontMatter }) =>
      apiClient<FsReportDetail>(`/tb/fs/reports/${id}`, { method: 'PATCH', ...json(input) }),
    onSuccess: (data) => qc.setQueryData([...ROOT, 'report', id], data),
  });
}

export function useSaveFsLayout(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { layoutId: string; layout?: FsLayout; style?: FsStyle; name?: string; expectedUpdatedAt?: string }) => {
      const { layoutId, ...body } = input;
      return apiClient<{ layout: FsReportDetail['layout'] }>(`/tb/fs/layouts/${layoutId}`, { method: 'PATCH', ...json(body) });
    },
    onSuccess: (data) => {
      qc.setQueryData<FsReportDetail>([...ROOT, 'report', reportId], (old) => (old ? { ...old, layout: data.layout } : old));
    },
  });
}

export function useSaveLayoutAsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { layoutId: string; name: string; description?: string | null }) =>
      apiClient(`/tb/fs/layouts/${input.layoutId}/save-as-template`, { method: 'POST', ...json({ name: input.name, description: input.description }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, 'library'] }),
  });
}

export function useArchiveFsReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/tb/fs/reports/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, 'reports'] }),
  });
}

export function useRollForwardFsReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ report: { id: string } }>(`/tb/fs/reports/${id}/roll-forward`, { method: 'POST', ...json({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, 'reports'] }),
  });
}

// Engine input for the live preview. Keyed on the settings that change
// which balances load (period, framework, columns, tag) and the GL stamp.
export function useFsPreviewData(id: string | undefined, settings: FsReportSettings | undefined, frontMatter: FsFrontMatter | undefined, glStamp: number | undefined) {
  return useQuery({
    queryKey: [...ROOT, 'preview-data', id, settings, frontMatter, glStamp],
    queryFn: () => apiClient<FsPreviewData>(`/tb/fs/reports/${id}/preview-data`, { method: 'POST', ...json({ settings, frontMatter }) }),
    enabled: !!id && !!settings,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function useFsCompute(id: string) {
  return useMutation({
    mutationFn: (overrides: FsDraftOverrides) => apiClient<{ model: FsRenderedReport }>(`/tb/fs/reports/${id}/compute`, { method: 'POST', ...json(overrides) }),
  });
}

export function useFinalizeFsReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { overrideValidation?: boolean; reason?: string }) =>
      apiClient<{ versionNo: number; pageCount: number; validationOverride: boolean }>(`/tb/fs/reports/${id}/finalize`, { method: 'POST', ...json(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT] }),
  });
}

export function useReopenFsReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient(`/tb/fs/reports/${id}/reopen`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT] }),
  });
}

export function useFsImpact(id: string, versionNo: number | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ROOT, 'impact', id, versionNo],
    queryFn: () => apiClient<{ stale: boolean; changed: boolean }>(`/tb/fs/reports/${id}/versions/${versionNo}/impact`),
    enabled: enabled && versionNo !== null,
  });
}

export function usePublishFsVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { versionNo: number; title?: string; archivePrevious?: boolean }) =>
      apiClient<{ instanceId: string }>(`/tb/fs/reports/${id}/versions/${input.versionNo}/publish`, { method: 'POST', ...json({ title: input.title, archivePrevious: input.archivePrevious }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT] }),
  });
}

export function useUnpublishFsVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionNo: number) => apiClient(`/tb/fs/reports/${id}/versions/${versionNo}/unpublish`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT] }),
  });
}

export function useFsCashFlowOverrides() {
  return useQuery({
    queryKey: [...ROOT, 'cf-overrides'],
    queryFn: () => apiClient<{ overrides: Array<{ accountId: string | null; groupingId: string | null; classification: FsCashFlowClass }> }>('/tb/fs/cash-flow-overrides'),
  });
}

export function useSaveFsCashFlowOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (overrides: Array<{ accountId?: string | null; groupingId?: string | null; classification: FsCashFlowClass | null }>) =>
      apiClient('/tb/fs/cash-flow-overrides', { method: 'PUT', ...json({ overrides }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...ROOT, 'cf-overrides'] });
      qc.invalidateQueries({ queryKey: [...ROOT, 'preview-data'] });
    },
  });
}

// ── Binary downloads (PDF / DOCX / XLSX) ────────────────────────────

async function fetchBlob(path: string, init: RequestInit = {}): Promise<{ blob: Blob; fileName: string | null }> {
  const doFetch = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const companyId = localStorage.getItem('activeCompanyId');
    if (companyId) headers['X-Company-Id'] = companyId;
    return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  };
  let res = await doFetch();
  if (res.status === 401 && (await refreshAccessToken())) res = await doFetch();
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Download failed' } }));
    throw new ApiError(body?.error?.message || 'Download failed', body?.error?.code, body?.error?.details, res.status);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename="([^"]+)"/.exec(cd);
  return { blob: await res.blob(), fileName: m?.[1] ?? null };
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadFsExport(reportId: string, format: 'pdf' | 'docx' | 'xlsx', versionNo: number | null) {
  const q = new URLSearchParams({ format });
  if (versionNo !== null) q.set('version', String(versionNo));
  const { blob, fileName } = await fetchBlob(`/tb/fs/reports/${reportId}/export?${q.toString()}`);
  saveBlob(blob, fileName ?? `financial-statements.${format}`);
}

export async function fetchFsPreviewPdf(reportId: string, overrides: FsDraftOverrides): Promise<Blob> {
  const { blob } = await fetchBlob(`/tb/fs/reports/${reportId}/preview.pdf`, { method: 'POST', body: JSON.stringify(overrides) });
  return blob;
}
