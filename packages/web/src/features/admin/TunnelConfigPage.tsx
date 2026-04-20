// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Cloud, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

// CLOUDFLARE_TUNNEL_PLAN Phase 9 — reconfigure tunnel + Turnstile from
// the admin panel. Tunnel token rotation requires restarting the
// cloudflared sidecar (documented inline); Turnstile key rotation is
// hot-reloadable via an in-memory cache bust on the server.

interface CloudflaredStatus {
  reachable: boolean;
  connected: boolean;
  activeConnections: number;
  totalConnections: number;
  totalReconnects: number;
  lastHealthyAt: string | null;
  error?: string;
}

interface TunnelConfig {
  tunnel: CloudflaredStatus;
  turnstileSiteKey: string | null;
  turnstileSecretConfigured: boolean;
  turnstileSiteKeySource: 'database' | 'env' | 'unset';
  turnstileSecretSource: 'database' | 'env' | 'unset';
}

export function TunnelConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'tunnel-config'],
    queryFn: () => apiClient<TunnelConfig>('/admin/tunnel-config'),
    refetchInterval: 30_000,
  });

  const [siteKey, setSiteKey] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (body: { turnstileSiteKey?: string; turnstileSecretKey?: string }) =>
      apiClient('/admin/tunnel-config', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSaved(true);
      setSecretKey('');
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tunnel-config'] });
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load tunnel config: {(error as Error)?.message || 'unknown'}
        </div>
      </div>
    );
  }

  const { tunnel } = data;
  const tunnelOk = tunnel.reachable && tunnel.connected;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Cloud className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Tunnel &amp; Turnstile</h1>
      </div>

      {/* Current tunnel state */}
      <div className={`rounded-lg border shadow-sm p-5 ${
        tunnelOk ? 'bg-green-50 border-green-200'
        : !tunnel.reachable ? 'bg-gray-50 border-gray-200'
        : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`h-5 w-5 mt-0.5 ${tunnelOk ? 'text-green-700' : 'text-gray-500'}`} />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900">
              Tunnel:{' '}
              {!tunnel.reachable ? 'Sidecar not running'
                : tunnelOk ? 'Connected'
                : 'Disconnected'}
            </h2>
            {tunnel.reachable && (
              <p className="text-xs text-gray-700 mt-1">
                Active connections: <span className="font-mono">{tunnel.activeConnections}</span> · Total: <span className="font-mono">{tunnel.totalConnections}</span> · Reconnects: <span className="font-mono">{tunnel.totalReconnects}</span>
                {tunnel.lastHealthyAt && ` · Last healthy: ${new Date(tunnel.lastHealthyAt).toLocaleString()}`}
              </p>
            )}
            {!tunnel.reachable && (
              <p className="text-xs text-gray-600 mt-1">
                Enable with <code className="bg-white/60 px-1 rounded">docker compose --profile tunnel up -d</code> once the firm has pasted their CLOUDFLARE_TUNNEL_TOKEN into <code className="bg-white/60 px-1 rounded">.env</code>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tunnel token rotation — out of scope for this UI */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Rotating the tunnel token
        </h2>
        <p className="text-xs text-gray-700 mt-2">
          Tunnel tokens are baked into the <code className="bg-gray-100 px-1 rounded">cloudflared</code> container at startup and can't be hot-swapped from the admin panel. To rotate:
        </p>
        <ol className="text-xs text-gray-700 mt-2 space-y-1 list-decimal list-inside">
          <li>In the firm's Cloudflare Zero Trust dashboard → Networks → Tunnels, refresh the token.</li>
          <li>Paste the new token into the appliance's <code className="bg-gray-100 px-1 rounded">.env</code> as <code className="bg-gray-100 px-1 rounded">CLOUDFLARE_TUNNEL_TOKEN</code>.</li>
          <li><code className="bg-gray-100 px-1 rounded">docker compose --profile tunnel restart cloudflared</code>.</li>
          <li>Watch this page — the status card above flips to Connected within 60 s.</li>
        </ol>
      </div>

      {/* Turnstile rotation */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Turnstile keys</h2>
          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
            <p>Current site key source: <span className="font-mono">{data.turnstileSiteKeySource}</span>{data.turnstileSiteKey ? <> — <code className="bg-gray-100 px-1 rounded">{data.turnstileSiteKey}</code></> : <> — <span className="text-gray-400">unset</span></>}</p>
            <p>Current secret source: <span className="font-mono">{data.turnstileSecretSource}</span>{data.turnstileSecretConfigured ? <span className="text-green-700 ml-1">— configured</span> : <span className="text-gray-400 ml-1">— not set</span>}</p>
          </div>
          {data.turnstileSecretSource === 'env' && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Saving a new secret here stores it in the database and takes precedence over the <code className="bg-white/60 px-1 rounded">TURNSTILE_SECRET_KEY</code> env var for all future verifications.</span>
            </div>
          )}
        </div>

        <Input
          label="New Site Key (public)"
          value={siteKey}
          onChange={(e) => setSiteKey(e.target.value)}
          placeholder={data.turnstileSiteKey || 'Paste the new Turnstile site key'}
        />
        <Input
          label="New Secret Key (server-only)"
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={data.turnstileSecretConfigured ? '••••••••••• (leave blank to keep current)' : 'Paste the new Turnstile secret key'}
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate({
              turnstileSiteKey: siteKey.trim() || undefined,
              turnstileSecretKey: secretKey.trim() || undefined,
            })}
            loading={save.isPending}
            disabled={!siteKey.trim() && !secretKey.trim()}
          >
            Save Turnstile keys
          </Button>
          {saved && <span className="text-sm text-green-700">Saved — next auth request uses the new keys.</span>}
          {save.error && <span className="text-sm text-red-600">{(save.error as Error).message}</span>}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        See <code>docs/firm-cloudflare-setup.md</code> for the customer-facing walkthrough and <code>docs/cloudflare-tunnel-onboarding.md</code> for the Kisaes internal runbook.
      </div>
    </div>
  );
}
