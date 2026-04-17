// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Download, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { useTailscaleUpdateCheck } from '../../../api/hooks/useTailscale';

export function UpdateBanner() {
  const { data, isLoading, refresh } = useTailscaleUpdateCheck();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading || !data) return null;
  if (!data.updateAvailable) return null;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(data.upgradeCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked in some contexts — no-op
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-amber-900">
              <span className="font-semibold">Tailscale v{data.latest}</span> is available
              {data.current && (
                <span className="text-amber-800"> (you're on v{data.current})</span>
              )}
              .
            </div>
            <div className="flex items-center gap-2">
              {data.releaseUrl && (
                <a
                  href={data.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-900 hover:underline"
                >
                  Release notes <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-900 disabled:opacity-50"
                title="Re-check"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                Re-check
              </button>
            </div>
          </div>
          <p className="text-xs text-amber-800 mt-2">
            Run this on the host to upgrade the Tailscale sidecar. The named state volume is
            preserved — your tailnet IP, hostname, and Serve config will survive.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-amber-200 rounded px-3 py-2 font-mono text-gray-900 overflow-x-auto whitespace-nowrap">
              {data.upgradeCommand}
            </code>
            <button
              onClick={copyCommand}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
              title="Copy command"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
