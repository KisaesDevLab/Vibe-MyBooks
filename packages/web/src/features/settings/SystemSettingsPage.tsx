import { useState, useEffect, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CheckCircle, Loader2, Eye, EyeOff, Info, Smartphone } from 'lucide-react';

export function SystemSettingsPage() {
  const [form, setForm] = useState({
    backupSchedule: 'none',
    applicationUrl: window.location.origin,
    maxFileSizeMb: '10',
    appName: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
  });

  const [loading, setLoading] = useState(true);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [testEmail, setTestEmail] = useState('');

  // SMS Provider state
  const [smsForm, setSmsForm] = useState({
    smsProvider: '' as string,
    smsTwilioAccountSid: '',
    smsTwilioAuthToken: '',
    smsTwilioFromNumber: '',
    smsTextlinkApiKey: '',
    smsTextlinkServiceName: '',
  });
  const [smsSaveStatus, setSmsSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [smsTestPhone, setSmsTestPhone] = useState('');
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const token = localStorage.getItem('accessToken');
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/admin/settings', { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setForm((f) => ({
            ...f,
            backupSchedule: data.backupSchedule || 'none',
            applicationUrl: data.applicationUrl || window.location.origin,
            maxFileSizeMb: String(data.maxFileSizeMb || data.maxFileSizeMB || 10),
            appName: data.appName || '',
            smtpHost: data.smtpHost || '',
            smtpPort: String(data.smtpPort || 587),
            smtpUser: data.smtpUser || '',
            smtpFrom: data.smtpFrom || '',
          }));
        }
        // Also load SMS provider config
        const tfaRes = await fetch('/api/v1/admin/tfa/config', { headers: authHeaders });
        if (tfaRes.ok) {
          const tfaData = await tfaRes.json();
          setSmsForm((f) => ({
            ...f,
            smsProvider: tfaData.smsProvider || '',
          }));
        }
      } catch {
        // defaults are fine
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const setSms = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSmsForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSaveSms = async () => {
    setSmsSaveStatus('saving');
    try {
      await fetch('/api/v1/admin/tfa/config', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(smsForm),
      });
      setSmsSaveStatus('saved');
      setTimeout(() => setSmsSaveStatus('idle'), 3000);
    } catch {
      setSmsSaveStatus('idle');
    }
  };

  const handleTestSms = async () => {
    setSmsTestResult(null);
    try {
      const res = await fetch('/api/v1/admin/tfa/sms-test', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ phoneNumber: smsTestPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSmsTestResult({ ok: true, message: data.message || 'Test SMS sent' });
      } else {
        setSmsTestResult({ ok: false, message: data.error?.message || 'SMS test failed' });
      }
    } catch (err: any) {
      setSmsTestResult({ ok: false, message: err.message || 'SMS test failed' });
    }
  };

  const handleTestSmtp = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      const res = await fetch('/api/v1/admin/test-smtp', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          host: form.smtpHost,
          port: Number(form.smtpPort),
          username: form.smtpUser,
          password: form.smtpPass,
          from: form.smtpFrom,
          testEmail: testEmail || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(data.error || 'SMTP test failed');
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
      // Save SMTP settings
      const smtpRes = await fetch('/api/v1/admin/settings/smtp', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          smtpFrom: form.smtpFrom,
        }),
      });
      if (!smtpRes.ok) throw new Error('Failed to save SMTP settings');

      // Save application settings
      const appRes = await fetch('/api/v1/admin/settings/application', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          applicationUrl: form.applicationUrl,
          maxFileSizeMb: form.maxFileSizeMb,
          backupSchedule: form.backupSchedule,
          appName: form.appName,
        }),
      });
      if (!appRes.ok) throw new Error('Failed to save application settings');

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
      <h1 className="text-2xl font-bold text-gray-900 mb-2">System Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Global settings that apply across all companies.</p>

      {saveStatus === 'saved' && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Settings saved
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 max-w-2xl">
          {saveError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* System SMTP Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">System Email (SMTP)</h2>
          <p className="text-sm text-gray-500">
            Used for password resets, user invites, and system notifications. Separate from per-company email used for invoices.
          </p>
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
              <button type="button" onClick={() => setShowSmtpPass(!showSmtpPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Input label="From Address" value={form.smtpFrom} onChange={set('smtpFrom')} type="email" placeholder="noreply@example.com" />

          <div className="border-t pt-4 space-y-3">
            <Input label="Send Test Email To (optional)" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} type="email" placeholder="admin@example.com" />
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={handleTestSmtp} loading={testStatus === 'testing'} disabled={!form.smtpHost}>
                {testEmail ? 'Send Test Email' : 'Test Connection'}
              </Button>
              {testStatus === 'success' && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" /> {testEmail ? 'Test email sent!' : 'Connection successful'}
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
              System SMTP is saved to the database and takes effect immediately. Per-company email for invoices is configured separately under each company's Settings &gt; Email.
            </div>
          </div>
        </div>

        {/* SMS Provider Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">SMS Provider</h2>
          </div>
          <p className="text-sm text-gray-500">
            Configure an SMS provider for 2FA text message delivery and other SMS notifications.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select value={smsForm.smsProvider} onChange={setSms('smsProvider')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">None (SMS disabled)</option>
              <option value="twilio">Twilio</option>
              <option value="textlinksms">TextLinkSMS</option>
            </select>
          </div>

          {smsForm.smsProvider === 'twilio' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <Input label="Account SID" value={smsForm.smsTwilioAccountSid} onChange={setSms('smsTwilioAccountSid')}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Auth Token</label>
                <input type="password" value={smsForm.smsTwilioAuthToken} onChange={setSms('smsTwilioAuthToken')}
                  placeholder="Enter Twilio auth token"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <Input label="From Number (E.164)" value={smsForm.smsTwilioFromNumber} onChange={setSms('smsTwilioFromNumber')}
                placeholder="+1XXXXXXXXXX" />
            </div>
          )}

          {smsForm.smsProvider === 'textlinksms' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">API Key</label>
                <input type="password" value={smsForm.smsTextlinkApiKey} onChange={setSms('smsTextlinkApiKey')}
                  placeholder="Enter TextLinkSMS API key"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <Input label="Service Name" value={smsForm.smsTextlinkServiceName} onChange={setSms('smsTextlinkServiceName')}
                placeholder="Vibe MyBooks" />
            </div>
          )}

          {smsForm.smsProvider && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Test SMS</p>
              <div className="flex gap-2">
                <Input placeholder="+1XXXXXXXXXX" value={smsTestPhone} onChange={(e) => setSmsTestPhone(e.target.value)} />
                <Button type="button" variant="secondary" size="sm"
                  onClick={handleTestSms} disabled={!smsTestPhone}>
                  Send Test
                </Button>
              </div>
              {smsTestResult && (
                <p className={`text-sm ${smsTestResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {smsTestResult.ok ? <CheckCircle className="h-4 w-4 inline mr-1" /> : null}
                  {smsTestResult.message}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleSaveSms} loading={smsSaveStatus === 'saving'}>
              Save SMS Settings
            </Button>
            {smsSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Saved
              </span>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Once an SMS provider is configured here, enable "Text Message" as a 2FA method in Admin &gt; Two-Factor Auth.
            </div>
          </div>
        </div>

        {/* Backup Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Backup</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backup Schedule</label>
            <select value={form.backupSchedule} onChange={set('backupSchedule')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="none">None (manual only)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Manual backups can be created from Settings &gt; Backup at any time.
          </p>
        </div>

        {/* Application Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Application</h2>
          <div>
            <Input
              label="App Name"
              value={form.appName}
              onChange={set('appName')}
              placeholder="Vibe MyBooks"
            />
            <p className="mt-1 text-xs text-gray-500">
              Shown in the sidebar header. Leave blank to use the default ("Vibe MyBooks"). When set to a
              custom name, a small "powered by VibeMB.com" footer is added to the sidebar.
            </p>
          </div>
          <Input label="Application URL" value={form.applicationUrl} onChange={set('applicationUrl')} placeholder="https://books.example.com" />
          <Input label="Max File Upload Size (MB)" value={form.maxFileSizeMb} onChange={set('maxFileSizeMb')} type="number" />
        </div>

        {/* CLI-only notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>Database</strong>, <strong>JWT secret</strong>, and <strong>Redis</strong> settings can only be changed via CLI or by editing the <code className="bg-amber-100 px-1 rounded">.env</code> file directly.
          </p>
        </div>

        <Button type="submit" loading={saveStatus === 'saving'}>
          Save Settings
        </Button>
      </form>
    </div>
  );
}
