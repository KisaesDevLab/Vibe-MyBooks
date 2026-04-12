import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import {
  Cloud, Server, Mail, Eye, EyeOff, CheckCircle, XCircle, Clock,
  RefreshCw, Lock,
} from 'lucide-react';

interface RemoteConfig {
  enabled: boolean;
  destination?: string;
  schedule?: string;
  config?: Record<string, unknown>;
  last_at?: string;
  last_status?: string;
  last_size?: number;
}

interface HistoryEntry {
  timestamp: string;
  status: string;
  size?: number;
  destination?: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function RemoteBackupSettingsPage() {
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [destination, setDestination] = useState<'sftp' | 'webdav' | 'email'>('sftp');
  const [schedule, setSchedule] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [retentionCount, setRetentionCount] = useState(10);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  // SFTP fields
  const [sftpHost, setSftpHost] = useState('');
  const [sftpPort, setSftpPort] = useState('22');
  const [sftpUser, setSftpUser] = useState('');
  const [sftpPassword, setSftpPassword] = useState('');
  const [showSftpPassword, setShowSftpPassword] = useState(false);
  const [sftpPath, setSftpPath] = useState('/backups/');

  // WebDAV fields
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUser, setWebdavUser] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [showWebdavPassword, setShowWebdavPassword] = useState(false);

  // Email fields
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailMaxSize, setEmailMaxSize] = useState(25);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch config
  const { data: config, isLoading, isError, refetch } = useQuery({
    queryKey: ['remote-backup', 'config'],
    queryFn: () => apiClient<RemoteConfig>('/remote-backup/config'),
  });

  // Fetch history
  const { data: historyData } = useQuery({
    queryKey: ['remote-backup', 'history'],
    queryFn: () => apiClient<{ history: HistoryEntry[] }>('/remote-backup/history'),
  });

  // Load config into form
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled || false);
      setDestination((config.destination as 'sftp' | 'webdav' | 'email') || 'sftp');
      setSchedule((config.schedule as 'daily' | 'weekly' | 'monthly') || 'weekly');

      const c = config.config || {};
      if (c['sftp'] && typeof c['sftp'] === 'object') {
        const sftp = c['sftp'] as Record<string, unknown>;
        setSftpHost(String(sftp['host'] || ''));
        setSftpPort(String(sftp['port'] || '22'));
        setSftpUser(String(sftp['username'] || ''));
        setSftpPath(String(sftp['remote_path'] || '/backups/'));
      }
      if (c['webdav'] && typeof c['webdav'] === 'object') {
        const wd = c['webdav'] as Record<string, unknown>;
        setWebdavUrl(String(wd['url'] || ''));
        setWebdavUser(String(wd['username'] || ''));
      }
      if (c['email'] && typeof c['email'] === 'object') {
        const em = c['email'] as Record<string, unknown>;
        setEmailRecipient(String(em['recipient'] || ''));
        setEmailMaxSize(Number(em['max_size_mb'] || 25));
      }
    }
  }, [config]);

  // Save config
  const saveMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        enabled,
        destination,
        schedule,
        retention_count: retentionCount,
      };
      if (passphrase) body['passphrase'] = passphrase;

      if (destination === 'sftp') {
        body['sftp'] = {
          host: sftpHost,
          port: Number(sftpPort),
          username: sftpUser,
          password: sftpPassword || undefined,
          remote_path: sftpPath,
        };
      } else if (destination === 'webdav') {
        body['webdav'] = {
          url: webdavUrl,
          username: webdavUser,
          password: webdavPassword || undefined,
        };
      } else if (destination === 'email') {
        body['email'] = {
          recipient: emailRecipient,
          max_size_mb: emailMaxSize,
        };
      }

      return apiClient('/remote-backup/config', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remote-backup'] });
    },
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { destination };
      if (destination === 'sftp') {
        body['sftp'] = { host: sftpHost, port: Number(sftpPort), username: sftpUser, password: sftpPassword, remote_path: sftpPath };
      } else if (destination === 'webdav') {
        body['webdav'] = { url: webdavUrl, username: webdavUser, password: webdavPassword };
      } else {
        body['email'] = { recipient: emailRecipient, max_size_mb: emailMaxSize };
      }
      return apiClient<{ success: boolean; message: string }>('/remote-backup/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ success: false, message: err.message }),
  });

  // Trigger immediate backup
  const triggerMutation = useMutation({
    mutationFn: () =>
      apiClient('/remote-backup/trigger', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remote-backup'] });
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const history = historyData?.history || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Remote Backups</h1>

      {saveMutation.isSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Configuration saved successfully.
        </div>
      )}
      {saveMutation.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveMutation.error.message}
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary-600" />
          Remote Backup Configuration
        </h2>

        <div className="space-y-4 max-w-lg">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Enable remote backups</span>
              <p className="text-xs text-gray-500">Automatically upload encrypted backups on a schedule</p>
            </div>
          </label>

          {enabled && (
            <>
              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                <div className="flex gap-3">
                  {[
                    { value: 'sftp' as const, icon: Server, label: 'SFTP' },
                    { value: 'webdav' as const, icon: Cloud, label: 'WebDAV' },
                    { value: 'email' as const, icon: Mail, label: 'Email' },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => { setDestination(value); setTestResult(null); }}
                      className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                        destination === value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mx-auto mb-1 ${destination === value ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className={`text-xs font-medium ${destination === value ? 'text-primary-700' : 'text-gray-600'}`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SFTP Config */}
              {destination === 'sftp' && (
                <div className="space-y-3 pl-1">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Host</label>
                      <input type="text" value={sftpHost} onChange={(e) => setSftpHost(e.target.value)}
                        placeholder="backup.example.com"
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                      <input type="number" value={sftpPort} onChange={(e) => setSftpPort(e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                    <input type="text" value={sftpUser} onChange={(e) => setSftpUser(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <div className="relative">
                      <input type={showSftpPassword ? 'text' : 'password'} value={sftpPassword}
                        onChange={(e) => setSftpPassword(e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm" />
                      <button type="button" onClick={() => setShowSftpPassword(!showSftpPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {showSftpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remote Path</label>
                    <input type="text" value={sftpPath} onChange={(e) => setSftpPath(e.target.value)}
                      placeholder="/backups/"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              {/* WebDAV Config */}
              {destination === 'webdav' && (
                <div className="space-y-3 pl-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">WebDAV URL</label>
                    <input type="url" value={webdavUrl} onChange={(e) => setWebdavUrl(e.target.value)}
                      placeholder="https://cloud.example.com/remote.php/dav/files/user/backups/"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                    <input type="text" value={webdavUser} onChange={(e) => setWebdavUser(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <div className="relative">
                      <input type={showWebdavPassword ? 'text' : 'password'} value={webdavPassword}
                        onChange={(e) => setWebdavPassword(e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm" />
                      <button type="button" onClick={() => setShowWebdavPassword(!showWebdavPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {showWebdavPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Config */}
              {destination === 'email' && (
                <div className="space-y-3 pl-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Email</label>
                    <input type="email" value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="backups@example.com"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Attachment Size (MB)</label>
                    <input type="number" value={emailMaxSize} onChange={(e) => setEmailMaxSize(Number(e.target.value))}
                      min={1} max={50}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    <p className="text-xs text-gray-500 mt-0.5">For larger installations, use SFTP or WebDAV.</p>
                  </div>
                </div>
              )}

              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => testMutation.mutate()} loading={testMutation.isPending}>
                  Test Connection
                </Button>
                {testResult && (
                  <span className={`text-sm flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.message}
                  </span>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <select value={schedule} onChange={(e) => setSchedule(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Retention */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keep last {retentionCount} remote backups
                </label>
                <input type="range" min={1} max={50} value={retentionCount}
                  onChange={(e) => setRetentionCount(Number(e.target.value))}
                  className="w-full" />
                <p className="text-xs text-gray-500">Older backups will be deleted from the remote destination.</p>
              </div>

              {/* Backup Passphrase */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Backup Passphrase
                </label>
                <div className="relative">
                  <input type={showPassphrase ? 'text' : 'password'} value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Set passphrase for scheduled backups (min 12 chars)"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm" />
                  <button type="button" onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-amber-600 mt-0.5">
                  If you forget this passphrase, scheduled backups cannot be restored. Store it securely.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Save Configuration
            </Button>
            {enabled && (
              <Button variant="secondary" onClick={() => triggerMutation.mutate()}
                loading={triggerMutation.isPending} disabled={!passphrase || passphrase.length < 12}>
                <RefreshCw className="h-4 w-4 mr-1" /> Backup Now
              </Button>
            )}
          </div>

          {triggerMutation.isSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Remote backup triggered successfully.
            </div>
          )}
          {triggerMutation.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {triggerMutation.error.message}
            </div>
          )}
        </div>
      </div>

      {/* Last Backup Status */}
      {config?.last_at && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Last Remote Backup</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm max-w-md">
            <span className="text-gray-500">Time:</span>
            <span className="text-gray-900">{new Date(config.last_at).toLocaleString()}</span>
            <span className="text-gray-500">Status:</span>
            <span className={config.last_status === 'success' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {config.last_status === 'success' ? 'Success' : 'Failed'}
            </span>
            {config.last_size && (
              <>
                <span className="text-gray-500">Size:</span>
                <span className="text-gray-900">{formatBytes(config.last_size)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Backup History */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Remote Backup History</h2>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{new Date(entry.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      entry.status === 'success'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.status === 'success' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{entry.size ? formatBytes(entry.size) : '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {entry.destination && <span className="capitalize">{entry.destination}</span>}
                    {entry.error && <span className="text-red-600 ml-2">{entry.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
