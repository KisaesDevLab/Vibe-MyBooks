// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { apiClient, API_BASE } from '../../api/client';
import { useToast } from '../../components/ui/Toaster';

/** Rewrite a legacy bare `/api/v1/...` export URL against API_BASE.
 *  Report pages historically hard-coded absolute `/api/v1` paths, which
 *  404 on subpath installs (BASE_URL=`/mybooks/` → the api lives at
 *  `/mybooks/api/v1`). Data fetching goes through apiClient (API_BASE-
 *  aware) so the report renders, but the export button silently failed.
 *  Normalizing here keeps every caller safe even if a new page slips in
 *  a bare path again. URLs already built on API_BASE pass through. */
export function resolveExportUrl(url: string): string {
  if (API_BASE !== '/api/v1' && url.startsWith('/api/v1/')) {
    return `${API_BASE}${url.slice('/api/v1'.length)}`;
  }
  return url;
}

async function downloadReport(url: string, filename: string) {
  const token = localStorage.getItem('accessToken');
  const companyId = localStorage.getItem('activeCompanyId');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (companyId) headers['X-Company-Id'] = companyId;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // 404 with a JSON body is the "No data to export" case; other
    // statuses bubble up as-is so the toast shows something useful.
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Export failed (${res.status})`);
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

/** Open a PDF in a new browser tab via direct URL navigation.
 *  We can't set Authorization on a window.open navigation, so the server
 *  issues a single-use ~60s download token via /downloads/token. The token
 *  rides along as ?_dl= and is consumed on first use — so even if it winds
 *  up in browser history or a proxy log, a replay fails and the long-lived
 *  access token is never exposed in a URL. */
async function openPdfInTab(baseUrl: string) {
  const { token: dlToken } = await apiClient<{ token: string; expiresIn: number }>(
    '/downloads/token',
    { method: 'POST', body: JSON.stringify({}) },
  );
  const companyId = localStorage.getItem('activeCompanyId');
  const sep = baseUrl.includes('?') ? '&' : '?';
  let url = `${baseUrl}${sep}format=pdf&_dl=${encodeURIComponent(dlToken)}`;
  if (companyId) url += `&_company=${encodeURIComponent(companyId)}`;
  window.open(url, '_blank', 'noopener');
}

interface ReportShellProps {
  title: string;
  children: ReactNode;
  filters?: ReactNode;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  /** URL-based export: provide a base URL and the shell handles auth + download */
  exportBaseUrl?: string;
  /** Tailwind max-width class. Defaults to 'max-w-5xl'. Use 'max-w-none' for full width. */
  maxWidth?: string;
}

export function ReportShell({ title, children, filters, onExportCsv, onExportPdf, exportBaseUrl, maxWidth = 'max-w-5xl' }: ReportShellProps) {
  const [csvLoading, setCsvLoading] = useState(false);
  const toast = useToast();

  const hasCsv = !!(onExportCsv || exportBaseUrl);
  const hasPdf = !!(onExportPdf || exportBaseUrl);

  const handleCsv = async () => {
    if (onExportCsv) return onExportCsv();
    if (!exportBaseUrl) return;
    setCsvLoading(true);
    try {
      const base = resolveExportUrl(exportBaseUrl);
      const sep = base.includes('?') ? '&' : '?';
      await downloadReport(`${base}${sep}format=csv`, `${title.replace(/\s+/g, '_')}.csv`);
    } catch (err) {
      // Silent-swallow here masked real failures (404s on subpath
      // installs) — surface them so the user knows the export failed.
      toast.error('CSV export failed', { detail: err instanceof Error ? err.message : undefined });
    }
    setCsvLoading(false);
  };

  const handlePdf = () => {
    if (onExportPdf) return onExportPdf();
    if (!exportBaseUrl) return;
    openPdfInTab(resolveExportUrl(exportBaseUrl)).catch((err) => {
      toast.error('PDF export failed', { detail: err instanceof Error ? err.message : undefined });
    });
  };

  return (
    <div className={`${maxWidth} mx-auto`}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex gap-2">
          {hasCsv && (
            <Button variant="secondary" size="sm" onClick={handleCsv} loading={csvLoading}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
            </Button>
          )}
          {hasPdf && (
            <Button variant="secondary" size="sm" onClick={handlePdf}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>
      {filters && <div className="mb-4">{filters}</div>}
      {children}
    </div>
  );
}
