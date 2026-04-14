import type { TailscaleNode } from '@kis-books/shared';
import { Users } from 'lucide-react';

function formatRelative(iso: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const delta = Math.floor((Date.now() - then) / 1000);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
}

export function PeerList({ peers }: { peers: TailscaleNode[] }) {
  const sorted = [...peers].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.hostName.localeCompare(b.hostName);
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Users className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Tailnet Peers</h2>
        <span className="text-sm text-gray-500">({sorted.length})</span>
      </div>
      {sorted.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 text-center">No peers visible.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Host</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">OS</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tailnet IP</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Connection</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const ip = p.tailscaleIPs[0] ?? '—';
                const relayed = p.online && !!p.relay;
                return (
                  <tr key={p.id || p.publicKey} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            p.online ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <span className="font-medium text-gray-900">{p.hostName || '—'}</span>
                      </div>
                      {p.dnsName && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {p.dnsName.replace(/\.$/, '')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.os || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{ip}</td>
                    <td className="px-4 py-3">
                      {!p.online ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
                          Offline
                        </span>
                      ) : relayed ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs">
                          Relayed via {p.relay}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-xs">
                          Direct
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatRelative(p.lastSeen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
