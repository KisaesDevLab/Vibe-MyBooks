// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Admin dashboard tile — asks the backend whether a newer Vibe
// MyBooks release exists on GitHub. Operators are responsible for the
// actual upgrade (edit .env → VIBE_MYBOOKS_TAG → compose pull + up).
// See updates.service.ts for why we deliberately don't apply updates
// from inside the app container.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Package, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Download } from 'lucide-react';

interface UpdateCheckResult {
  current: string;
  latest: string | null;
  isNewer: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  releaseNotes: string | null;
  checkedAt: number;
  error?: string;
}

function formatChecked(ms: number): string {
  const delta = Date.now() - ms;
  if (!Number.isFinite(delta) || delta < 0) return 'just now';
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export function UpdateCheckCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'updates', 'check'],
    queryFn: () => apiClient<UpdateCheckResult>('/admin/updates/check'),
    // The backend already caches for 5 min; we don't need the browser
    // to refetch in the background. Manual refresh lives on the
    // "Check again" button.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refresh = useMutation({
    mutationFn: () => apiClient<UpdateCheckResult>('/admin/updates/check?force=1'),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['admin', 'updates', 'check'], fresh);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">Checking for updates…</span>
        </div>
      </div>
    );
  }

  // Network / rate-limit path. Render without a version comparison so
  // air-gapped installs see a real explanation rather than "unknown".
  if (data.error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Update check unavailable</h3>
            <p className="text-xs text-gray-600 mt-1">
              Couldn't reach GitHub: <code className="bg-gray-100 px-1 rounded">{data.error}</code>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Running: <span className="font-mono">{data.current}</span>
            </p>
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
              Check again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const Icon = data.isNewer ? Download : CheckCircle2;
  const iconColor = data.isNewer ? 'text-blue-500' : 'text-emerald-500';
  const heading = data.isNewer ? 'Update available' : 'You are up to date';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Bypass the 5-minute cache and re-check GitHub now"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
              Check again
            </button>
          </div>

          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <div>
              Running: <span className="font-mono">{data.current}</span>
            </div>
            {data.latest && (
              <div>
                Latest:{' '}
                <span className="font-mono">{data.latest}</span>
                {data.publishedAt && (
                  <span className="text-gray-400"> • released {new Date(data.publishedAt).toLocaleDateString()}</span>
                )}
              </div>
            )}
            <div className="text-gray-400">Last checked {formatChecked(data.checkedAt)}</div>
          </div>

          {data.isNewer && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-900">How to update</p>
              <ol className="mt-1.5 list-decimal list-inside text-xs text-blue-900 space-y-0.5">
                <li>Take a backup from Settings → Backup &amp; Restore.</li>
                <li>
                  Edit <code className="bg-white px-1 rounded">.env</code> on the host:{' '}
                  <code className="bg-white px-1 rounded">VIBE_MYBOOKS_TAG={data.latest}</code>
                </li>
                <li>
                  Run{' '}
                  <code className="bg-white px-1 rounded">
                    docker compose -f docker-compose.prod.yml pull app &amp;&amp; docker compose -f docker-compose.prod.yml up -d
                  </code>
                </li>
                <li>Watch the logs; confirm /health returns 200.</li>
              </ol>
              {data.releaseUrl && (
                <a
                  href={data.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  View release notes <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {!data.isNewer && data.releaseUrl && (
            <a
              href={data.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              View latest release notes <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
