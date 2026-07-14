// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  CreateJeTemplateInput,
  UpdateJeTemplateInput,
  JeTemplateLineInput,
  JeTemplate,
  JeTemplateWithLines,
} from '@kis-books/shared';

export function useJeTemplates() {
  return useQuery({
    queryKey: ['je-templates'],
    queryFn: () => apiClient<{ templates: JeTemplate[] }>('/je-templates'),
  });
}

export function useJeTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['je-templates', id],
    enabled: !!id,
    queryFn: () => apiClient<{ template: JeTemplateWithLines }>(`/je-templates/${id}`),
  });
}

export function useCreateJeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJeTemplateInput) =>
      apiClient<{ template: JeTemplateWithLines }>('/je-templates', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['je-templates'] }),
  });
}

export function useUpdateJeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateJeTemplateInput & { id: string }) =>
      apiClient<{ template: JeTemplateWithLines }>(`/je-templates/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['je-templates'] }),
  });
}

export function useDeleteJeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ deleted: true }>(`/je-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['je-templates'] }),
  });
}

export function useReplaceJeTemplateLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: JeTemplateLineInput[] }) =>
      apiClient<{ template: JeTemplateWithLines }>(`/je-templates/${id}/lines`, { method: 'PUT', body: JSON.stringify({ lines }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['je-templates'] }),
  });
}
