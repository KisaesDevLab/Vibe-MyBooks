// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Network, AlertTriangle, RefreshCw, KeyRound } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useTailscaleStatus, useTailscaleHealth } from '../../api/hooks/useTailscale';
import { StatusCard } from './tailscale/StatusCard';
import { PeerList } from './tailscale/PeerList';
import { HealthPanel } from './tailscale/HealthPanel';
import { ServeConfig } from './tailscale/ServeConfig';
import { AuditTable } from './tailscale/AuditTable';
import { FirstRunWizard } from './tailscale/FirstRunWizard';
import { UpdateBanner } from './tailscale/UpdateBanner';
import { AuthKeyPairForm } from './tailscale/AuthKeyPairForm';

type FailureKind = 'forbidden' | 'sidecar' | 'network' | 'other';

function classifyError(message: string): FailureKind {
  const lower = message.toLowerCase();
  if (lower.includes('super admin') || lower.includes('forbidden') || lower.includes('access required')) {
    return 'forbidden';
  }
  if (
    lower.includes('tailscale sidecar') ||
    lower.includes('tailscale daemon') ||
    lower.includes('socket') ||
    lower.includes('tailscale_unavailable')
  ) {
    return 'sidecar';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'network';
  }
  return 'other';
}

export function TailscaleAdminPage() {
  const statusQuery = useTailscaleStatus();
  const healthQuery = useTailscaleHealth();

  if (statusQuery.isLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  if (statusQuery.error || !statusQuery.data) {
    const message =
      (statusQuery.error as Error | undefined)?.message ?? 'Tailscale sidecar unreachable';
    const kind = classifyError(message);

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Tailscale Remote Access</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Tailscale status unavailable</div>
                <div className="text-sm mt-1 text-red-800 break-words">{message}</div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => statusQuery.refetch()}
              loading={statusQuery.isFetching}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </div>

          {kind === 'forbidden' && (
            <div className="mt-4 text-sm text-red-800 border-t border-red-200 pt-3">
              Your account does not have super-admin access. Ask the appliance owner to grant
              <code className="mx-1 bg-red-100 px-1 py-0.5 rounded">is_super_admin</code>
              on your user record, then sign out and back in.
            </div>
          )}

          {kind === 'network' && (
            <div className="mt-4 text-sm text-red-800 border-t border-red-200 pt-3">
              The browser could not reach the API server. Check that the
              <code className="mx-1 bg-red-100 px-1 py-0.5 rounded">api</code>
              container is healthy
              (<code className="bg-red-100 px-1 py-0.5 rounded">docker compose ps</code>),
              then click <strong>Retry</strong> above.
            </div>
          )}

          {(kind === 'sidecar' || kind === 'other') && (
            <div className="mt-4 text-sm text-red-800 border-t border-red-200 pt-3 space-y-2">
              <p>
                The API container could not read the Tailscale daemon socket. The most common
                causes are: the
                <code className="mx-1 bg-red-100 px-1 py-0.5 rounded">tailscale</code>
                service is stopped, the
                <code className="mx-1 bg-red-100 px-1 py-0.5 rounded">ts-socket</code>
                volume isn&apos;t mounted on the API service, or the daemon is mid-restart.
              </p>
              <p>Bring it up from the host shell, then retry above:</p>
              <code className="block bg-red-100 px-2 py-1 rounded font-mono text-xs">
                docker compose up -d tailscale
              </code>
            </div>
          )}
        </div>

        {kind !== 'forbidden' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Try Pairing Anyway
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm text-gray-700">
              <p>
                If the daemon just finished restarting, the status read may have raced its
                startup. You can still attempt to pair from here — the connect call will
                surface the real error if the socket is genuinely down.
              </p>
              <p>
                Generate a reusable auth key at{' '}
                <a
                  href="https://login.tailscale.com/admin/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  login.tailscale.com
                </a>{' '}
                and paste it below, or request a one-time browser auth URL.
              </p>
              <AuthKeyPairForm allowNoKey />
            </div>
          </div>
        )}
      </div>
    );
  }

  const status = statusQuery.data;
  const needsPairing =
    status.state === 'NeedsLogin' || status.state === 'NeedsMachineAuth' || status.state === 'NoState';

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Tailscale Remote Access</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Manage the tailnet node, remote HTTPS access, and audit trail for this appliance.
        </p>
      </div>

      <UpdateBanner />

      <StatusCard status={status} />

      {needsPairing && <FirstRunWizard status={status} />}

      {healthQuery.data && <HealthPanel health={healthQuery.data} />}

      <ServeConfig state={status.state} />

      <PeerList peers={status.peers} />

      <AuditTable />
    </div>
  );
}
