// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../client';

interface ImportReport {
  imported: number;
  errors: Array<{ index: number; message: string }>;
}

// Phase 5b §5.8 — JSON import. Atomic on the server: a partial
// failure rolls back. Failed imports surface a per-rule error
// list in the AppError.details payload.
export function useImportRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bundle: unknown) =>
      apiClient<ImportReport>('/practice/conditional-rules/import', {
        method: 'POST',
        body: JSON.stringify(bundle),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

// Export goes through apiClient (so the auth header is set)
// then triggers a client-side download via Blob. Avoids the
// "browser navigates without an Authorization header" trap that
// plain `<a href>` downloads run into for authenticated routes.
function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExportJsonRules() {
  return useMutation({
    mutationFn: async () => {
      const bundle = await apiClient<unknown>('/practice/conditional-rules/export.json');
      triggerDownload(
        JSON.stringify(bundle, null, 2),
        `conditional-rules-${Date.now()}.json`,
        'application/json',
      );
      return bundle;
    },
  });
}

// CSV export bypasses apiClient because apiClient always parses
// the body as JSON; the CSV endpoint returns text/csv and JSON
// parsing would throw. We replicate the auth + active-company
// header path here and read the body as text.
async function fetchCsv(path: string): Promise<string> {
  const apiBase = `${import.meta.env.BASE_URL}api/v1`;
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const activeCompanyId = localStorage.getItem('activeCompanyId');
  if (activeCompanyId) headers['X-Company-Id'] = activeCompanyId;
  const res = await fetch(`${apiBase}${path}`, { credentials: 'include', headers });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    let message = 'CSV export failed';
    try {
      const parsed = JSON.parse(errBody);
      message = parsed?.error?.message ?? message;
    } catch {
      if (errBody) message = errBody;
    }
    throw new Error(message);
  }
  return res.text();
}

export function useExportCsvRules() {
  return useMutation({
    mutationFn: async () => {
      const csv = await fetchCsv('/practice/conditional-rules/export.csv');
      triggerDownload(csv, `conditional-rules-${Date.now()}.csv`, 'text/csv');
      return csv;
    },
  });
}
