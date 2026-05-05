// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';

export function TfaConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tfa-config'],
    queryFn: () => apiClient<any>('/admin/tfa/config'),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'tfa-stats'],
    queryFn: () => apiClient<any>('/admin/tfa/stats'),
  });

  const { data: methods } = useQuery({
    queryKey: ['auth-methods'],
    queryFn: () => fetch('/api/v1/auth/methods').then((r) => r.json()),
  });

  // Separate query for the public sign-up toggle. Lives in
  // system_settings (not tfa_config) so it has its own
  // GET/PUT /admin/registration-config pair on the API side; we keep
  // it visually adjacent to the other auth toggles on this page rather
  // than splintering the admin nav into one-checkbox pages.
  const { data: registrationCfg } = useQuery<{ registrationEnabled: boolean }>({
    queryKey: ['admin', 'registration-config'],
    queryFn: () => apiClient<{ registrationEnabled: boolean }>('/admin/registration-config'),
  });

  const updateRegistration = useMutation({
    mutationFn: (enabled: boolean) =>
      apiClient('/admin/registration-config', {
        method: 'PUT',
        body: JSON.stringify({ registrationEnabled: enabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'registration-config'] });
      // /auth/methods exposes registrationEnabled too; refresh so other
      // open admin tabs reflect the change immediately.
      queryClient.invalidateQueries({ queryKey: ['auth-methods'] });
    },
  });

  const [form, setForm] = useState({
    isEnabled: false,
    allowedMethods: ['email', 'totp'] as string[],
    trustDeviceEnabled: true,
    trustDeviceDurationDays: 30,
    codeExpirySeconds: 300,
    codeLength: 6,
    maxAttempts: 5,
    lockoutDurationMinutes: 15,
    passkeysEnabled: false,
    magicLinkEnabled: false,
    magicLinkExpiryMinutes: 15,
    magicLinkMaxAttempts: 3,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm((f) => ({
        ...f,
        isEnabled: data.isEnabled,
        allowedMethods: data.allowedMethods || ['email', 'totp'],
        trustDeviceEnabled: data.trustDeviceEnabled ?? true,
        trustDeviceDurationDays: data.trustDeviceDurationDays ?? 30,
        codeExpirySeconds: data.codeExpirySeconds ?? 300,
        codeLength: data.codeLength ?? 6,
        maxAttempts: data.maxAttempts ?? 5,
        lockoutDurationMinutes: data.lockoutDurationMinutes ?? 15,
      }));
    }
  }, [data]);

  const updateConfig = useMutation({
    mutationFn: (input: typeof form) => apiClient('/admin/tfa/config', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'tfa-config'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const toggleMethod = (method: string) => {
    setForm((f) => ({
      ...f,
      allowedMethods: f.allowedMethods.includes(method)
        ? f.allowedMethods.filter((m) => m !== method)
        : [...f.allowedMethods, method],
    }));
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 max-w-2xl">
          <CheckCircle className="h-4 w-4" /> Configuration saved
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Master Switch */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">System 2FA</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isEnabled}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-5 w-5" />
            <div>
              <span className="text-sm font-medium text-gray-700">Enable Two-Factor Authentication</span>
              <p className="text-xs text-gray-500">Makes 2FA available for all users to opt in from their settings</p>
            </div>
          </label>
        </div>

        {/* Available Methods */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Available Methods</h2>
          {[
            { key: 'email', label: 'Email Code', desc: 'Code sent to user\'s account email. Free, uses system SMTP.', ready: methods?.smtpReady, infra: 'SMTP' },
            { key: 'totp', label: 'Authenticator App (TOTP)', desc: 'Google Authenticator, Authy, etc. Free, no external service needed.', ready: true, infra: null },
            { key: 'sms', label: 'Text Message (SMS)', desc: 'Requires Twilio or TextLinkSMS configuration. Per-message cost.', ready: methods?.smsReady, infra: 'SMS provider' },
          ].map((m) => (
            <label key={m.key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.allowedMethods.includes(m.key)}
                onChange={() => toggleMethod(m.key)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  {m.label}
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    form.allowedMethods.includes(m.key) && (!m.infra || m.ready) ? 'bg-green-500'
                    : form.allowedMethods.includes(m.key) && m.infra && !m.ready ? 'bg-amber-400'
                    : 'bg-gray-300'
                  }`} title={
                    form.allowedMethods.includes(m.key) && m.infra && !m.ready ? `Enabled but ${m.infra} not configured`
                    : m.ready ? 'Ready' : ''
                  } />
                </span>
                <p className="text-xs text-gray-500">
                  {form.allowedMethods.includes(m.key) && m.infra && !m.ready
                    ? `Enabled — configure ${m.infra} below to make it functional`
                    : m.desc}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Trust Device */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Trust Device</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.trustDeviceEnabled}
              onChange={(e) => setForm((f) => ({ ...f, trustDeviceEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
            <span className="text-sm text-gray-700">Allow users to trust devices and skip 2FA</span>
          </label>
          {form.trustDeviceEnabled && (
            <Input label="Trust duration (days)" type="number" value={String(form.trustDeviceDurationDays)}
              onChange={(e) => setForm((f) => ({ ...f, trustDeviceDurationDays: parseInt(e.target.value) || 30 }))} />
          )}
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Security</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code Expiry</label>
              <select value={form.codeExpirySeconds} onChange={(e) => setForm((f) => ({ ...f, codeExpirySeconds: parseInt(e.target.value) }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code Length</label>
              <select value={form.codeLength} onChange={(e) => setForm((f) => ({ ...f, codeLength: parseInt(e.target.value) }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value={6}>6 digits</option>
                <option value={8}>8 digits</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Failed Attempts</label>
              <select value={form.maxAttempts} onChange={(e) => setForm((f) => ({ ...f, maxAttempts: parseInt(e.target.value) }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lockout Duration</label>
              <select value={form.lockoutDurationMinutes} onChange={(e) => setForm((f) => ({ ...f, lockoutDurationMinutes: parseInt(e.target.value) }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* SMS Provider — moved to System Settings */}
        {!methods?.smsReady && form.allowedMethods.includes('sms') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            SMS is enabled but no provider is configured. Go to <a href="/admin/system" className="underline font-medium">System Settings</a> to set up Twilio or TextLinkSMS.
          </div>
        )}

        {/* Public sign-up — lives in system_settings.registration_enabled
            and saves immediately on toggle (no batching with the rest of
            the form, since this is a different endpoint and the operator
            expects a single click to take effect). */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Public Sign-up</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox"
              checked={registrationCfg?.registrationEnabled ?? true}
              onChange={(e) => updateRegistration.mutate(e.target.checked)}
              disabled={updateRegistration.isPending || !registrationCfg}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Allow new accounts via the sign-up form
                <span className={`inline-block h-2 w-2 rounded-full ${
                  (registrationCfg?.registrationEnabled ?? true) ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              </span>
              <p className="text-xs text-gray-500">
                When off, the &quot;Don&apos;t have an account? Sign up&quot; link is hidden on the
                sign-in page and POST /api/v1/auth/register returns 403. Existing
                users can still sign in. The first-run setup wizard is unaffected.
              </p>
            </div>
          </label>
        </div>

        {/* Passwordless Methods */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Passwordless Login</h2>

          {/* Passkeys */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.passkeysEnabled}
              onChange={(e) => setForm((f) => ({ ...f, passkeysEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Passkeys (WebAuthn)
                <span className={`inline-block h-2 w-2 rounded-full ${form.passkeysEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              </span>
              <p className="text-xs text-gray-500">Let users log in with fingerprint, face, or security key. No external service required.</p>
            </div>
          </label>

          {/* Magic Links */}
          <label className={`flex items-center gap-3 ${!methods?.smtpReady ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={form.magicLinkEnabled}
              onChange={(e) => setForm((f) => ({ ...f, magicLinkEnabled: e.target.checked }))}
              disabled={!methods?.smtpReady}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Magic Links
                <span className={`inline-block h-2 w-2 rounded-full ${
                  form.magicLinkEnabled && methods?.smtpReady ? 'bg-green-500' : !methods?.smtpReady ? 'bg-gray-300' : 'bg-gray-300'
                }`} />
              </span>
              <p className="text-xs text-gray-500">
                {methods?.smtpReady
                  ? 'Email-based passwordless login. Users still need TOTP or SMS as a second factor.'
                  : 'Requires SMTP to be configured. Configure SMTP in System Settings first.'}
              </p>
            </div>
          </label>

          {form.magicLinkEnabled && methods?.smtpReady && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Expiry</label>
                <select value={form.magicLinkExpiryMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, magicLinkExpiryMinutes: parseInt(e.target.value) }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Pending Links</label>
                <select value={form.magicLinkMaxAttempts}
                  onChange={(e) => setForm((f) => ({ ...f, magicLinkMaxAttempts: parseInt(e.target.value) }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Infrastructure Warnings */}
        {methods && (!methods.smtpReady || !methods.smsReady) && (
          <div className="space-y-2">
            {!methods.smtpReady && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                SMTP is not configured. Email codes and magic links are unavailable.
              </div>
            )}
            {!methods.smsReady && form.allowedMethods.includes('sms') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                No SMS provider configured. SMS codes are unavailable.
              </div>
            )}
            {!methods.smtpReady && !methods.smsReady && !form.allowedMethods.includes('totp') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                No 2FA delivery methods available. Enable TOTP (authenticator app) — it requires no external services.
              </div>
            )}
          </div>
        )}

        {/* Usage Statistics */}
        {stats && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Usage Statistics</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Users with 2FA</p>
                <p className="text-xl font-semibold text-gray-900">{stats.enrolledUsers} <span className="text-sm font-normal text-gray-400">/ {stats.totalUsers}</span></p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Enrollment Rate</p>
                <p className="text-xl font-semibold text-gray-900">{stats.totalUsers ? Math.round((stats.enrolledUsers / stats.totalUsers) * 100) : 0}%</p>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Email method: {stats.byMethod?.email || 0} users</p>
              <p>Authenticator (TOTP): {stats.byMethod?.totp || 0} users</p>
              <p>SMS: {stats.byMethod?.sms || 0} users</p>
            </div>
          </div>
        )}

        {updateConfig.error && <p className="text-sm text-red-600">{updateConfig.error.message}</p>}

        <Button onClick={() => updateConfig.mutate(form)} loading={updateConfig.isPending}>Save Configuration</Button>
      </div>
    </div>
  );
}
