// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  CreateDailySalesTemplateInput,
  UpdateDailySalesTemplateInput,
  DailySalesTemplateLineInput,
  CreateDailySalesEntryInput,
  UpdateDailySalesEntryInput,
  PreviewDailySalesEntryInput,
} from '@kis-books/shared';

export interface DailySalesTemplateLine {
  id: string;
  section: string;
  label: string;
  accountId: string | null;
  normalSide: 'debit' | 'credit';
  sortOrder: number;
  isRequired: boolean;
  allowTag: boolean;
  isActive: boolean;
}
export interface DailySalesTemplate {
  id: string;
  name: string;
  presetType: string;
  defaultTagId: string | null;
  isActive: boolean;
  lines: DailySalesTemplateLine[];
}
export interface DailySalesEntrySummary {
  id: string;
  templateId: string;
  templateName: string | null;
  businessDate: string;
  status: 'draft' | 'posted' | 'void';
  transactionId: string | null;
  overShortAmount: string;
  totalSales: string;
  totalTax: string;
  totalPayments: string;
  postedAt: string | null;
  createdAt: string | null;
}
export interface DailySalesEntryValue { templateLineId: string; amount: string; tagId: string | null }
export interface DailySalesEntry extends DailySalesEntrySummary {
  tagId: string | null;
  notes: string | null;
  values: DailySalesEntryValue[];
  template: DailySalesTemplate;
}
export interface DailySalesPreview {
  totalDebits: string;
  totalCredits: string;
  overShort: string;
  balanced: boolean;
  totalSales: string;
  totalTax: string;
  totalPayments: string;
  unmappedLabels: string[];
}

const KEY = ['daily-sales'];

// ── Templates ──
export function useDailySalesTemplates() {
  return useQuery({
    queryKey: [...KEY, 'templates'],
    queryFn: () => apiClient<{ templates: DailySalesTemplate[] }>('/daily-sales/templates'),
  });
}
export function useDailySalesTemplate(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'template', id],
    queryFn: () => apiClient<{ template: DailySalesTemplate }>(`/daily-sales/templates/${id}`),
    enabled: !!id,
  });
}
export function useCreateDailySalesTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDailySalesTemplateInput) =>
      apiClient<{ template: DailySalesTemplate }>('/daily-sales/templates', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'templates'] }),
  });
}
export function useUpdateDailySalesTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDailySalesTemplateInput }) =>
      apiClient(`/daily-sales/templates/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useDeleteDailySalesTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/daily-sales/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'templates'] }),
  });
}
export function useReplaceTemplateLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: DailySalesTemplateLineInput[] }) =>
      apiClient<{ template: DailySalesTemplate }>(`/daily-sales/templates/${id}/lines`, { method: 'PUT', body: JSON.stringify({ lines }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Entries ──
export function useDailySalesEntries(filters?: { status?: string; templateId?: string; from?: string; to?: string }) {
  const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => v)).toString();
  return useQuery({
    queryKey: [...KEY, 'entries', filters],
    queryFn: () => apiClient<{ entries: DailySalesEntrySummary[] }>(`/daily-sales/entries${qs ? `?${qs}` : ''}`),
  });
}
export function useDailySalesEntry(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'entry', id],
    queryFn: () => apiClient<{ entry: DailySalesEntry }>(`/daily-sales/entries/${id}`),
    enabled: !!id,
  });
}
export function useCreateDailySalesDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDailySalesEntryInput) =>
      apiClient<{ entry: DailySalesEntry }>('/daily-sales/entries', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'entries'] }),
  });
}
export function useUpdateDailySalesDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDailySalesEntryInput }) =>
      apiClient<{ entry: DailySalesEntry }>(`/daily-sales/entries/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function usePostDailySalesEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ entry: DailySalesEntry }>(`/daily-sales/entries/${id}/post`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useVoidDailySalesEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ entry: DailySalesEntry }>(`/daily-sales/entries/${id}/void`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useDeleteDailySalesEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/daily-sales/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'entries'] }),
  });
}
export function usePreviewDailySalesEntry() {
  return useMutation({
    mutationFn: (input: PreviewDailySalesEntryInput) =>
      apiClient<DailySalesPreview>('/daily-sales/entries/preview', { method: 'POST', body: JSON.stringify(input) }),
  });
}
