// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Cloud, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

// CLOUDFLARE_TUNNEL_PLAN Phase 8 — admin dashboard tile.
//
// Hits the super-admin endpoint /admin/cloudflared/status which in
// turn scrapes the cloudflared sidecar's Prometheus endpoint. The
// status object always comes back 200 — `reachable: false` is normal
// on LAN-only installs (sidecar not running) and renders as a muted
// "not running" state rather than an error.

interface CloudflaredStatus {
  reachable: boolean;
  activeConnections: number;
  connected: boolean;
  totalConnections: number;
  totalReconnects: number;
  checkedAt: string;
  lastHealthyAt: string | null;
  error?: string;
}

function formatDelta(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CloudflaredStatusCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cloudflared', 'status'],
    queryFn: () => apiClient<CloudflaredStatus>('/admin/cloudflared/status'),
    // Poll every 30 s so a freshly-started tunnel reflects within
    // seconds, without hammering cloudflared's /metrics scraper.
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">Cloudflare Tunnel — loading…</span>
        </div>
      </div>
    );
  }

  // reachable=false is the normal "tunnel sidecar not running" state
  // (LAN-only install, or operator hasn't enabled `--profile tunnel`).
  // Render as muted rather than as an error.
  if (!data.reachable) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-700">Cloudflare Tunnel</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Sidecar not running. Enable with <code className="bg-gray-100 px-1 rounded">docker compose --profile tunnel up -d</code>.
            </p>
            {data.error && (
              <p className="text-xs text-gray-400 mt-1">{data.error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const connected = data.connected;
  const tone = connected
    ? { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700', Icon: CheckCircle }
    : { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', Icon: AlertTriangle };

  return (
    <div className={`rounded-lg border shadow-sm p-6 ${tone.border} ${tone.bg}`}>
      <div className="flex items-start gap-3">
        <tone.Icon className={`h-5 w-5 mt-0.5 ${tone.text}`} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            Cloudflare Tunnel — {connected ? 'Connected' : 'Disconnected'}
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-gray-700">
            <div>Active connections: <span className="font-mono">{data.activeConnections}</span></div>
            <div>Last healthy: {formatDelta(data.lastHealthyAt)}</div>
            <div>Total since start: <span className="font-mono">{data.totalConnections}</span></div>
            <div>Reconnects: <span className="font-mono">{data.totalReconnects}</span></div>
          </div>
          {!connected && data.lastHealthyAt && (
            <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Outbound tunnel is down. LAN access still works; client-portal traffic is unreachable until it reconnects.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
