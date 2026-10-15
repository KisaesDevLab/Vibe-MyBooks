// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// CSV and Print / PDF buttons for the Transactions list. Both export the
// WHOLE list the operator is looking at — every page of the current filters,
// search, date range and sort — built server-side by
// GET /transactions/export (one row per transaction, General Ledger column
// layout, totals row). The CSV downloads; the PDF opens in a new tab to
// print or save.

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { fetchWithSession, openReportPdf } from './openReportPdf';

export interface TransactionExportFilters {
  txnType?: string;
  status?: string;
  accountId?: string;
  contactId?: string;
  tagId?: string;
  source?: string;
  basis?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}

/** API path for the export — same query names the list itself sends
 *  (useTransactions), minus paging, plus the format and browser time zone
 *  (the PDF's "Printed" stamp). */
export function transactionExportPath(filters: TransactionExportFilters, format: 'csv' | 'pdf'): string {
  const params = new URLSearchParams();
  params.set('format', format);
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  // The list only sends a direction alongside a sort column.
  if (!filters.sortBy) params.delete('sortDir');
  if (format === 'pdf') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.set('tz', tz);
    } catch {
      // No Intl zone — the server prints UTC.
    }
  }
  return `/transactions/export?${params.toString()}`;
}

function fileNameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = /filename="([^"]+)"/.exec(cd);
  return m?.[1] ?? fallback;
}

async function downloadCsv(path: string): Promise<{ truncated: boolean; rowCount: number }> {
  const res = await fetchWithSession(path);
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Export failed (${res.status})`);
  }
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileNameFrom(res, 'Transactions.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return {
    truncated: res.headers.get('X-Export-Truncated') === 'true',
    rowCount: Number(res.headers.get('X-Export-Row-Count') ?? 0),
  };
}

export function TransactionExportButtons({ filters }: { filters: TransactionExportFilters }) {
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const exportCsv = async () => {
    setBusy('csv');
    setError(null);
    setNotice(null);
    try {
      const { truncated, rowCount } = await downloadCsv(transactionExportPath(filters, 'csv'));
      if (truncated) {
        setNotice(`The export was capped at ${rowCount.toLocaleString('en-US')} transactions. Narrow the date range or filters to export the rest.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setBusy(null);
    }
  };

  // openReportPdf opens the tab synchronously — it must run inside the click.
  const exportPdf = async () => {
    setBusy('pdf');
    setError(null);
    setNotice(null);
    try {
      await openReportPdf(transactionExportPath(filters, 'pdf'), { title: 'Transactions', fallbackFileName: 'Transactions.pdf' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={exportCsv} loading={busy === 'csv'} disabled={busy !== null}
          title="Download every transaction matching the current filters and sort as CSV">
          <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={exportPdf} loading={busy === 'pdf'} disabled={busy !== null}
          title="Open a printable PDF of every transaction matching the current filters and sort">
          <Download className="h-4 w-4 mr-1" /> Print / PDF
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
      {notice && <p role="status" className="text-xs text-amber-700 max-w-xs text-right">{notice}</p>}
    </div>
  );
}
