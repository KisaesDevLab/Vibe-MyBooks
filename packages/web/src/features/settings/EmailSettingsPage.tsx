import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Eye, EyeOff, CheckCircle, Loader2, Info } from 'lucide-react';
import { apiClient } from '../../api/client';

interface SmtpSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  configured: boolean;
}

export function EmailSettingsPage() {
  const [form, setForm] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
  });

  const [loading, setLoading] = useState(true);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient<SmtpSettings>('/company/smtp');
        setForm({
          smtpHost: data.smtpHost || '',
          smtpPort: String(data.smtpPort || 587),
          smtpUser: data.smtpUser || '',
          smtpPass: data.smtpPass || '',
          smtpFrom: data.smtpFrom || '',
        });
      } catch {
        // defaults are fine
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleTest = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      const result = await apiClient<{ success: boolean; error?: string }>('/company/smtp/test', {
        method: 'POST',
        body: JSON.stringify({
          host: form.smtpHost,
          port: Number(form.smtpPort),
          username: form.smtpUser,
          password: form.smtpPass,
          from: form.smtpFrom,
        }),
      });
      if (result.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(result.error || 'SMTP test failed');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message || 'SMTP test failed');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveError('');
    try {
      await apiClient('/company/smtp', {
        method: 'PUT',
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          smtpFrom: form.smtpFrom,
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save');
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
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure outbound email (SMTP) for this company. Used when sending invoices, payment reminders, and notifications.
      </p>

      {saveStatus === 'saved' && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Email settings saved
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 max-w-2xl">
          {saveError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">SMTP Server</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input label="SMTP Host" value={form.smtpHost} onChange={set('smtpHost')} placeholder="smtp.gmail.com" />
            </div>
            <Input label="Port" value={form.smtpPort} onChange={set('smtpPort')} type="number" />
          </div>
          <Input label="Username" value={form.smtpUser} onChange={set('smtpUser')} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showSmtpPass ? 'text' : 'password'}
                value={form.smtpPass}
                onChange={set('smtpPass')}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowSmtpPass(!showSmtpPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Input label="From Address" value={form.smtpFrom} onChange={set('smtpFrom')} type="email" placeholder="noreply@yourcompany.com" />

          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={handleTest} loading={testStatus === 'testing'} disabled={!form.smtpHost}>
              Test Connection
            </Button>
            {testStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Connection successful
              </span>
            )}
            {testStatus === 'error' && (
              <span className="text-sm text-red-600">{testError}</span>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Email settings are stored per company. Each company can use its own SMTP server so outbound emails come from the correct sender address.
          </div>
        </div>

        <Button type="submit" loading={saveStatus === 'saving'}>
          Save Email Settings
        </Button>
      </form>
    </div>
  );
}
