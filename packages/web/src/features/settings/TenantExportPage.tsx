import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Download, FileArchive, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

type Strength = 'weak' | 'fair' | 'strong' | 'very_strong';

function getStrength(passphrase: string): Strength {
  if (passphrase.length < 12) return 'weak';
  let score = 0;
  if (passphrase.length >= 12) score++;
  if (passphrase.length >= 16) score++;
  if (passphrase.length >= 24) score++;
  if (passphrase.length >= 32) score++;
  if (/[a-z]/.test(passphrase)) score++;
  if (/[A-Z]/.test(passphrase)) score++;
  if (/[0-9]/.test(passphrase)) score++;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score++;
  if (score <= 3) return 'fair';
  if (score <= 5) return 'strong';
  return 'very_strong';
}

function StrengthMeter({ passphrase }: { passphrase: string }) {
  if (!passphrase) return null;
  const strength = getStrength(passphrase);
  const colors: Record<Strength, string> = {
    weak: 'bg-red-500', fair: 'bg-yellow-500', strong: 'bg-green-500', very_strong: 'bg-emerald-600',
  };
  const widths: Record<Strength, string> = {
    weak: 'w-1/4', fair: 'w-2/4', strong: 'w-3/4', very_strong: 'w-full',
  };
  const labels: Record<Strength, string> = {
    weak: 'Weak', fair: 'Fair', strong: 'Strong', very_strong: 'Very Strong',
  };
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[strength]} ${widths[strength]}`} />
      </div>
      <p className={`text-xs mt-0.5 ${strength === 'weak' ? 'text-red-600' : 'text-gray-500'}`}>
        {labels[strength]}{strength === 'weak' && ' — minimum 12 characters required'}
      </p>
    </div>
  );
}

interface ExportResult {
  fileName: string;
  size: number;
  counts: Record<string, number>;
}

export function TenantExportPage() {
  const [exportType, setExportType] = useState<'full' | 'date_range'>('full');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(true);
  const [includeBankRules, setIncludeBankRules] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const exportMutation = useMutation({
    mutationFn: () =>
      apiClient<ExportResult>('/tenant-export', {
        method: 'POST',
        body: JSON.stringify({
          passphrase,
          date_range: exportType === 'date_range' ? { from: dateFrom, to: dateTo } : undefined,
          include_attachments: includeAttachments,
          include_audit: includeAudit,
          include_bank_rules: includeBankRules,
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (result) => {
      setExportResult(result);
    },
  });

  const handleDownload = () => {
    if (!exportResult) return;
    const token = getAccessToken();
    fetch(`/api/v1/tenant-export/download/${encodeURIComponent(exportResult.fileName)}`, {
      headers: { Authorization: `Bearer ${token || ''}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportResult.fileName;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const canExport =
    passphrase.length >= 12 &&
    passphrase === confirmPassphrase &&
    (exportType === 'full' || (dateFrom && dateTo));

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Export Company Data</h1>
      <p className="text-sm text-gray-500 mb-6">
        Export your company data as an encrypted .vmx file. This file can be imported into any
        Vibe MyBooks installation — perfect for sending data to your accountant.
      </p>

      {exportMutation.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {exportMutation.error.message}
        </div>
      )}

      {/* Export Result */}
      {exportResult && (
        <div className="bg-white rounded-lg border border-green-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Export Complete</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4 max-w-md">
            <span className="text-gray-500">File:</span>
            <span className="font-mono text-gray-900">{exportResult.fileName}</span>
            <span className="text-gray-500">Size:</span>
            <span className="text-gray-900">{formatBytes(exportResult.size)}</span>
            {Object.entries(exportResult.counts || {}).map(([key, value]) => (
              <><span key={key} className="text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
              <span className="text-gray-900">{value.toLocaleString()}</span></>
            ))}
          </div>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" /> Download .vmx File
          </Button>
          <p className="text-xs text-gray-500 mt-3">
            Send this file to your accountant. They will need the passphrase to import it.
          </p>
        </div>
      )}

      {/* Export Form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileArchive className="h-5 w-5 text-primary-600" />
          Export Options
        </h2>

        <div className="space-y-5 max-w-lg">
          {/* Export type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Export Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={exportType === 'full'}
                  onChange={() => setExportType('full')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Full company export</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={exportType === 'date_range'}
                  onChange={() => setExportType('date_range')}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Date range</span>
              </label>
            </div>
          </div>

          {/* Date range */}
          {exportType === 'date_range' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
          {exportType === 'date_range' && (
            <p className="text-xs text-gray-500 -mt-3">
              Contacts, accounts, and settings are always included. Only transactions are filtered by date.
            </p>
          )}

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Include attachments (receipts, documents)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAudit}
                onChange={(e) => setIncludeAudit(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Include audit trail</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBankRules}
                onChange={(e) => setIncludeBankRules(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Include bank rules & categorization history</span>
            </label>
          </div>

          {/* Passphrase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Encryption Passphrase
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase (min 12 chars)"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <StrengthMeter passphrase={passphrase} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Passphrase</label>
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Re-enter passphrase"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {confirmPassphrase && passphrase !== confirmPassphrase && (
              <p className="text-xs text-red-600 mt-0.5">Passphrases do not match</p>
            )}
          </div>

          <p className="text-xs text-amber-600">
            You will need this passphrase to import the data. There is no way to recover it if forgotten.
          </p>

          <Button
            onClick={() => exportMutation.mutate()}
            loading={exportMutation.isPending}
            disabled={!canExport}
          >
            <FileArchive className="h-4 w-4 mr-1" /> Export Company Data
          </Button>
        </div>
      </div>
    </div>
  );
}
