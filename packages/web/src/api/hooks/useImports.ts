// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// React Query hooks for the bulk-import endpoints. Mirrors the
// payroll-import + bank-feed-import patterns: upload returns a session
// row + preview + validation errors; the page polls /imports/:id while
// the operator reviews; commit triggers the actual write.
//
// We use direct fetch (not apiClient) so we can preserve the API's
// `error.code` and `error.details` envelope all the way to the UI.
// apiClient throws a plain Error with only the message, which loses the
// machine-readable code (e.g. IMPORT_UNKNOWN_ACCOUNT) and the structured
// details (e.g. the offending account numbers) that the page renders
// in its friendly-error mapping.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../client';
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

// ── Error envelope ────────────────────────────────────────────────

/**
 * Carries the API's full `{ message, code, details }` error envelope so
 * the page can render code-specific copy (e.g., "Unknown accounts: …")
 * instead of just dumping the message string.
 */
export class ImportApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ImportApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function importsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string; code?: string; details?: Record<string, unknown> } }
      | null;
    const message = body?.error?.message ?? `Request failed (HTTP ${res.status}).`;
    throw new ImportApiError(res.status, message, body?.error?.code, body?.error?.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Hooks ─────────────────────────────────────────────────────────

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
      return importsFetch<SessionEnvelope>('/imports/upload', { method: 'POST', body: fd });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

export function useImportSession(id: string | null) {
  return useQuery<SessionEnvelope, ImportApiError>({
    queryKey: ['imports', 'session', id],
    enabled: !!id,
    queryFn: () => importsFetch<SessionEnvelope>(`/imports/${id}`),
    // Don't retry on 404 — the session simply doesn't exist.
    retry: (failureCount, err) => err.status !== 404 && failureCount < 2,
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation<{ session: ImportSession; result: ImportCommitResult }, ImportApiError, { id: string; dryRun?: boolean }>({
    mutationFn: ({ id, dryRun }) =>
      importsFetch(`/imports/${id}/commit`, {
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
  return useMutation<void, ImportApiError, string>({
    mutationFn: (id: string) => importsFetch<void>(`/imports/${id}`, { method: 'DELETE' }),
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
  return useQuery<{ sessions: ImportSession[]; total: number }, ImportApiError>({
    queryKey: ['imports', filters ?? {}],
    queryFn: () => importsFetch(`/imports${qs ? `?${qs}` : ''}`),
  });
}
