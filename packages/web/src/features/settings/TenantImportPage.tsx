// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Upload, FileArchive, Eye, EyeOff, CheckCircle, AlertTriangle, ArrowRight, Building2 } from 'lucide-react';

interface ImportResult {
  company_name: string;
  tenant_id: string;
  counts: Record<string, number>;
  warnings: string[];
  duplicate_flags: number;
}

export function TenantImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Single-phase: one call uploads the file, decrypts, and imports it as a new
  // company. The server sniffs the format (v2 streamed package or legacy v1)
  // and streams attachments in during the import.
  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('file', selectedFile!);
      formData.append('passphrase', passphrase);
      formData.append('mode', 'new');
      if (companyName.trim()) formData.append('company_name', companyName.trim());

      const token = getAccessToken();
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/tenant-export/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Import failed' } }));
        throw new Error(err.error?.message || 'Import failed');
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => setImportResult(result),
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setImportResult(null);
    // Default the new company name to the file's base name (sans extension).
    if (file && !companyName) {
      setCompanyName(file.name.replace(/\.vmx$/i, '').replace(/[-_]/g, ' ').replace(/\bexport\b.*$/i, '').trim());
    }
  };

  const canImport = !!selectedFile && passphrase.length > 0;

  // Import complete — show results.
  if (importResult) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Complete</h1>
        <div className="bg-white rounded-lg border border-green-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              Company “{importResult.company_name}” imported successfully
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4 max-w-md">
            {Object.entries(importResult.counts).filter(([, v]) => v > 0).map(([key, value]) => (
              <div key={key} className="contents">
                <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                <span className="text-gray-900">{value.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {importResult.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {importResult.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600">{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button onClick={() => { window.location.href = import.meta.env.BASE_URL; }}>
              <ArrowRight className="h-4 w-4 mr-1" /> Go to Dashboard
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setImportResult(null); setSelectedFile(null); setPassphrase(''); setCompanyName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            >
              Import Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Client Data</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload a <span className="font-mono">.vmx</span> export file from another Vibe MyBooks installation to import
        it as a new company. Everything is decrypted and imported in one step.
      </p>

      {importMutation.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {importMutation.error.message}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary-600" />
          Import an export
        </h2>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export file (.vmx)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vmx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>

          {selectedFile && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passphrase</label>
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter the export passphrase"
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> New company name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Imported Company"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          )}

          <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending} disabled={!canImport}>
            <FileArchive className="h-4 w-4 mr-1" /> Decrypt & Import
          </Button>
        </div>
      </div>
    </div>
  );
}
