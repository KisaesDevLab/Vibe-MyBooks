import { useState, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Download, Trash2, Upload, ShieldAlert, Lock, Eye, EyeOff } from 'lucide-react';

interface BackupEntry {
  fileName: string;
  size: number;
  createdAt: string;
  format: 'portable' | 'legacy';
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

type Strength = 'weak' | 'fair' | 'strong' | 'very_strong';

function getStrengthColor(strength: Strength): string {
  switch (strength) {
    case 'weak': return 'bg-red-500';
    case 'fair': return 'bg-yellow-500';
    case 'strong': return 'bg-green-500';
    case 'very_strong': return 'bg-emerald-600';
  }
}

function getStrengthWidth(strength: Strength): string {
  switch (strength) {
    case 'weak': return 'w-1/4';
    case 'fair': return 'w-2/4';
    case 'strong': return 'w-3/4';
    case 'very_strong': return 'w-full';
  }
}

function getStrengthLabel(strength: Strength): string {
  return strength.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function PassphraseStrengthMeter({ passphrase }: { passphrase: string }) {
  if (!passphrase) return null;

  let score = 0;
  if (passphrase.length >= 12) score += 1;
  if (passphrase.length >= 16) score += 1;
  if (passphrase.length >= 24) score += 1;
  if (passphrase.length >= 32) score += 1;
  if (/[a-z]/.test(passphrase)) score += 1;
  if (/[A-Z]/.test(passphrase)) score += 1;
  if (/[0-9]/.test(passphrase)) score += 1;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;

  let strength: Strength;
  if (passphrase.length < 12) strength = 'weak';
  else if (score <= 3) strength = 'fair';
  else if (score <= 5) strength = 'strong';
  else strength = 'very_strong';

  return (
    <div className="mt-1">
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${getStrengthColor(strength)} ${getStrengthWidth(strength)}`} />
      </div>
      <p className={`text-xs mt-0.5 ${strength === 'weak' ? 'text-red-600' : 'text-gray-500'}`}>
        {getStrengthLabel(strength)}
        {strength === 'weak' && ' — minimum 12 characters required'}
      </p>
    </div>
  );
}

export function BackupRestorePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePassphrase, setShowRestorePassphrase] = useState(false);
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
    mutationFn: () =>
      apiClient('/backup/create', {
        method: 'POST',
        body: JSON.stringify({ passphrase }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'history'] });
      setSuccessMsg('Backup created successfully');
      setPassphrase('');
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
      if (restorePassphrase) {
        formData.append('passphrase', restorePassphrase);
      }

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
    onSuccess: (result) => {
      const recommendation = result.recommendation
        ? `\n\n${result.recommendation}`
        : '';
      setSuccessMsg(`Backup validated (${result.method} encryption).${recommendation}`);
      setSelectedFile(null);
      setConfirmText('');
      setRestorePassphrase('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSuccessMsg(''), 10000);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setConfirmText('');
  };

  const handleDownload = (fileName: string) => {
    const token = getAccessToken();
    fetch(`/api/v1/backup/download/${encodeURIComponent(fileName)}`, {
      headers: { Authorization: `Bearer ${token || ''}` },
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
  };

  const handleRestore = () => {
    if (!selectedFile || confirmText !== 'RESTORE') return;
    restoreBackup.mutate(selectedFile);
  };

  const canCreateBackup = passphrase.length >= 12;

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Backup & Restore</h1>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 whitespace-pre-line">
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
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary-600" />
          Create Encrypted Backup
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a passphrase-encrypted backup of your bookkeeping data. The backup file (.vmb) is portable
          and can be restored on any Vibe MyBooks installation.
        </p>

        <div className="max-w-md space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backup Passphrase</label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase (min 12 chars)"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PassphraseStrengthMeter passphrase={passphrase} />
          </div>
          <p className="text-xs text-amber-600">
            You will need this passphrase to restore the backup. There is no way to recover it if forgotten.
          </p>
        </div>

        <Button
          onClick={() => createBackup.mutate()}
          loading={createBackup.isPending}
          disabled={!canCreateBackup}
        >
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Format</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((entry) => (
                <tr key={entry.fileName} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900 font-mono">{entry.fileName}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatBytes(entry.size)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatDate(entry.createdAt)}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      entry.format === 'portable'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {entry.format === 'portable' ? 'Portable' : 'Legacy'}
                    </span>
                  </td>
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
          Upload a backup file (.kbk or .vmb) to validate and restore. Both passphrase-encrypted
          and legacy server-key encrypted backups are supported.
        </p>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Backup File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".kbk,.vmb"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>

          {selectedFile && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passphrase (for .vmb files)
                </label>
                <div className="relative">
                  <input
                    type={showRestorePassphrase ? 'text' : 'password'}
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Enter backup passphrase"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestorePassphrase(!showRestorePassphrase)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showRestorePassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Leave empty for legacy .kbk files (uses server key).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-bold text-red-600">RESTORE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESTORE"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </>
          )}

          <Button
            variant="danger"
            onClick={handleRestore}
            loading={restoreBackup.isPending}
            disabled={!selectedFile || confirmText !== 'RESTORE'}
          >
            <Upload className="h-4 w-4 mr-1" /> Validate & Restore
          </Button>
        </div>
      </div>
    </div>
  );
}
