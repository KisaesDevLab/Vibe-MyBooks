import { useState, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Download, Trash2, Upload, ShieldAlert } from 'lucide-react';

interface BackupEntry {
  fileName: string;
  size: number;
  createdAt: string;
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

export function BackupRestorePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch backup history
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['backup', 'history'],
    queryFn: () => apiClient<{ data: BackupEntry[] }>('/backup/history'),
  });

  // Create backup
  const createBackup = useMutation({
    mutationFn: () => apiClient('/backup/create', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'history'] });
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

  // Restore from backup
  const restoreBackup = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAccessToken();
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
    const token = getAccessToken();
    const link = document.createElement('a');
    link.href = `/api/v1/backup/download/${encodeURIComponent(fileName)}`;
    if (token) {
      // For auth, open in new window which will use cookie/session, or use fetch+blob
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

  const handleRestore = () => {
    if (!selectedFile || confirmText !== 'RESTORE') return;
    restoreBackup.mutate(selectedFile);
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

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

      {/* Create Backup */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Create Backup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a full backup of your bookkeeping data. Backups include all transactions, accounts, contacts, and settings.
        </p>
        <Button onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
          <Download className="h-4 w-4 mr-1" /> Create Backup Now
        </Button>
      </div>

      {/* Backup History */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Backup History</h2>
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
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteBackup.mutate(entry.fileName)}
                        loading={deleteBackup.isPending}
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
