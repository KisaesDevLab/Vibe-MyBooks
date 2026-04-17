// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Eye, EyeOff, CheckCircle, Loader2, Info, CreditCard, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';

interface StripeConfig {
  configured: boolean;
  publishableKey: string | null;
  onlinePaymentsEnabled: boolean;
}

export function StripeSettingsPage() {
  const [config, setConfig] = useState<StripeConfig | null>(null);
  const [form, setForm] = useState({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
  });

  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [removeStatus, setRemoveStatus] = useState<'idle' | 'removing' | 'removed'>('idle');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient<StripeConfig>('/company/stripe');
        setConfig(data);
        if (data.publishableKey) {
          setForm(f => ({ ...f, publishableKey: data.publishableKey || '' }));
        }
      } catch {
        // defaults are fine
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveError('');

    if (!form.publishableKey.startsWith('pk_')) {
      setSaveStatus('error');
      setSaveError('Publishable key must start with pk_');
      return;
    }
    if (!form.secretKey.startsWith('sk_')) {
      setSaveStatus('error');
      setSaveError('Secret key must start with sk_');
      return;
    }
    if (!form.webhookSecret.startsWith('whsec_')) {
      setSaveStatus('error');
      setSaveError('Webhook secret must start with whsec_');
      return;
    }

    try {
      await apiClient('/company/stripe', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setSaveStatus('saved');
      setConfig({ configured: true, publishableKey: form.publishableKey, onlinePaymentsEnabled: true });
      setForm(f => ({ ...f, secretKey: '', webhookSecret: '' }));
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save');
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove Stripe configuration? Online payments will be disabled.')) return;
    setRemoveStatus('removing');
    try {
      await apiClient('/company/stripe', { method: 'DELETE' });
      setConfig({ configured: false, publishableKey: null, onlinePaymentsEnabled: false });
      setForm({ publishableKey: '', secretKey: '', webhookSecret: '' });
      setRemoveStatus('removed');
      setTimeout(() => setRemoveStatus('idle'), 3000);
    } catch {
      setRemoveStatus('idle');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Online Payments (Stripe)</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your Stripe account to accept credit card and digital wallet payments on shared invoice links.
      </p>

      {/* Current status */}
      {config?.configured && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Stripe connected</p>
              <p className="text-xs text-green-600">Online payments are enabled. Key: {config.publishableKey?.slice(0, 12)}...</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={handleRemove} loading={removeStatus === 'removing'}>
            <Trash2 className="h-4 w-4 mr-1" /> Disconnect
          </Button>
        </div>
      )}

      {removeStatus === 'removed' && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 max-w-2xl">
          Stripe disconnected. Online payments are now disabled.
        </div>
      )}

      {saveStatus === 'saved' && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Stripe settings saved. Online payments are now enabled.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 max-w-2xl">
          {saveError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Stripe API Keys
          </h2>
          <p className="text-xs text-gray-500">
            Find these in your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Stripe Dashboard</a> under Developers &rarr; API Keys.
          </p>

          <Input
            label="Publishable Key"
            value={form.publishableKey}
            onChange={set('publishableKey')}
            placeholder="pk_live_..."
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Secret Key</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.secretKey}
                onChange={set('secretKey')}
                placeholder={config?.configured ? '(saved — enter new value to replace)' : 'sk_live_...'}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Webhook Signing Secret</label>
            <div className="relative">
              <input
                type={showWebhook ? 'text' : 'password'}
                value={form.webhookSecret}
                onChange={set('webhookSecret')}
                placeholder={config?.configured ? '(saved — enter new value to replace)' : 'whsec_...'}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowWebhook(!showWebhook)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 max-w-2xl space-y-2">
          <div className="flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Setup Instructions</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Log in to your <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard</a></li>
                <li>Go to <strong>Developers &rarr; API Keys</strong> and copy your publishable and secret keys</li>
                <li>Go to <strong>Developers &rarr; Webhooks</strong> and click <strong>Add endpoint</strong></li>
                <li>Set the endpoint URL to: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/api/v1/stripe/webhook</code></li>
                <li>Select the event <strong>payment_intent.succeeded</strong></li>
                <li>After creating the endpoint, copy the <strong>Signing secret</strong> (starts with whsec_)</li>
                <li>Paste all three values above and save</li>
              </ol>
            </div>
          </div>
        </div>

        <Button type="submit" loading={saveStatus === 'saving'} disabled={!form.publishableKey || (!config?.configured && (!form.secretKey || !form.webhookSecret))}>
          {config?.configured ? 'Update Stripe Settings' : 'Connect Stripe'}
        </Button>
      </form>
    </div>
  );
}
