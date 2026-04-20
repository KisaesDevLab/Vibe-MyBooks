// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, type ChangeEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  Upload, FileArchive, Eye, EyeOff, CheckCircle, AlertTriangle,
  ArrowRight, Building2, Users,
} from 'lucide-react';

interface ImportPreview {
  company_name: string;
  source_version: string;
  export_date: string;
  date_range?: { from: string; to: string };
  counts: Record<string, number>;
  file_size: number;
  validation_token: string;
}

interface ImportResult {
  company_name: string;
  tenant_id: string;
  counts: Record<string, number>;
  warnings: string[];
  duplicate_flags: number;
}

interface MergePreview {
  contacts: { merge: number; create: number };
  accounts: { match: number; create: number };
  transactions: { import: number; potentialDuplicates: number };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function TenantImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<'new' | 'merge'>('new');
  const [companyName, setCompanyName] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Validate / preview
  const validateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('passphrase', passphrase);

      const token = getAccessToken();
      const res = await fetch('/api/v1/tenant-export/import/validate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Validation failed' } }));
        throw new Error(err.error?.message || 'Validation failed');
      }

      return res.json() as Promise<ImportPreview>;
    },
    onSuccess: (result) => {
      setPreview(result);
      setCompanyName(result.company_name);
    },
  });

  // Import
  const importMutation = useMutation({
    mutationFn: () =>
      apiClient<ImportResult>('/tenant-export/import', {
        method: 'POST',
        body: JSON.stringify({
          validation_token: preview!.validation_token,
          mode: importMode,
          company_name: companyName,
          assign_users: [], // Current user auto-assigned server-side
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (result) => {
      setImportResult(result);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setImportResult(null);
  };

  const handleValidate = () => {
    if (!selectedFile || !passphrase) return;
    validateMutation.mutate(selectedFile);
  };

  // Import complete — show results
  if (importResult) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Complete</h1>

        <div className="bg-white rounded-lg border border-green-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              Company "{importResult.company_name}" imported successfully
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4 max-w-md">
            {Object.entries(importResult.counts).filter(([, v]) => v > 0).map(([key, value]) => (
              <><span key={key} className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="text-gray-900">{value.toLocaleString()}</span></>
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

          {importResult.duplicate_flags > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              {importResult.duplicate_flags} potential duplicate transactions were flagged.
              Review them in the Duplicate Review page.
            </div>
          )}

          <div className="mt-6">
            <Button onClick={() => { window.location.href = import.meta.env.BASE_URL; }}>
              <ArrowRight className="h-4 w-4 mr-1" /> Go to Dashboard
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
        Upload a .vmx export file from another Vibe MyBooks installation to import the data
        as a new company or merge into an existing one.
      </p>

      {validateMutation.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {validateMutation.error.message}
        </div>
      )}
      {importMutation.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {importMutation.error.message}
        </div>
      )}

      {/* Step 1: Upload and Decrypt */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary-600" />
          Step 1: Upload & Decrypt
        </h2>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Export File (.vmx)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vmx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>

          {selectedFile && (
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
          )}

          <Button
            onClick={handleValidate}
            loading={validateMutation.isPending}
            disabled={!selectedFile || !passphrase}
          >
            <FileArchive className="h-4 w-4 mr-1" /> Decrypt & Preview
          </Button>
        </div>
      </div>

      {/* Step 2: Preview */}
      {preview && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Step 2: Review & Import
          </h2>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Export Details</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm max-w-md">
              <span className="text-gray-500">Company:</span>
              <span className="text-gray-900 font-medium">{preview.company_name}</span>
              <span className="text-gray-500">Source Version:</span>
              <span className="text-gray-900">{preview.source_version}</span>
              <span className="text-gray-500">Export Date:</span>
              <span className="text-gray-900">{new Date(preview.export_date).toLocaleDateString()}</span>
              {preview.date_range && (
                <>
                  <span className="text-gray-500">Date Range:</span>
                  <span className="text-gray-900">{preview.date_range.from} to {preview.date_range.to}</span>
                </>
              )}
              <span className="text-gray-500">File Size:</span>
              <span className="text-gray-900">{formatBytes(preview.file_size)}</span>
            </div>

            <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-2">Record Counts</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm max-w-md">
              {Object.entries(preview.counts).filter(([, v]) => v > 0).map(([key, value]) => (
                <><span key={key} className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                <span className="text-gray-900">{value.toLocaleString()}</span></>
              ))}
            </div>
          </div>

          {/* Import Mode */}
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Mode</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={importMode === 'new'}
                    onChange={() => setImportMode('new')}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Building2 className="h-4 w-4" /> Import as new company
                    </span>
                    <p className="text-xs text-gray-500">Creates a separate company with all the exported data</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Users className="h-4 w-4" /> Merge into existing company
                    </span>
                    <p className="text-xs text-gray-500">
                      Adds data to an existing company. Contacts and accounts are matched; duplicates flagged.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {importMode === 'new' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <Button
              onClick={() => importMutation.mutate()}
              loading={importMutation.isPending}
              disabled={importMode === 'new' && !companyName}
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              {importMode === 'new' ? 'Import as New Company' : 'Merge into Company'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
