// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Key, Plus, Trash2, Copy, CheckCircle, Shield } from 'lucide-react';

const SCOPES = [
  { key: 'all', label: 'Full Access', desc: 'Everything the user can do' },
  { key: 'read', label: 'Read Only', desc: 'View data, run reports' },
  { key: 'write', label: 'Write', desc: 'Create and update transactions' },
  { key: 'reports', label: 'Reports Only', desc: 'Run financial reports' },
  { key: 'banking', label: 'Banking', desc: 'Bank feed and connections' },
  { key: 'invoicing', label: 'Invoicing', desc: 'Invoices and payments' },
];

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['all']);
  const [expiresIn, setExpiresIn] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiClient<{ keys: any[] }>('/api-keys'),
  });

  const createKey = useMutation({
    mutationFn: (input: any) => apiClient<{ key: any; apiKey: string }>('/api-keys', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (result) => { setGeneratedKey(result.apiKey); setStep(4); queryClient.invalidateQueries({ queryKey: ['api-keys'] }); },
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => apiClient(`/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const toggleScope = (s: string) => {
    if (s === 'all') { setSelectedScopes(['all']); return; }
    setSelectedScopes((prev) => {
      const filtered = prev.filter((x) => x !== 'all');
      return filtered.includes(s) ? filtered.filter((x) => x !== s) : [...filtered, s];
    });
  };

  const handleCreate = () => {
    let expiresAt: string | undefined;
    if (expiresIn) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiresIn));
      expiresAt = d.toISOString();
    }
    createKey.mutate({ name: newKeyName, role: 'owner', scopes: selectedScopes.join(','), expiresAt });
  };

  const handleClose = () => {
    setShowCreate(false); setGeneratedKey(''); setNewKeyName(''); setSelectedScopes(['all']); setExpiresIn(''); setStep(1);
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;
  const keys = data?.keys || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">Generate keys for AI assistants, automation, and integrations.</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setStep(1); }}><Plus className="h-4 w-4 mr-1" /> Generate Key</Button>
      </div>

      {/* Create Wizard */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 1: Name your key</h3>
                <Input label="Key name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., Claude Desktop, Automation Script" />
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                  <Button onClick={() => setStep(2)} disabled={!newKeyName}>Next</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 2: Select permissions</h3>
                <div className="space-y-2">
                  {SCOPES.map((s) => (
                    <label key={s.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input type="checkbox" checked={selectedScopes.includes(s.key)}
                        onChange={() => toggleScope(s.key)}
                        className="rounded border-gray-300 text-primary-600 h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{s.label}</span>
                        <p className="text-xs text-gray-500">{s.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={() => setStep(3)} disabled={selectedScopes.length === 0}>Next</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Step 3: Expiration</h3>
                <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Never expires</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">6 months</option>
                  <option value="365">1 year</option>
                </select>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={handleCreate} loading={createKey.isPending}>Generate Key</Button>
                </div>
              </div>
            )}

            {step === 4 && generatedKey && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Key Generated</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  This key will not be shown again. Copy it now and store it securely.
                </div>
                <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs break-all select-all">{generatedKey}</div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(generatedKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? <><CheckCircle className="h-4 w-4 mr-1" /> Copied</> : <><Copy className="h-4 w-4 mr-1" /> Copy</>}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => {
                    const blob = new Blob([`KISBOOKS_API_KEY=${generatedKey}\n`], { type: 'text/plain' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${newKeyName.replace(/\s+/g, '-').toLowerCase()}.env`; a.click();
                  }}>Download .env</Button>
                </div>
                <div className="flex justify-end"><Button onClick={handleClose}>Done</Button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key List */}
      {keys.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <Key className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No API keys. Generate one to connect an AI assistant or automation tool.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Key</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Scopes</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Last Used</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Expires</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((key: any) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{key.keyPrefix}...</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{key.scopes || 'all'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      key.revokedAt ? 'bg-red-100 text-red-700' :
                      key.expiresAt && new Date(key.expiresAt) < new Date() ? 'bg-gray-100 text-gray-500' :
                      key.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {key.revokedAt ? 'Revoked' : key.expiresAt && new Date(key.expiresAt) < new Date() ? 'Expired' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {key.isActive && !key.revokedAt && (
                      <button onClick={() => { if (confirm('Revoke this API key? This cannot be undone.')) revokeKey.mutate(key.id); }}
                        className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    )}
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
