import { Network } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useTailscaleStatus, useTailscaleHealth } from '../../api/hooks/useTailscale';
import { StatusCard } from './tailscale/StatusCard';
import { PeerList } from './tailscale/PeerList';
import { HealthPanel } from './tailscale/HealthPanel';
import { ServeConfig } from './tailscale/ServeConfig';
import { AuditTable } from './tailscale/AuditTable';
import { FirstRunWizard } from './tailscale/FirstRunWizard';
import { UpdateBanner } from './tailscale/UpdateBanner';

export function TailscaleAdminPage() {
  const statusQuery = useTailscaleStatus();
  const healthQuery = useTailscaleHealth();

  if (statusQuery.isLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  if (statusQuery.error || !statusQuery.data) {
    const msg = (statusQuery.error as Error | undefined)?.message ?? 'Tailscale sidecar unreachable';
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Tailscale</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <div className="font-medium mb-1">Tailscale is not available</div>
          <div className="text-sm">{msg}</div>
          <div className="text-sm mt-2 text-red-700">
            Verify the <code className="bg-red-100 px-1 py-0.5 rounded">tailscale</code> service is
            running:
            <code className="block mt-1 bg-red-100 px-2 py-1 rounded font-mono text-xs">
              docker compose up -d tailscale
            </code>
          </div>
        </div>
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
