import { useState, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Download, Trash2, Upload, ShieldAlert, CloudUpload, Cloud } from 'lucide-react';

interface BackupEntry {
  fileName: string;
  size: number;
  createdAt: string;
}

interface RemoteBackupEntry {
  key: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  tenantId: string;
  tiers: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const TIER_COLORS: Record<string, string> = {
  daily: 'bg-gray-100 text-gray-600',
  weekly: 'bg-blue-100 text-blue-700',
  monthly: 'bg-green-100 text-green-700',
  yearly: 'bg-amber-100 text-amber-700',
};

export function BackupRestorePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const token = getAccessToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Fetch backup history
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['backup', 'history'],
    queryFn: () => apiClient<{ data: BackupEntry[] }>('/backup/history'),
  });

  // Fetch remote backup history
  const { data: remoteData, isLoading: remoteLoading } = useQuery({
    queryKey: ['backup', 'remote', 'history'],
    queryFn: async () => {
      const res = await fetch('/api/v1/backup/remote/history', { headers: authHeaders as any });
      if (!res.ok) return { backups: [] };
      return res.json() as Promise<{ backups: RemoteBackupEntry[] }>;
    },
  });

  // Create backup
  const createBackup = useMutation({
    mutationFn: () => apiClient('/backup/create', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup'] });
      setSuccessMsg('Backup created successfully');
      setTimeout(() => setSuccessMsg(''), 5000);
    },
  });

  // Delete backup
  const deleteBackup = useMutation({
    mutationFn: (fileName: string) =>
      apiClient(`/backup/${encodeURIComponent(fileName)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'history'] });
    },
  });

  // Push to remote
  const pushToRemote = useMutation({
    mutationFn: async (fileName: string) => {
      const res = await fetch(`/api/v1/backup/remote/upload/${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: authHeaders as any,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || 'Upload failed'); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'remote'] });
      setSuccessMsg('Backup pushed to remote storage');
      setTimeout(() => setSuccessMsg(''), 5000);
    },
  });

  // Delete remote backup
  const deleteRemoteBackup = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/v1/backup/remote/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: authHeaders as any,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || 'Delete failed'); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'remote'] });
    },
  });

  // Restore from backup
  const restoreBackup = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/backup/restore', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Restore failed' } }));
        throw new Error(err.error?.message || 'Restore failed');
      }

      return res.json();
    },
    onSuccess: () => {
      setSuccessMsg('Restore completed successfully. You may need to refresh the page.');
      setSelectedFile(null);
      setConfirmText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSuccessMsg(''), 8000);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setConfirmText('');
  };

  const handleDownload = (fileName: string) => {
    if (token) {
      fetch(`/api/v1/backup/download/${encodeURIComponent(fileName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        });
    }
  };

  const handleRemoteDownload = (key: string, fileName: string) => {
    if (token) {
      fetch(`/api/v1/backup/remote/download/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        });
    }
  };

  const handleRestore = () => {
    if (!selectedFile || confirmText !== 'RESTORE') return;
    restoreBackup.mutate(selectedFile);
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const remoteBackups = remoteData?.backups || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Backup & Restore</h1>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {createBackup.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {createBackup.error.message}
        </div>
      )}
      {restoreBackup.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {restoreBackup.error.message}
        </div>
      )}
      {pushToRemote.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(pushToRemote.error as any).message}
        </div>
      )}

      {/* Create Backup */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Create Backup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a full backup of your bookkeeping data. Backups include all transactions, accounts, contacts, and settings.
          If a remote storage provider is configured, the backup will also be uploaded automatically.
        </p>
        <Button onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
          <Download className="h-4 w-4 mr-1" /> Create Backup Now
        </Button>
      </div>

      {/* Backup History */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Local Backup History</h2>
        {data?.data && data.data.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((entry) => (
                <tr key={entry.fileName} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900 font-mono">{entry.fileName}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatBytes(entry.size)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatDate(entry.createdAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownload(entry.fileName)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => pushToRemote.mutate(entry.fileName)}
                        loading={pushToRemote.isPending}
                        title="Push to remote storage"
                      >
                        <CloudUpload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteBackup.mutate(entry.fileName)}
                        loading={deleteBackup.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No backups found. Create your first backup above.</p>
        )}
      </div>

      {/* Remote Backup History */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          Remote Backups
        </h2>
        {remoteLoading ? (
          <LoadingSpinner className="py-4" />
        ) : remoteBackups.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tiers</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {remoteBackups.map((entry) => (
                <tr key={entry.key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900 font-mono">{entry.fileName}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatBytes(entry.size)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {entry.tiers.map((tier) => (
                        <span key={tier} className={`text-xs px-1.5 py-0.5 rounded-full ${TIER_COLORS[tier] || 'bg-gray-100 text-gray-500'}`}>
                          {tier}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatDate(entry.uploadedAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRemoteDownload(entry.key, entry.fileName)}
                        title="Download from remote"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => { if (confirm('Delete this remote backup?')) deleteRemoteBackup.mutate(entry.key); }}
                        loading={deleteRemoteBackup.isPending}
                        title="Delete from remote"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-gray-500">
            <p>No remote backups found.</p>
            <p className="mt-1 text-xs">
              Configure a remote storage provider in <a href="/admin/system" className="text-primary-600 underline">System Settings</a> to enable disaster recovery backups.
            </p>
          </div>
        )}
      </div>

      {/* Restore from Backup */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Restore from Backup
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Restoring from a backup will replace all current data. This action cannot be undone.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Backup File (.kbk)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".kbk"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>

          {selectedFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-bold text-red-600">RESTORE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type RESTORE"
                className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          <Button
            variant="danger"
            onClick={handleRestore}
            loading={restoreBackup.isPending}
            disabled={!selectedFile || confirmText !== 'RESTORE'}
          >
            <Upload className="h-4 w-4 mr-1" /> Restore
          </Button>
        </div>
      </div>
    </div>
  );
}
