// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { TailscaleBackendState } from '@kis-books/shared';
import { Globe, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  useTailscaleServe,
  useTailscaleEnableServe,
  useTailscaleDisableServe,
} from '../../../api/hooks/useTailscale';

export function ServeConfig({ state }: { state: TailscaleBackendState }) {
  const [port, setPort] = useState(5173);
  const { data: serve } = useTailscaleServe();
  const enable = useTailscaleEnableServe();
  const disable = useTailscaleDisableServe();
  const canEdit = state === 'Running';

  const copyUrl = () => {
    if (serve?.serveUrl) navigator.clipboard.writeText(serve.serveUrl).catch(() => undefined);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Globe className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Remote Access (Tailscale Serve)</h2>
      </div>
      <div className="px-6 py-4 space-y-4">
        {!canEdit ? (
          <div className="text-sm text-gray-500">
            Tailscale must be running before you can enable remote access.
          </div>
        ) : serve?.enabled ? (
          <>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Tailnet URL</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono text-gray-900 truncate">
                  {serve.serveUrl ?? '—'}
                </code>
                {serve.serveUrl && (
                  <>
                    <button
                      onClick={copyUrl}
                      className="p-2 rounded hover:bg-gray-100 text-gray-500"
                      title="Copy URL"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={serve.serveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded hover:bg-gray-100 text-gray-500"
                      title="Open"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Proxies HTTPS traffic to the web container on port {serve.targetPort ?? '—'}.
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => disable.mutate()}
                loading={disable.isPending}
              >
                Disable remote access
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-700">
              Enable Tailscale Serve to expose MyBooks over HTTPS at your tailnet hostname (e.g.
              <code className="mx-1 bg-gray-100 px-1 py-0.5 rounded text-xs">
                https://mybooks.&lt;tailnet&gt;.ts.net
              </code>
              ). Local LAN access on the published ports is unchanged.
            </div>
            <div className="max-w-xs">
              <Input
                label="Web container port"
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 5173)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => enable.mutate(port)} loading={enable.isPending}>
                Enable remote access
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
