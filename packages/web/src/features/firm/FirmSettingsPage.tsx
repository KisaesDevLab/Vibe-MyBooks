// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Firm Settings — integrations. First integration: Tax1099.com
// e-filing. Credentials are firm-level, editable by firm admins only
// (the API enforces requireFirmAdmin; non-admin members will get 403s
// on save). Secret fields are write-only: the API returns has*
// booleans, never stored values.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { FirmTabs } from './FirmTabs';
import { CheckCircle, XCircle, Landmark } from 'lucide-react';

interface Tax1099Settings {
  isEnabled: boolean;
  environment: 'sandbox' | 'production';
  baseUrlOverride: string | null;
  hasApiKey: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  updatedAt: string | null;
}

export function FirmSettingsPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    isEnabled: false, environment: 'sandbox' as 'sandbox' | 'production',
    baseUrlOverride: '', apiKey: '', username: '', password: '',
  });
  const [hydrated, setHydrated] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['firms', firmId, 'integrations', 'tax1099'],
    queryFn: () => apiClient<Tax1099Settings>(`/firms/${firmId}/integrations/tax1099`),
    enabled: !!firmId,
  });

  if (!hydrated && data) {
    setForm((f) => ({
      ...f,
      isEnabled: data.isEnabled,
      environment: data.environment,
      baseUrlOverride: data.baseUrlOverride ?? '',
    }));
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () => apiClient(`/firms/${firmId}/integrations/tax1099`, {
      method: 'PUT',
      body: JSON.stringify({
        isEnabled: form.isEnabled,
        environment: form.environment,
        baseUrlOverride: form.baseUrlOverride || null,
        // ''=keep stored value (3-state sentinel server-side)
        apiKey: form.apiKey, username: form.username, password: form.password,
      }),
    }),
    onSuccess: () => {
      setForm((f) => ({ ...f, apiKey: '', username: '', password: '' }));
      queryClient.invalidateQueries({ queryKey: ['firms', firmId, 'integrations', 'tax1099'] });
    },
  });

  const test = useMutation({
    mutationFn: () => apiClient<{ ok: boolean; environment: string }>(
      `/firms/${firmId}/integrations/tax1099/test`, { method: 'POST' }),
    onSuccess: (r) => setTestResult(`Connected (${r.environment})`),
    onError: (e) => setTestResult(isApiError(e) ? e.message : 'Connection failed'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const secretPlaceholder = (has: boolean) => (has ? '•••••• (stored — leave blank to keep)' : 'Not set');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Firm Settings</h1>
      <FirmTabs firmId={firmId!} active="settings" />

      <div className="mt-6 max-w-2xl bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Tax1099.com e-filing</h2>
        </div>
        <p className="text-sm text-gray-500">
          Submit 1099 filings to the IRS through Tax1099 (Zenwork) for every company this firm
          manages. Only firm admins can change these settings; filings can be submitted by firm
          admins and accountants from each company's 1099 Center.
        </p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isEnabled}
            onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))} />
          <span className="text-sm font-medium text-gray-700">Enable Tax1099 e-filing</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
          <select value={form.environment}
            onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value as 'sandbox' | 'production' }))}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="sandbox">Sandbox (test filings)</option>
            <option value="production">Production (real IRS filings)</option>
          </select>
        </div>

        <Input label="API Key" type="password" value={form.apiKey} autoComplete="off"
          placeholder={secretPlaceholder(data?.hasApiKey ?? false)}
          onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
        <Input label="Tax1099 Username" value={form.username} autoComplete="off"
          placeholder={secretPlaceholder(data?.hasUsername ?? false)}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
        <Input label="Tax1099 Password" type="password" value={form.password} autoComplete="new-password"
          placeholder={secretPlaceholder(data?.hasPassword ?? false)}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        <Input label="API Base URL override (optional)" value={form.baseUrlOverride}
          placeholder="Leave blank for the standard Tax1099 endpoints"
          onChange={(e) => setForm((f) => ({ ...f, baseUrlOverride: e.target.value }))} />

        {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
        {testResult && (
          <p className={`text-sm flex items-center gap-1 ${testResult.startsWith('Connected') ? 'text-green-700' : 'text-red-600'}`}>
            {testResult.startsWith('Connected') ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {testResult}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button onClick={() => save.mutate()} loading={save.isPending}>Save</Button>
          <Button variant="secondary" onClick={() => { setTestResult(null); test.mutate(); }} loading={test.isPending}>
            Test Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
