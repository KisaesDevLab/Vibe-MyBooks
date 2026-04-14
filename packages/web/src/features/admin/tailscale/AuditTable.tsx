import { useState } from 'react';
import { ScrollText, Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useTailscaleAudit } from '../../../api/hooks/useTailscale';
import { getAccessToken } from '../../../api/client';

const ACTIONS = ['', 'connect', 'disconnect', 'reauth', 'serve_enable', 'serve_disable'];

export function AuditTable() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;
  const { data, isLoading, error } = useTailscaleAudit({
    action: action || undefined,
    page,
    limit,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const downloadCsv = async () => {
    const token = getAccessToken();
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    const res = await fetch(`/api/v1/admin/tailscale/audit/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailscale-audit.csv';
    a.click();
    URL.revokeObjectURL(url);
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
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'All actions'}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

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

          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <div className="text-gray-500">
              Page {data.page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
