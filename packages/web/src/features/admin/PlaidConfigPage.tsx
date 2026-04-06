import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Landmark, CheckCircle, AlertTriangle } from 'lucide-react';

export function PlaidConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'plaid-config'],
    queryFn: () => apiClient<any>('/admin/plaid/config'),
  });

  const [form, setForm] = useState({
    environment: 'sandbox' as string,
    clientId: '',
    secretSandbox: '',
    secretProduction: '',
    webhookUrl: '',
    maxHistoricalDays: 90,
    isActive: true,
  });
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (data) {
      setForm((f) => ({
        ...f,
        environment: data.environment || 'sandbox',
        webhookUrl: data.webhookUrl || '',
        maxHistoricalDays: data.maxHistoricalDays || 90,
        isActive: data.isActive ?? true,
      }));
    }
  }, [data]);

  const updateConfig = useMutation({
    mutationFn: (input: any) => apiClient('/admin/plaid/config', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'plaid-config'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const testConn = useMutation({
    mutationFn: () => apiClient<any>('/admin/plaid/test', { method: 'POST' }),
    onSuccess: (d) => setTestResult({ ok: d.success, msg: d.message }),
    onError: (e: any) => setTestResult({ ok: false, msg: e.message }),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Plaid Integration</h1>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Configuration saved
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Status */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Status</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-5 w-5" />
            <div>
              <span className="text-sm font-medium text-gray-700">Plaid Integration Active</span>
              <p className="text-xs text-gray-500">When inactive, no new connections can be created and sync is paused</p>
            </div>
          </label>
        </div>

        {/* Environment */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Environment</h2>
          <div className="flex gap-4">
            {['sandbox', 'production'].map((env) => (
              <label key={env} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="environment" value={env} checked={form.environment === env}
                  onChange={() => setForm((f) => ({ ...f, environment: env }))}
                  className="text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-medium text-gray-700 capitalize">{env}</span>
              </label>
            ))}
          </div>
          {form.environment === 'production' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              Production mode uses real bank data. Sandbox connections won't work in production.
            </div>
          )}
        </div>

        {/* Credentials */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">API Credentials</h2>
          <Input label="Client ID" value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            placeholder={data?.hasClientId ? '••••••••••• (configured)' : 'Enter Plaid Client ID'} />
          <Input label="Sandbox Secret" type="password" value={form.secretSandbox}
            onChange={(e) => setForm((f) => ({ ...f, secretSandbox: e.target.value }))}
            placeholder={data?.hasSandboxSecret ? '••••••••••• (configured)' : 'Enter Sandbox Secret'} />
          <Input label="Production Secret" type="password" value={form.secretProduction}
            onChange={(e) => setForm((f) => ({ ...f, secretProduction: e.target.value }))}
            placeholder={data?.hasProductionSecret ? '���•••••••••• (configured)' : 'Enter Production Secret'} />
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => { setTestResult(null); testConn.mutate(); }} loading={testConn.isPending}>
              Test Connection
            </Button>
            {testResult && (
              <span className={`text-sm self-center ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
                {testResult.msg}
              </span>
            )}
          </div>
        </div>

        {/* Webhook */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Webhook</h2>
          <Input label="Webhook URL" value={form.webhookUrl} onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
            placeholder="https://your-domain.com/api/v1/plaid/webhooks" />
          <p className="text-xs text-gray-500">Set this URL in your Plaid Dashboard. Webhooks notify Vibe MyBooks of new transactions and connection status changes.</p>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Historical Transaction Days</label>
            <select value={form.maxHistoricalDays} onChange={(e) => setForm((f) => ({ ...f, maxHistoricalDays: parseInt(e.target.value) }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
              <option value={730}>2 years</option>
            </select>
          </div>
        </div>

        {updateConfig.error && <p className="text-sm text-red-600">{(updateConfig.error as any).message}</p>}
        <Button onClick={() => updateConfig.mutate(form)} loading={updateConfig.isPending}>Save Configuration</Button>
      </div>
    </div>
  );
}
