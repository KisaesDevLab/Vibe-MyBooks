// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CheckCircle, Loader2, Eye, EyeOff, Info, Smartphone, Cloud, HardDrive } from 'lucide-react';

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

  // Backup remote config state
  const [backupRemote, setBackupRemote] = useState({
    provider: 'none',
    localRetentionDays: '30',
    retentionPreset: 'recommended',
    retentionDaily: '14',
    retentionWeekly: '8',
    retentionMonthly: '12',
    retentionYearly: '7',
    lastRun: '',
    // S3 fields
    s3Bucket: '', s3Region: 'us-east-1', s3Endpoint: '', s3AccessKeyId: '', s3SecretAccessKey: '', s3Prefix: 'backups/',
    // OAuth fields
    oauthAppKey: '', oauthAppSecret: '', oauthClientId: '', oauthClientSecret: '',
    oauthTenantId: 'common', oauthRootFolder: '/Vibe MyBooks Backups', oauthFolderId: 'root',
    // Connection status
    hasAccessToken: false,
  });
  const [backupSaveStatus, setBackupSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [backupSaveError, setBackupSaveError] = useState('');
  const [backupTestStatus, setBackupTestStatus] = useState<'idle' | 'testing' | 'healthy' | 'error'>('idle');
  const [backupTestError, setBackupTestError] = useState('');

  const GFS_PRESETS: Record<string, { daily: string; weekly: string; monthly: string; yearly: string }> = {
    recommended: { daily: '14', weekly: '8', monthly: '12', yearly: '7' },
    minimal: { daily: '7', weekly: '4', monthly: '6', yearly: '0' },
    compliance: { daily: '30', weekly: '12', monthly: '24', yearly: '10' },
    unlimited: { daily: '0', weekly: '0', monthly: '0', yearly: '0' },
  };

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
        // Load backup remote config
        const backupRes = await fetch('/api/v1/admin/backup/remote-config', { headers: authHeaders });
        if (backupRes.ok) {
          const bd = await backupRes.json();
          const pc = JSON.parse(bd.backupRemoteConfig || '{}');
          setBackupRemote((b) => ({
            ...b,
            provider: bd.backupRemoteProvider || 'none',
            localRetentionDays: bd.backupLocalRetentionDays || '30',
            retentionPreset: bd.backupRemoteRetentionPreset || 'recommended',
            retentionDaily: bd.backupRemoteRetentionDaily || '14',
            retentionWeekly: bd.backupRemoteRetentionWeekly || '8',
            retentionMonthly: bd.backupRemoteRetentionMonthly || '12',
            retentionYearly: bd.backupRemoteRetentionYearly || '7',
            lastRun: bd.backupLastRun || '',
            s3Bucket: pc.bucket || '', s3Region: pc.region || 'us-east-1',
            s3Endpoint: pc.endpoint || '', s3AccessKeyId: pc.accessKeyId || '',
            s3Prefix: pc.prefix || 'backups/',
            oauthAppKey: pc.app_key || '', oauthClientId: pc.client_id || '',
            oauthTenantId: pc.ms_tenant_id || 'common',
            oauthRootFolder: pc.root_folder || '/Vibe MyBooks Backups',
            oauthFolderId: pc.folder_id || 'root',
            hasAccessToken: !!pc.hasAccessToken,
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

  const handleSaveBackupRemote = async () => {
    setBackupSaveStatus('saving');
    setBackupSaveError('');
    try {
      const providerConfig: Record<string, string> = {};
      if (backupRemote.provider === 's3') {
        Object.assign(providerConfig, {
          bucket: backupRemote.s3Bucket, region: backupRemote.s3Region,
          endpoint: backupRemote.s3Endpoint, accessKeyId: backupRemote.s3AccessKeyId,
          secretAccessKey: backupRemote.s3SecretAccessKey, prefix: backupRemote.s3Prefix,
        });
      } else if (backupRemote.provider === 'dropbox') {
        Object.assign(providerConfig, {
          appKey: backupRemote.oauthAppKey, appSecret: backupRemote.oauthAppSecret,
          rootFolder: backupRemote.oauthRootFolder,
        });
      } else if (backupRemote.provider === 'google_drive') {
        Object.assign(providerConfig, {
          clientId: backupRemote.oauthClientId, clientSecret: backupRemote.oauthClientSecret,
          folderId: backupRemote.oauthFolderId,
        });
      } else if (backupRemote.provider === 'onedrive') {
        Object.assign(providerConfig, {
          clientId: backupRemote.oauthClientId, clientSecret: backupRemote.oauthClientSecret,
          tenantId: backupRemote.oauthTenantId, folderId: backupRemote.oauthFolderId,
        });
      }

      const res = await fetch('/api/v1/admin/backup/remote-config', {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({
          backupRemoteProvider: backupRemote.provider,
          backupLocalRetentionDays: backupRemote.localRetentionDays,
          backupRemoteRetentionPreset: backupRemote.retentionPreset,
          backupRemoteRetentionDaily: backupRemote.retentionDaily,
          backupRemoteRetentionWeekly: backupRemote.retentionWeekly,
          backupRemoteRetentionMonthly: backupRemote.retentionMonthly,
          backupRemoteRetentionYearly: backupRemote.retentionYearly,
          providerConfig: backupRemote.provider !== 'none' ? providerConfig : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setBackupSaveStatus('saved');
      setTimeout(() => setBackupSaveStatus('idle'), 3000);
    } catch (err: any) {
      setBackupSaveStatus('error');
      setBackupSaveError(err.message);
    }
  };

  const handleTestBackupRemote = async () => {
    setBackupTestStatus('testing');
    setBackupTestError('');
    try {
      const res = await fetch('/api/v1/admin/backup/remote-test', {
        method: 'POST', headers: authHeaders,
      });
      const data = await res.json();
      if (res.ok && data.status === 'healthy') {
        setBackupTestStatus('healthy');
      } else {
        setBackupTestStatus('error');
        setBackupTestError(data.error?.message || data.error || 'Connection failed');
      }
    } catch (err: any) {
      setBackupTestStatus('error');
      setBackupTestError(err.message);
    }
  };

  const setBackup = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBackupRemote((b) => ({ ...b, [field]: e.target.value }));

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
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">Backup & Disaster Recovery</h2>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backup Schedule</label>
            <select value={form.backupSchedule} onChange={set('backupSchedule')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="none">None (manual only)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Local Retention */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keep local backups for</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="365" value={backupRemote.localRetentionDays}
                onChange={setBackup('localRetentionDays')}
                className="block w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Manual backups can be created from Settings &gt; Backup at any time. {backupRemote.lastRun && `Last auto-backup: ${new Date(backupRemote.lastRun).toLocaleString()}`}
          </p>
        </div>

        {/* Remote Storage Destination */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-800">Remote Backup Storage</h2>
          </div>
          <p className="text-sm text-gray-500">
            Upload backups to a remote provider for disaster recovery. All backups are encrypted before upload.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remote Provider</label>
            <select value={backupRemote.provider} onChange={setBackup('provider')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="none">None (local only)</option>
              <option value="dropbox">Dropbox</option>
              <option value="google_drive">Google Drive</option>
              <option value="onedrive">OneDrive</option>
              <option value="s3">S3 / MinIO / R2</option>
            </select>
          </div>

          {/* S3 Config */}
          {backupRemote.provider === 's3' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <Input label="Bucket" value={backupRemote.s3Bucket} onChange={setBackup('s3Bucket')} placeholder="my-backup-bucket" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Region" value={backupRemote.s3Region} onChange={setBackup('s3Region')} placeholder="us-east-1" />
                <Input label="Endpoint (optional)" value={backupRemote.s3Endpoint} onChange={setBackup('s3Endpoint')} placeholder="https://s3.example.com" />
              </div>
              <Input label="Access Key ID" value={backupRemote.s3AccessKeyId} onChange={setBackup('s3AccessKeyId')} />
              <Input label="Secret Access Key" type="password" value={backupRemote.s3SecretAccessKey} onChange={setBackup('s3SecretAccessKey')} />
              <Input label="Path Prefix" value={backupRemote.s3Prefix} onChange={setBackup('s3Prefix')} placeholder="backups/" />
            </div>
          )}

          {/* Dropbox Config */}
          {backupRemote.provider === 'dropbox' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                Create an app at <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">dropbox.com/developers/apps</a>.
                Set redirect URI to: <code className="text-xs bg-gray-100 px-1 rounded">{window.location.origin}/api/v1/admin/backup/remote-callback/dropbox</code>
              </p>
              <Input label="App Key" value={backupRemote.oauthAppKey} onChange={setBackup('oauthAppKey')} />
              <Input label="App Secret" type="password" value={backupRemote.oauthAppSecret} onChange={setBackup('oauthAppSecret')} />
              <Input label="Root Folder" value={backupRemote.oauthRootFolder} onChange={setBackup('oauthRootFolder')} />
              {backupRemote.hasAccessToken ? (
                <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Connected</span>
              ) : (
                <a href={`/api/v1/admin/backup/remote-connect/dropbox`}>
                  <Button type="button" variant="secondary" size="sm" disabled={!backupRemote.oauthAppKey}>Connect Dropbox</Button>
                </a>
              )}
            </div>
          )}

          {/* Google Drive Config */}
          {backupRemote.provider === 'google_drive' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                Create OAuth credentials in <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">Google Cloud Console</a>.
                Set redirect URI to: <code className="text-xs bg-gray-100 px-1 rounded">{window.location.origin}/api/v1/admin/backup/remote-callback/google_drive</code>
              </p>
              <Input label="Client ID" value={backupRemote.oauthClientId} onChange={setBackup('oauthClientId')} />
              <Input label="Client Secret" type="password" value={backupRemote.oauthClientSecret} onChange={setBackup('oauthClientSecret')} />
              {backupRemote.hasAccessToken ? (
                <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Connected</span>
              ) : (
                <a href={`/api/v1/admin/backup/remote-connect/google_drive`}>
                  <Button type="button" variant="secondary" size="sm" disabled={!backupRemote.oauthClientId}>Connect Google Drive</Button>
                </a>
              )}
            </div>
          )}

          {/* OneDrive Config */}
          {backupRemote.provider === 'onedrive' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                Register an app at <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">Azure Portal</a>.
                Set redirect URI to: <code className="text-xs bg-gray-100 px-1 rounded">{window.location.origin}/api/v1/admin/backup/remote-callback/onedrive</code>
              </p>
              <Input label="Application (Client) ID" value={backupRemote.oauthClientId} onChange={setBackup('oauthClientId')} />
              <Input label="Client Secret" type="password" value={backupRemote.oauthClientSecret} onChange={setBackup('oauthClientSecret')} />
              <Input label="Tenant ID" value={backupRemote.oauthTenantId} onChange={setBackup('oauthTenantId')} placeholder="common" />
              {backupRemote.hasAccessToken ? (
                <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Connected</span>
              ) : (
                <a href={`/api/v1/admin/backup/remote-connect/onedrive`}>
                  <Button type="button" variant="secondary" size="sm" disabled={!backupRemote.oauthClientId}>Connect OneDrive</Button>
                </a>
              )}
            </div>
          )}

          {/* Test + Save */}
          {backupRemote.provider !== 'none' && (
            <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
              <Button type="button" variant="secondary" onClick={handleTestBackupRemote} loading={backupTestStatus === 'testing'}>
                Test Connection
              </Button>
              {backupTestStatus === 'healthy' && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Healthy</span>}
              {backupTestStatus === 'error' && <span className="text-sm text-red-600">{backupTestError}</span>}
            </div>
          )}

          {/* GFS Retention */}
          {backupRemote.provider !== 'none' && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Remote Retention (GFS)</h3>
              <p className="text-xs text-gray-500">
                Remote backups use tiered retention for disaster recovery. Each backup is tagged by tier and kept as long as any tier applies. Set 0 for unlimited.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preset</label>
                <select value={backupRemote.retentionPreset}
                  onChange={(e) => {
                    const preset = e.target.value;
                    const vals = GFS_PRESETS[preset];
                    setBackupRemote((b) => ({
                      ...b, retentionPreset: preset,
                      ...(vals ? { retentionDaily: vals.daily, retentionWeekly: vals.weekly, retentionMonthly: vals.monthly, retentionYearly: vals.yearly } : {}),
                    }));
                  }}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="recommended">Recommended (14d / 8w / 12m / 7y)</option>
                  <option value="minimal">Minimal (7d / 4w / 6m / none)</option>
                  <option value="compliance">Compliance (30d / 12w / 24m / 10y)</option>
                  <option value="custom">Custom</option>
                  <option value="unlimited">Unlimited (keep all)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Daily backups</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={backupRemote.retentionDaily}
                      onChange={(e) => setBackupRemote((b) => ({ ...b, retentionDaily: e.target.value, retentionPreset: 'custom' }))}
                      disabled={backupRemote.retentionPreset !== 'custom'}
                      className="block w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50" />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Weekly backups</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={backupRemote.retentionWeekly}
                      onChange={(e) => setBackupRemote((b) => ({ ...b, retentionWeekly: e.target.value, retentionPreset: 'custom' }))}
                      disabled={backupRemote.retentionPreset !== 'custom'}
                      className="block w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50" />
                    <span className="text-xs text-gray-500">weeks</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monthly backups</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={backupRemote.retentionMonthly}
                      onChange={(e) => setBackupRemote((b) => ({ ...b, retentionMonthly: e.target.value, retentionPreset: 'custom' }))}
                      disabled={backupRemote.retentionPreset !== 'custom'}
                      className="block w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50" />
                    <span className="text-xs text-gray-500">months</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Yearly backups</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={backupRemote.retentionYearly}
                      onChange={(e) => setBackupRemote((b) => ({ ...b, retentionYearly: e.target.value, retentionPreset: 'custom' }))}
                      disabled={backupRemote.retentionPreset !== 'custom'}
                      className="block w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50" />
                    <span className="text-xs text-gray-500">years</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Backup Remote Config */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="button" onClick={handleSaveBackupRemote} loading={backupSaveStatus === 'saving'}>
              Save Backup Settings
            </Button>
            {backupSaveStatus === 'saved' && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Saved</span>}
            {backupSaveStatus === 'error' && <span className="text-sm text-red-600">{backupSaveError}</span>}
          </div>
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
