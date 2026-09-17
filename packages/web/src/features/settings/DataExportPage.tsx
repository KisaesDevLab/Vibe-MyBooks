// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient, getAccessToken, API_BASE } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { Download, FileDown, CheckCircle } from 'lucide-react';

interface ExportManifest {
  files: Array<{ name: string; rowCount: number }>;
  startDate: string | null;
  endDate: string | null;
}

// Matches the API's file list. Master data (accounts, contacts, items, tags)
// always exports in full; the two dated files honour the date range.
const FILE_INFO: Record<string, { label: string; description: string; dated: boolean }> = {
  'accounts.csv': { label: 'Chart of Accounts', description: 'Every account with number, type, detail type, parent and balance.', dated: false },
  'contacts.csv': { label: 'Contacts', description: 'Customers and vendors with addresses, terms, tax ID and 1099 flag.', dated: false },
  'items.csv': { label: 'Products & Services', description: 'Items with price, income account and taxable flag.', dated: false },
  'tags.csv': { label: 'Tags', description: 'Tag groups and tags (the QuickBooks "Class" equivalent).', dated: false },
  'transactions.csv': { label: 'Transactions', description: 'One row per document: invoices, bills, checks, deposits, journal entries.', dated: true },
  'journal_lines.csv': { label: 'Journal Lines', description: 'One row per posting with account, debit, credit, memo and tag. Import this to rebuild the general ledger.', dated: true },
};

type RangeMode = 'all' | 'range';

function rangeQuery(mode: RangeMode, start: string, end: string): string {
  if (mode !== 'range') return '';
  const p = new URLSearchParams();
  if (start) p.set('start_date', start);
  if (end) p.set('end_date', end);
  const q = p.toString();
  return q ? `?${q}` : '';
}

export function DataExportPage() {
  const toast = useToast();
  const [mode, setMode] = useState<RangeMode>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  // The range the manifest was built with — downloads must use the same
  // one even if the user has since edited the inputs.
  const [manifestQuery, setManifestQuery] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const rangeInvalid = mode === 'range' && !!startDate && !!endDate && startDate > endDate;

  const exportAll = useMutation({
    mutationFn: (query: string) => apiClient<ExportManifest>(`/export/full${query}`),
    onSuccess: (result, query) => {
      setManifest(result);
      setManifestQuery(query);
    },
  });

  const handleExport = () => {
    if (rangeInvalid) return;
    exportAll.mutate(rangeQuery(mode, startDate, endDate));
  };

  const handleDownloadFile = async (fileName: string) => {
    const token = getAccessToken();
    setDownloading(fileName);
    try {
      const res = await fetch(`${API_BASE}/export/full/${encodeURIComponent(fileName)}${manifestQuery}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || `Download failed (${res.status})`);
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const suggested = /filename="([^"]+)"/.exec(disposition)?.[1] || fileName;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggested;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download failed', { detail: err instanceof Error ? err.message : undefined });
    } finally {
      setDownloading(null);
    }
  };

  const rangeLabel = manifest && (manifest.startDate || manifest.endDate)
    ? `${manifest.startDate ?? 'the beginning'} to ${manifest.endDate ?? 'today'}`
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Export Data</h1>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">CSV Export</h2>
        <p className="text-sm text-gray-500 mb-2">
          Export your books as plain CSV files: chart of accounts, contacts, products &amp; services,
          tags, transactions and journal lines.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Use these for migration to another system, offline analysis in a spreadsheet, or as a
          human-readable backup. For a complete restorable backup use{' '}
          <span className="font-medium">Settings &gt; Export Company Data</span> instead.
        </p>

        <div className="space-y-4 max-w-lg mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transactions to include</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-range"
                  checked={mode === 'all'}
                  onChange={() => setMode('all')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">All dates</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-range"
                  checked={mode === 'range'}
                  onChange={() => setMode('range')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Date range</span>
              </label>
            </div>
          </div>

          {mode === 'range' && (
            <div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="export-start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    id="export-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="export-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    id="export-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Leave either date blank for an open-ended range. The range applies to transactions and
                journal lines; accounts, contacts, items and tags always export in full.
              </p>
              {rangeInvalid && (
                <p className="text-sm text-red-600 mt-1">Start date must not be after end date.</p>
              )}
            </div>
          )}
        </div>

        {exportAll.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {exportAll.error.message}
          </div>
        )}

        <Button onClick={handleExport} loading={exportAll.isPending} disabled={rangeInvalid}>
          <Download className="h-4 w-4 mr-1" /> Prepare Export
        </Button>
      </div>

      {manifest && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Export Ready</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {rangeLabel
              ? <>Transactions and journal lines cover <span className="font-medium">{rangeLabel}</span>. Click each file to download.</>
              : 'All dates included. Click each file to download.'}
          </p>
          <div className="space-y-2">
            {manifest.files.map((file) => {
              const info = FILE_INFO[file.name];
              return (
                <div
                  key={file.name}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileDown className="h-5 w-5 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {info?.label ?? file.name}
                        <span className="ml-2 font-mono text-xs text-gray-400">{file.name}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {file.rowCount.toLocaleString()} {file.rowCount === 1 ? 'row' : 'rows'}
                        {info ? ` · ${info.description}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={downloading === file.name}
                    disabled={downloading !== null && downloading !== file.name}
                    onClick={() => handleDownloadFile(file.name)}
                  >
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
