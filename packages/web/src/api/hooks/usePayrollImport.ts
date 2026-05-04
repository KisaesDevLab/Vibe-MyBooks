// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  PayrollImportSession,
  PayrollProviderTemplate,
  PayrollDescriptionMapping,
  PayrollCheckRow,
  PayrollValidationSummary,
  PayrollJEPreview,
  PayrollSessionFilters,
  PayrollAccountMappingEntry,
} from '@kis-books/shared';
import { apiClient, API_BASE } from '../client';

// ── Sessions ──

export function usePayrollSessions(filters?: PayrollSessionFilters) {
  const params = new URLSearchParams();
  if (filters?.companyId) params.set('companyId', filters.companyId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();

  return useQuery({
    queryKey: ['payroll-sessions', filters],
    queryFn: () => apiClient<{ data: PayrollImportSession[]; total: number }>(`/payroll-import/sessions${qs ? `?${qs}` : ''}`),
  });
}

export function usePayrollSession(id: string) {
  return useQuery({
    queryKey: ['payroll-sessions', id],
    queryFn: () => apiClient<{ session: PayrollImportSession }>(`/payroll-import/sessions/${id}`),
    enabled: !!id,
  });
}

// Preview rows expose the raw CSV/spreadsheet cell values and (after
// mapping is applied) a normalised projection keyed by payroll line type.
// Both shapes are dynamic — column names come from the source file — so
// we index by string and leave values permissive.
export type PayrollPreviewCellMap = Record<string, string | number | null>;

export function usePayrollPreview(id: string) {
  return useQuery({
    queryKey: ['payroll-preview', id],
    queryFn: () => apiClient<{
      session: PayrollImportSession;
      headers: string[];
      rows: Array<{ rowNumber: number; rawData: PayrollPreviewCellMap; mappedData: PayrollPreviewCellMap }>;
    }>(`/payroll-import/sessions/${id}/preview`),
    enabled: !!id,
  });
}

// ── Upload ──

export function usePayrollUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      file: File;
      companionFile?: File;
      companyId?: string;
      templateId?: string;
      importMode?: string;
      payPeriodStart?: string;
      payPeriodEnd?: string;
      checkDate?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.companionFile) formData.append('companionFile', data.companionFile);
      if (data.companyId) formData.append('companyId', data.companyId);
      if (data.templateId) formData.append('templateId', data.templateId);
      if (data.importMode) formData.append('importMode', data.importMode);
      if (data.payPeriodStart) formData.append('payPeriodStart', data.payPeriodStart);
      if (data.payPeriodEnd) formData.append('payPeriodEnd', data.payPeriodEnd);
      if (data.checkDate) formData.append('checkDate', data.checkDate);

      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/payroll-import/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Upload failed' } }));
        throw new Error(err.error?.message || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-sessions'] });
    },
  });
}

// ── Column Mapping (Mode A) ──

// The apply-mapping config is a union of two shapes that both flow
// through this endpoint: a lightweight `columnMap` used by some callers,
// and the richer header/data-row/skip-rule config produced by the
// ColumnMapper UI. The server accepts either.
export type PayrollApplyMappingConfig =
  | {
      columnMap: Record<string, string>;
      rowOverrides?: Record<string, Record<string, string>>;
    }
  | {
      header_row: number;
      data_start_row: number;
      date_format: string;
      mappings: Record<string, { source: string }>;
      skip_rules: Array<
        | { type: 'blank_field'; field: string }
        | { type: 'value_match'; field: string; values: string[] }
      >;
    };

export function useApplyMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, config }: { sessionId: string; config: PayrollApplyMappingConfig }) =>
      apiClient<{ mappedCount: number; skippedCount: number }>(
        `/payroll-import/sessions/${sessionId}/apply-mapping`,
        { method: 'POST', body: JSON.stringify(config) },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-sessions', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['payroll-preview', vars.sessionId] });
    },
  });
}

// ── Description Map (Mode B) ──

export function useDescriptionMap(sessionId: string) {
  return useQuery({
    queryKey: ['payroll-desc-map', sessionId],
    queryFn: () => apiClient<{ mappings: PayrollDescriptionMapping[] }>(
      `/payroll-import/sessions/${sessionId}/description-map`,
    ),
    enabled: !!sessionId,
  });
}

export function useSaveDescriptionMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, providerKey, mappings }: {
      sessionId: string;
      providerKey: string;
      mappings: Array<{ sourceDescription: string; accountId: string; lineCategory?: string }>;
    }) =>
      apiClient(`/payroll-import/sessions/${sessionId}/description-map`, {
        method: 'PUT',
        body: JSON.stringify({ providerKey, mappings }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-desc-map', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['payroll-sessions', vars.sessionId] });
    },
  });
}

// ── Validate ──

export function useValidateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient<PayrollValidationSummary>(`/payroll-import/sessions/${sessionId}/validate`, { method: 'POST' }),
    onSuccess: (_d, sessionId) => {
      qc.invalidateQueries({ queryKey: ['payroll-sessions', sessionId] });
    },
  });
}

// ── Generate JE ──

export interface GenerateJEOptions {
  aggregationMode?: 'summary' | 'per_employee';
  includeEmployerTaxes?: boolean;
  includePtoAccrual?: boolean;
}

export function useGenerateJE() {
  return useMutation({
    mutationFn: ({ sessionId, options }: { sessionId: string; options?: GenerateJEOptions }) =>
      apiClient<{ previews: PayrollJEPreview[] }>(
        `/payroll-import/sessions/${sessionId}/generate-je`,
        { method: 'POST', body: JSON.stringify(options || { aggregationMode: 'summary' }) },
      ),
  });
}

// ── Post JE ──

export function usePostJE() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, forcePost }: { sessionId: string; forcePost?: boolean }) =>
      apiClient<{
        journalEntryIds?: string[];
        count?: number;
        overlaps?: Array<{ sessionId: string; filename: string; payPeriod: string; postedDate: string }>;
        requiresConfirmation?: boolean;
      }>(
        `/payroll-import/sessions/${sessionId}/post`,
        { method: 'POST', body: JSON.stringify({ forcePost }) },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-sessions'] });
      qc.invalidateQueries({ queryKey: ['payroll-sessions', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// ── Reverse ──

export function useReversePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason: string }) =>
      apiClient(`/payroll-import/sessions/${sessionId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-sessions'] });
      qc.invalidateQueries({ queryKey: ['payroll-sessions', vars.sessionId] });
    },
  });
}

// ── Delete ──

export function useDeletePayrollSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient(`/payroll-import/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-sessions'] });
    },
  });
}

// ── Templates ──

export function usePayrollTemplates() {
  return useQuery({
    queryKey: ['payroll-templates'],
    queryFn: () => apiClient<{ templates: PayrollProviderTemplate[] }>('/payroll-import/templates'),
  });
}

// ── Checks (Mode B) ──

export function usePayrollChecks(sessionId: string) {
  return useQuery({
    queryKey: ['payroll-checks', sessionId],
    queryFn: () => apiClient<{ checks: PayrollCheckRow[] }>(`/payroll-import/sessions/${sessionId}/checks`),
    enabled: !!sessionId,
  });
}

export function usePostChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, bankAccountId, checkIds }: {
      sessionId: string;
      bankAccountId: string;
      checkIds: string[];
    }) =>
      apiClient(`/payroll-import/sessions/${sessionId}/checks/post`, {
        method: 'POST',
        body: JSON.stringify({ bankAccountId, checkIds }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-checks', vars.sessionId] });
    },
  });
}

// ── Account Mappings ──

export function usePayrollAccountMappings(companyId: string) {
  return useQuery({
    queryKey: ['payroll-account-mappings', companyId],
    queryFn: () => apiClient<{ mappings: PayrollAccountMappingEntry[] }>(
      `/payroll-import/account-mappings/${companyId}`,
    ),
    enabled: !!companyId,
  });
}

export function useSavePayrollAccountMappings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, mappings }: { companyId: string; mappings: Record<string, string> }) =>
      apiClient(`/payroll-import/account-mappings/${companyId}`, {
        method: 'PUT',
        body: JSON.stringify({ mappings }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-account-mappings', vars.companyId] });
    },
  });
}

export function useAutoMapPayrollAccounts() {
  return useMutation({
    mutationFn: (companyId: string) =>
      apiClient<{ suggestions: Record<string, string> }>(
        `/payroll-import/account-mappings/${companyId}/auto-map`,
        { method: 'POST' },
      ),
  });
}
