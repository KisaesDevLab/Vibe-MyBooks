// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// React Query hooks for the bulk-import endpoints. Mirrors the
// payroll-import + bank-feed-import patterns: upload returns a session
// row + preview + validation errors; the page polls /imports/:id while
// the operator reviews; commit triggers the actual write.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_BASE } from '../client';
import type {
  ImportCommitResult,
  ImportKind,
  ImportPreview,
  ImportSession,
  ImportStatus,
  ImportUploadOptions,
  ImportValidationError,
  SourceSystem,
} from '@kis-books/shared';

export interface UploadInput {
  file: File;
  kind: ImportKind;
  sourceSystem: SourceSystem;
  options?: ImportUploadOptions;
}

export interface SessionEnvelope {
  session: ImportSession;
  preview: ImportPreview;
  validationErrors: ImportValidationError[];
}

export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadInput): Promise<SessionEnvelope> => {
      const fd = new FormData();
      fd.append('file', input.file);
      fd.append('kind', input.kind);
      fd.append('sourceSystem', input.sourceSystem);
      if (input.options) fd.append('options', JSON.stringify(input.options));

      // multipart upload — apiClient is JSON-only, so do this with a
      // raw fetch but still go through the BASE_URL prefix so
      // multi-app appliance installs (BASE_URL=`/mybooks/`) route
      // correctly. Same convention as the upload hooks in useBatch /
      // usePayrollImport.
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/imports/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `Upload failed (${res.status}).`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

export function useImportSession(id: string | null) {
  return useQuery<SessionEnvelope>({
    queryKey: ['imports', 'session', id],
    enabled: !!id,
    queryFn: () => apiClient<SessionEnvelope>(`/imports/${id}`),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dryRun }: { id: string; dryRun?: boolean }) =>
      apiClient<{ session: ImportSession; result: ImportCommitResult }>(`/imports/${id}/commit`, {
        method: 'POST',
        body: JSON.stringify({ dryRun: dryRun ?? false }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['imports', 'session', vars.id] });
      // Bust caches whose data the commit may have moved.
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/imports/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

export function useImportSessions(filters?: {
  kind?: ImportKind;
  sourceSystem?: SourceSystem;
  status?: ImportStatus;
}) {
  const params = new URLSearchParams();
  if (filters?.kind) params.set('kind', filters.kind);
  if (filters?.sourceSystem) params.set('sourceSystem', filters.sourceSystem);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return useQuery<{ sessions: ImportSession[]; total: number }>({
    queryKey: ['imports', filters ?? {}],
    queryFn: () => apiClient(`/imports${qs ? `?${qs}` : ''}`),
  });
}
