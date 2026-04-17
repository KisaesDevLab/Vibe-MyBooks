// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { TailscaleStatus } from '@kis-books/shared';
import { Network, Power, RefreshCw, Copy, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  useTailscaleConnect,
  useTailscaleDisconnect,
  useTailscaleReauth,
} from '../../../api/hooks/useTailscale';

const FALLBACK_COLORS = { dot: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-50' };
const STATE_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  Running: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' },
  Starting: { dot: 'bg-yellow-500 animate-pulse', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  NeedsLogin: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  NeedsMachineAuth: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  Stopped: FALLBACK_COLORS,
  NoState: FALLBACK_COLORS,
};

export function StatusCard({ status }: { status: TailscaleStatus }) {
  const [showDisconnect, setShowDisconnect] = useState(false);
  const connect = useTailscaleConnect();
  const disconnect = useTailscaleDisconnect();
  const reauth = useTailscaleReauth();
  const colors = STATE_COLORS[status.state] ?? FALLBACK_COLORS;
  const primaryIp = status.currentTailscaleIPs[0] ?? null;

  const copyIp = () => {
    if (primaryIp) navigator.clipboard.writeText(primaryIp).catch(() => undefined);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className={`px-6 py-4 border-b border-gray-200 ${colors.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Network className="h-6 w-6 text-gray-700" />
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                <span className={`text-sm font-semibold ${colors.text}`}>{status.state}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Tailnet: {status.tailnetName || '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status.state === 'Running' ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => reauth.mutate()}
                  loading={reauth.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Reauth
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowDisconnect(true)}>
                  <Power className="h-4 w-4 mr-1" /> Disconnect
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => connect.mutate({})}
                loading={connect.isPending}
              >
                <Power className="h-4 w-4 mr-1" /> Connect
              </Button>
            )}
          </div>
        </div>
      </div>

      {status.authURL && (status.state === 'NeedsLogin' || status.state === 'Starting') && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Authentication required.</span>
          <a
            href={status.authURL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-amber-700 hover:text-amber-900 hover:underline"
          >
            Open auth URL <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {status.health.length > 0 && (
        <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-900">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="h-4 w-4" /> Daemon warnings
          </div>
          <ul className="list-disc ml-6 space-y-0.5">
            {status.health.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Hostname</div>
          <div className="text-gray-900 font-medium">
            {status.self?.hostName || '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Primary IP</div>
          <div className="text-gray-900 font-medium flex items-center gap-2">
            {primaryIp ?? '—'}
            {primaryIp && (
              <button onClick={copyIp} className="text-gray-400 hover:text-gray-600" title="Copy">
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">MagicDNS</div>
          <div className="text-gray-900 font-medium">
            {status.self?.dnsName?.replace(/\.$/, '') || status.magicDNSSuffix || '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Version</div>
          <div className="text-gray-900 font-medium">{status.version}</div>
        </div>
      </div>

      {showDisconnect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDisconnect(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Disconnect Tailscale?</h2>
              <button
                onClick={() => setShowDisconnect(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 text-sm text-gray-700">
              This will disconnect remote access to this appliance. Anyone currently reaching
              MyBooks through the tailnet will lose access until you reconnect. You must have
              physical or local-network access to bring Tailscale back up. Continue?
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setShowDisconnect(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={disconnect.isPending}
                onClick={() =>
                  disconnect.mutate(undefined, {
                    onSuccess: () => setShowDisconnect(false),
                  })
                }
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
