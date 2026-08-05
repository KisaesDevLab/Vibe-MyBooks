// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { ScrollText, Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Pagination } from '../../../components/ui/Pagination';
import { useTailscaleAudit } from '../../../api/hooks/useTailscale';
import { getAccessToken } from '../../../api/client';

const ACTIONS = ['', 'connect', 'disconnect', 'reauth', 'serve_enable', 'serve_disable'];

const PAGE_SIZE_OPTIONS = ['25', '50', '100'];

export function AuditTable() {
  const [action, setAction] = useState('');
  const [pageSize, setPageSize] = useState('25');
  const [offset, setOffset] = useState(0);
  const [csvError, setCsvError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const limit = parseInt(pageSize, 10);
  // The audit API is page-based; derive the 1-based page from the offset.
  const { data, isLoading, error } = useTailscaleAudit({
    action: action || undefined,
    page: Math.floor(offset / limit) + 1,
    limit,
  });

  const downloadCsv = async () => {
    setCsvError('');
    setDownloading(true);
    try {
      const token = getAccessToken();
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/admin/tailscale/audit/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error?.message || `Export failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailscale-audit.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
          {data && <span className="text-sm text-gray-500">({data.total})</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'All actions'}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={downloadCsv} loading={downloading}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>
      {csvError && (
        <div className="px-6 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {csvError}
        </div>
      )}

      {isLoading ? (
        <div className="p-6 text-sm text-gray-500 text-center">Loading…</div>
      ) : error ? (
        <div className="p-6 text-sm text-red-600 text-center">
          Failed to load audit log. {(error as Error).message}
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 text-center">No audit entries yet.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{e.actorEmail ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{e.target ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {e.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {Object.keys(e.details ?? {}).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                            view
                          </summary>
                          <pre className="mt-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
                            {JSON.stringify(e.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 pb-3 border-t border-gray-200">
            <Pagination
              total={data.total}
              limit={limit}
              offset={offset}
              onChange={setOffset}
              unit="entries"
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={(s) => { setPageSize(s); setOffset(0); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
