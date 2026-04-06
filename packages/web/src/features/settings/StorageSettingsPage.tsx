import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { HardDrive, Cloud, CheckCircle, AlertTriangle, RefreshCw, Trash2, Settings } from 'lucide-react';

const PROVIDER_INFO: Record<string, { label: string; icon: any; color: string }> = {
  local: { label: 'Local Disk', icon: HardDrive, color: 'text-gray-600' },
  dropbox: { label: 'Dropbox', icon: Cloud, color: 'text-blue-600' },
  google_drive: { label: 'Google Drive', icon: Cloud, color: 'text-green-600' },
  onedrive: { label: 'OneDrive', icon: Cloud, color: 'text-blue-500' },
  s3: { label: 'S3 Storage', icon: Cloud, color: 'text-orange-500' },
};

const statusBadge = (s: string) => {
  if (s === 'healthy') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Healthy</span>;
  if (s === 'error') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Error</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Unknown</span>;
};

export function StorageSettingsPage() {
  const qc = useQueryClient();
  const [showS3, setShowS3] = useState(false);
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [s3Form, setS3Form] = useState({ bucket: '', region: 'us-east-1', endpoint: '', accessKeyId: '', secretAccessKey: '', prefix: '' });
  const [dropboxForm, setDropboxForm] = useState({ appKey: '', appSecret: '' });
  const [googleForm, setGoogleForm] = useState({ clientId: '', clientSecret: '' });
  const [onedriveForm, setOnedriveForm] = useState({ clientId: '', clientSecret: '', tenantId: 'common' });
  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const { data, isLoading } = useQuery({
    queryKey: ['storage-config'],
    queryFn: async () => (await fetch('/api/v1/settings/storage', { headers })).json(),
  });

  const { data: migrationData } = useQuery({
    queryKey: ['storage-migration'],
    queryFn: async () => (await fetch('/api/v1/settings/storage/migrate/status', { headers })).json(),
    refetchInterval: data?.active?.provider !== 'local' ? 5000 : false,
  });

  const activate = useMutation({
    mutationFn: async (provider: string) => { await fetch('/api/v1/settings/storage/activate', { method: 'POST', headers, body: JSON.stringify({ provider }) }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage'] }),
  });

  const disconnect = useMutation({
    mutationFn: async (provider: string) => { await fetch(`/api/v1/settings/storage/disconnect/${provider}`, { method: 'POST', headers }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage'] }),
  });

  const healthCheck = useMutation({
    mutationFn: async () => (await fetch('/api/v1/settings/storage/health-check', { method: 'POST', headers })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage'] }),
  });

  const saveS3 = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/settings/storage/configure/s3', { method: 'POST', headers, body: JSON.stringify(s3Form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || 'Failed'); }
    },
    onSuccess: () => { setShowS3(false); qc.invalidateQueries({ queryKey: ['storage-config'] }); },
  });

  const configureProvider = useMutation({
    mutationFn: async ({ provider, body }: { provider: string; body: Record<string, string> }) => {
      const res = await fetch(`/api/v1/settings/storage/configure/${provider}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || 'Failed'); }
    },
    onSuccess: () => { setShowConfig(null); qc.invalidateQueries({ queryKey: ['storage-config'] }); },
  });

  const startMigration = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      await fetch('/api/v1/settings/storage/migrate', { method: 'POST', headers, body: JSON.stringify({ fromProvider: from, toProvider: to }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage-migration'] }),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  const active = data?.active || { provider: 'local', healthStatus: 'healthy' };
  const providers = data?.providers || [];
  const available = data?.available || ['local'];
  const providerStatus: Record<string, { configured: boolean; connected: boolean }> = data?.providerStatus || {};
  const migration = migrationData?.status === 'running' ? migrationData : null;
  const activeInfo = PROVIDER_INFO[active.provider] || PROVIDER_INFO['local']!;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">File Storage</h1>
      <p className="text-sm text-gray-500 mb-6">Choose where your uploaded files are stored.</p>

      {/* Active Provider */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6 max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <activeInfo.icon className={`h-8 w-8 ${activeInfo.color}`} />
            <div>
              <p className="font-semibold text-gray-900">{activeInfo.label}</p>
              <p className="text-xs text-gray-500">Active storage provider</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(active.healthStatus || 'unknown')}
            <Button variant="ghost" size="sm" onClick={() => healthCheck.mutate()} loading={healthCheck.isPending}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        {active.healthError && <p className="text-sm text-red-600">{active.healthError}</p>}
      </div>

      {/* Migration Progress */}
      {migration && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl">
          <p className="text-sm font-medium text-blue-800">Migration in progress: {migration.fromProvider} → {migration.toProvider}</p>
          <div className="mt-2 bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 rounded-full h-2 transition-all" style={{ width: `${migration.totalFiles > 0 ? (migration.migratedFiles / migration.totalFiles) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-blue-600 mt-1">{migration.migratedFiles} of {migration.totalFiles} files migrated</p>
        </div>
      )}

      {/* Available Providers */}
      <div className="max-w-2xl space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Available Providers</h2>

        {available.map((prov: string) => {
          const info = PROVIDER_INFO[prov] || { label: prov, icon: Cloud, color: 'text-gray-400' };
          const connected = providers.find((p: any) => p.provider === prov);
          const isActive = active.provider === prov;
          const isOAuth = prov !== 'local' && prov !== 's3';
          const status = providerStatus[prov];
          const isConfigured = status?.configured ?? false;
          const isConnected = status?.connected ?? false;

          return (
            <div key={prov} className={`bg-white rounded-lg border shadow-sm p-4 flex items-center justify-between ${isActive ? 'border-primary-300 ring-1 ring-primary-100' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <info.icon className={`h-6 w-6 ${info.color}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{info.label}</p>
                  <p className="text-xs text-gray-500">
                    {isActive ? 'Active' : isConnected ? 'Connected' : prov === 'local' ? 'Always available' : isConfigured ? 'Credentials saved — ready to connect' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isActive && <CheckCircle className="h-5 w-5 text-primary-600" />}
                {!isActive && isConnected && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => {
                      if (confirm(`Switch to ${info.label}? This may require migrating existing files.`)) activate.mutate(prov);
                    }}>Set Active</Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Disconnect ${info.label}?`)) disconnect.mutate(prov); }}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </>
                )}
                {!isConnected && isOAuth && isConfigured && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setShowConfig(prov)} title="Update credentials">
                      <Settings className="h-4 w-4 text-gray-400" />
                    </Button>
                    <a href={`/api/v1/settings/storage/connect/${prov}`}>
                      <Button size="sm">Connect</Button>
                    </a>
                  </>
                )}
                {!isConnected && isOAuth && !isConfigured && (
                  <Button size="sm" onClick={() => setShowConfig(prov)}>Configure</Button>
                )}
                {!isConnected && prov === 's3' && (
                  <Button size="sm" onClick={() => setShowS3(true)}>Configure</Button>
                )}
                {isActive && prov !== 'local' && (
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Disconnect ${info.label}? You will need to switch to another provider first.`)) disconnect.mutate(prov); }}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* S3 Config Modal */}
      {showS3 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configure S3 Storage</h3>
            <Input label="Bucket" value={s3Form.bucket} onChange={(e) => setS3Form((f) => ({ ...f, bucket: e.target.value }))} placeholder="my-kisbooks-bucket" />
            <Input label="Region" value={s3Form.region} onChange={(e) => setS3Form((f) => ({ ...f, region: e.target.value }))} placeholder="us-east-1" />
            <Input label="Endpoint (optional, for MinIO/R2)" value={s3Form.endpoint} onChange={(e) => setS3Form((f) => ({ ...f, endpoint: e.target.value }))} placeholder="https://s3.example.com" />
            <Input label="Access Key ID" value={s3Form.accessKeyId} onChange={(e) => setS3Form((f) => ({ ...f, accessKeyId: e.target.value }))} />
            <Input label="Secret Access Key" type="password" value={s3Form.secretAccessKey} onChange={(e) => setS3Form((f) => ({ ...f, secretAccessKey: e.target.value }))} />
            <Input label="Path Prefix (optional)" value={s3Form.prefix} onChange={(e) => setS3Form((f) => ({ ...f, prefix: e.target.value }))} placeholder="kisbooks/" />
            {saveS3.error && <p className="text-sm text-red-600">{(saveS3.error as any).message}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowS3(false)}>Cancel</Button>
              <Button onClick={() => saveS3.mutate()} loading={saveS3.isPending}>Save & Connect</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dropbox Config Modal */}
      {showConfig === 'dropbox' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configure Dropbox</h3>
            <p className="text-xs text-gray-500">
              Create an app at <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">dropbox.com/developers/apps</a> with
              "Full Dropbox" access. Set the redirect URI to: <code className="text-xs bg-gray-100 px-1 rounded">{window.location.origin}/api/v1/settings/storage/callback/dropbox</code>
            </p>
            <Input label="App Key" value={dropboxForm.appKey} onChange={(e) => setDropboxForm((f) => ({ ...f, appKey: e.target.value }))} placeholder="Enter your Dropbox App Key" />
            <Input label="App Secret" type="password" value={dropboxForm.appSecret} onChange={(e) => setDropboxForm((f) => ({ ...f, appSecret: e.target.value }))} placeholder="Enter your Dropbox App Secret" />
            {configureProvider.error && showConfig === 'dropbox' && <p className="text-sm text-red-600">{(configureProvider.error as any).message}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowConfig(null)}>Cancel</Button>
              <Button onClick={() => configureProvider.mutate({ provider: 'dropbox', body: dropboxForm })}
                loading={configureProvider.isPending} disabled={!dropboxForm.appKey || !dropboxForm.appSecret}>
                Save Credentials
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Config Modal */}
      {showConfig === 'google_drive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configure Google Drive</h3>
            <p className="text-xs text-gray-500">
              Create OAuth credentials in <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">Google Cloud Console</a>.
              Enable the Google Drive API and set the redirect URI to: <code className="text-xs bg-gray-100 px-1 rounded">{window.location.origin}/api/v1/settings/storage/callback/google_drive</code>
            </p>
            <Input label="Client ID" value={googleForm.clientId} onChange={(e) => setGoogleForm((f) => ({ ...f, clientId: e.target.value }))} placeholder="Enter your Google Client ID" />
            <Input label="Client Secret" type="password" value={googleForm.clientSecret} onChange={(e) => setGoogleForm((f) => ({ ...f, clientSecret: e.target.value }))} placeholder="Enter your Google Client Secret" />
            {configureProvider.error && showConfig === 'google_drive' && <p className="text-sm text-red-600">{(configureProvider.error as any).message}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowConfig(null)}>Cancel</Button>
              <Button onClick={() => configureProvider.mutate({ provider: 'google_drive', body: googleForm })}
                loading={configureProvider.isPending} disabled={!googleForm.clientId || !googleForm.clientSecret}>
                Save Credentials
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OneDrive Config Modal */}
      {showConfig === 'onedrive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configure OneDrive</h3>
            <p className="text-xs text-gray-500">
              Register an app at <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">Azure Portal</a>.
              Add "Files.ReadWrite" and "User.Read" delegated permissions. Set the redirect URI to: <code className="text-xs bg-gray-100 px-1 rounded">{window.location.origin}/api/v1/settings/storage/callback/onedrive</code>
            </p>
            <Input label="Application (Client) ID" value={onedriveForm.clientId} onChange={(e) => setOnedriveForm((f) => ({ ...f, clientId: e.target.value }))} placeholder="Enter your Microsoft Client ID" />
            <Input label="Client Secret" type="password" value={onedriveForm.clientSecret} onChange={(e) => setOnedriveForm((f) => ({ ...f, clientSecret: e.target.value }))} placeholder="Enter your Microsoft Client Secret" />
            <Input label="Tenant ID" value={onedriveForm.tenantId} onChange={(e) => setOnedriveForm((f) => ({ ...f, tenantId: e.target.value }))} placeholder="common" />
            <p className="text-xs text-gray-500">Use "common" for multi-tenant or a specific tenant ID for one organization.</p>
            {configureProvider.error && showConfig === 'onedrive' && <p className="text-sm text-red-600">{(configureProvider.error as any).message}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowConfig(null)}>Cancel</Button>
              <Button onClick={() => configureProvider.mutate({ provider: 'onedrive', body: onedriveForm })}
                loading={configureProvider.isPending} disabled={!onedriveForm.clientId || !onedriveForm.clientSecret}>
                Save Credentials
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
