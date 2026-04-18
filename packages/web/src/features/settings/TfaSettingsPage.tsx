// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Shield, Mail, Smartphone, Key, Trash2, Copy, CheckCircle, AlertTriangle, Monitor } from 'lucide-react';
import { LoginMethodSettings } from './LoginMethodSettings';
import QRCode from 'qrcode';

interface TrustedDevice {
  id: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  trustedAt?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  [key: string]: unknown;
}

export function TfaSettingsPage() {
  const queryClient = useQueryClient();
  const [showRecoveryCodes, setShowRecoveryCodes] = useState<string[] | null>(null);
  const [showTotpSetup, setShowTotpSetup] = useState<{ secret: string; qrUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [password, setPassword] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<
    | 'removeTotp'
    | 'removeSms'
    | 'revokeAllDevices'
    | null
  >(null);
  const [showDisable, setShowDisable] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSmsSetup, setShowSmsSetup] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsStep, setSmsStep] = useState<'phone' | 'verify'>('phone');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['tfa', 'status'],
    queryFn: () => apiClient<any>('/users/me/tfa/status'),
  });

  const enableTfa = useMutation({
    mutationFn: () => apiClient<{ recoveryCodes: string[] }>('/users/me/tfa/enable', { method: 'POST' }),
    onSuccess: (data) => { setShowRecoveryCodes(data.recoveryCodes); queryClient.invalidateQueries({ queryKey: ['tfa'] }); },
  });

  const disableTfa = useMutation({
    mutationFn: (pw: string) => apiClient('/users/me/tfa/disable', { method: 'POST', body: JSON.stringify({ password: pw }) }),
    onSuccess: () => { setShowDisable(false); setPassword(''); queryClient.invalidateQueries({ queryKey: ['tfa'] }); },
  });

  const addEmail = useMutation({
    mutationFn: () => apiClient('/users/me/tfa/methods/email', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa'] }),
  });

  const removeEmail = useMutation({
    mutationFn: () => apiClient('/users/me/tfa/methods/email', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa'] }),
  });

  const setupTotp = useMutation({
    mutationFn: () => apiClient<{ secret: string; qrUri: string }>('/users/me/tfa/methods/totp', { method: 'POST' }),
    onSuccess: async (data) => {
      setShowTotpSetup(data); setTotpCode('');
      try { setQrDataUrl(await QRCode.toDataURL(data.qrUri, { width: 200, margin: 2 })); } catch { setQrDataUrl(''); }
    },
  });

  const verifyTotp = useMutation({
    mutationFn: (code: string) => apiClient('/users/me/tfa/methods/totp/verify', { method: 'POST', body: JSON.stringify({ code }) }),
    onSuccess: () => { setShowTotpSetup(null); queryClient.invalidateQueries({ queryKey: ['tfa'] }); },
  });

  const removeTotp = useMutation({
    mutationFn: () => apiClient('/users/me/tfa/methods/totp', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa'] }),
  });

  const addSms = useMutation({
    mutationFn: (phoneNumber: string) => apiClient('/users/me/tfa/methods/sms', { method: 'POST', body: JSON.stringify({ phoneNumber }) }),
    onSuccess: () => setSmsStep('verify'),
  });

  const verifySms = useMutation({
    mutationFn: (code: string) => apiClient('/users/me/tfa/methods/sms/verify', { method: 'POST', body: JSON.stringify({ code }) }),
    onSuccess: () => { setShowSmsSetup(false); setSmsPhone(''); setSmsCode(''); setSmsStep('phone'); queryClient.invalidateQueries({ queryKey: ['tfa'] }); },
  });

  const removeSms = useMutation({
    mutationFn: () => apiClient('/users/me/tfa/methods/sms', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa'] }),
  });

  const setPreferred = useMutation({
    mutationFn: (method: string) => apiClient('/users/me/tfa/preferred-method', { method: 'PUT', body: JSON.stringify({ method }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa'] }),
  });

  const regenerateCodes = useMutation({
    mutationFn: (pw: string) => apiClient<{ recoveryCodes: string[] }>('/users/me/tfa/recovery-codes', { method: 'POST', body: JSON.stringify({ password: pw }) }),
    onSuccess: (data) => { setShowRecoveryCodes(data.recoveryCodes); setShowRegenerate(false); setPassword(''); queryClient.invalidateQueries({ queryKey: ['tfa'] }); },
  });

  const { data: devicesData } = useQuery({
    queryKey: ['tfa', 'devices'],
    queryFn: () => apiClient<{ devices: TrustedDevice[] }>('/users/me/tfa/devices'),
    enabled: !!status?.userEnabled,
  });

  const revokeDevice = useMutation({
    mutationFn: (id: string) => apiClient(`/users/me/tfa/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa', 'devices'] }),
  });

  const revokeAllDevices = useMutation({
    mutationFn: () => apiClient('/users/me/tfa/devices', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa', 'devices'] }),
  });

  const handleCopyCodes = () => {
    if (showRecoveryCodes) { navigator.clipboard.writeText(showRecoveryCodes.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  const methods = status?.methods || [];
  const devices = devicesData?.devices || [];

  const confirmConfig = pendingConfirm === 'removeTotp'
    ? { title: 'Remove authenticator app?', message: 'You will no longer be able to sign in with TOTP codes until you re-enroll.', onConfirm: () => removeTotp.mutate() }
    : pendingConfirm === 'removeSms'
    ? { title: 'Remove SMS verification?', message: 'Your phone number will be removed from 2FA.', onConfirm: () => removeSms.mutate() }
    : pendingConfirm === 'revokeAllDevices'
    ? { title: 'Revoke all trusted devices?', message: 'Every device will require 2FA on the next login.', onConfirm: () => revokeAllDevices.mutate() }
    : null;

  return (
    <div>
      <ConfirmDialog
        open={!!confirmConfig}
        title={confirmConfig?.title ?? ''}
        message={confirmConfig?.message}
        confirmLabel="Remove"
        variant="danger"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          confirmConfig?.onConfirm();
          setPendingConfirm(null);
        }}
      />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h1>
      <p className="text-sm text-gray-500 mb-6">Add an extra layer of security to your account.</p>

      {/* Recovery Codes Modal */}
      {showRecoveryCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Recovery Codes</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
              Save these codes somewhere safe. Each can only be used once. They're the only way to recover your account if you lose your authenticator.
            </div>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-4 font-mono text-sm">
              {showRecoveryCodes.map((code, i) => <div key={i} className="text-center py-1">{code}</div>)}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={handleCopyCodes}>
                {copied ? <><CheckCircle className="h-4 w-4 mr-1" /> Copied</> : <><Copy className="h-4 w-4 mr-1" /> Copy All</>}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { const blob = new Blob([showRecoveryCodes.join('\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vibe-mybooks-recovery-codes.txt'; a.click(); }}>
                Download
              </Button>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowRecoveryCodes(null)}>I've Saved These Codes</Button>
            </div>
          </div>
        </div>
      )}

      {/* TOTP Setup Modal */}
      {showTotpSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Up Authenticator</h3>
            <p className="text-sm text-gray-600 mb-4">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="flex justify-center mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="rounded-lg" width={200} height={200} />
              ) : (
                <div className="w-[200px] h-[200px] bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">Loading QR...</div>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center mb-2">Or enter this key manually:</p>
            <div className="bg-gray-50 rounded-lg p-2 text-center font-mono text-sm tracking-wider mb-4 select-all">{showTotpSetup.secret}</div>
            <Input label="Enter the 6-digit code from your app" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
            {verifyTotp.error && <p className="text-sm text-red-600 mt-2">{verifyTotp.error.message}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowTotpSetup(null)}>Cancel</Button>
              <Button onClick={() => verifyTotp.mutate(totpCode)} loading={verifyTotp.isPending} disabled={totpCode.length < 6}>Verify & Activate</Button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Disable Two-Factor Authentication</h3>
            <p className="text-sm text-gray-600 mb-4">This will remove all 2FA methods, recovery codes, and trusted devices.</p>
            <Input label="Enter your password to confirm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {disableTfa.error && <p className="text-sm text-red-600 mt-2">{disableTfa.error.message}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => { setShowDisable(false); setPassword(''); }}>Cancel</Button>
              <Button variant="danger" onClick={() => disableTfa.mutate(password)} loading={disableTfa.isPending}>Disable 2FA</Button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Codes Modal */}
      {showRegenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Regenerate Recovery Codes</h3>
            <p className="text-sm text-gray-600 mb-4">This will invalidate all existing recovery codes.</p>
            <Input label="Enter your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => { setShowRegenerate(false); setPassword(''); }}>Cancel</Button>
              <Button onClick={() => regenerateCodes.mutate(password)} loading={regenerateCodes.isPending}>Regenerate</Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Status */}
        {!status?.systemEnabled ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            <Shield className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            Two-factor authentication is not enabled for this system. Contact your administrator.
          </div>
        ) : !status?.userEnabled ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Enable Two-Factor Authentication</h2>
            <p className="text-sm text-gray-500 mb-4">Add an extra verification step when you log in to protect your account.</p>
            <Button onClick={() => enableTfa.mutate()} loading={enableTfa.isPending}>Enable 2FA</Button>
          </div>
        ) : (
          <>
            {/* Active badge */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Two-factor authentication is active</p>
                <p className="text-xs text-green-600">{methods.length} method{methods.length !== 1 ? 's' : ''} configured</p>
              </div>
            </div>

            {/* Methods */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Methods</h2>

              {/* Email */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-xs text-gray-500">Code sent to your account email</p>
                  </div>
                </div>
                {methods.includes('email') ? (
                  <Button variant="secondary" size="sm" onClick={() => removeEmail.mutate()}>Remove</Button>
                ) : (
                  <Button size="sm" onClick={() => addEmail.mutate()} loading={addEmail.isPending}>Enable</Button>
                )}
              </div>

              {/* TOTP */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Authenticator App</p>
                    <p className="text-xs text-gray-500">Google Authenticator, Authy, etc.</p>
                  </div>
                </div>
                {methods.includes('totp') ? (
                  <Button variant="secondary" size="sm" onClick={() => setPendingConfirm('removeTotp')}>Remove</Button>
                ) : (
                  <Button size="sm" onClick={() => setupTotp.mutate()} loading={setupTotp.isPending}>Set Up</Button>
                )}
              </div>

              {/* SMS */}
              {status.allowedMethods?.includes('sms') && (
                <div className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Text Message</p>
                        <p className="text-xs text-gray-500">{status.phoneMasked || 'Not configured'}</p>
                      </div>
                    </div>
                    {methods.includes('sms') ? (
                      <Button variant="secondary" size="sm" onClick={() => setPendingConfirm('removeSms')}>Remove</Button>
                    ) : (
                      <Button size="sm" onClick={() => { setShowSmsSetup(true); setSmsStep('phone'); setSmsPhone(''); setSmsCode(''); }}>Set Up</Button>
                    )}
                  </div>
                  {showSmsSetup && (
                    <div className="mt-3 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                      {smsStep === 'phone' ? (
                        <>
                          <Input label="Phone number" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
                          {addSms.error && <p className="text-sm text-red-600">{addSms.error.message}</p>}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => addSms.mutate(smsPhone)} loading={addSms.isPending} disabled={!smsPhone}>Send Code</Button>
                            <Button size="sm" variant="secondary" onClick={() => setShowSmsSetup(false)}>Cancel</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600">Enter the 6-digit code sent to {smsPhone}</p>
                          <Input label="Verification code" value={smsCode} onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
                          {verifySms.error && <p className="text-sm text-red-600">{verifySms.error.message}</p>}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => verifySms.mutate(smsCode)} loading={verifySms.isPending} disabled={smsCode.length < 6}>Verify</Button>
                            <Button size="sm" variant="secondary" onClick={() => setShowSmsSetup(false)}>Cancel</Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preferred Method */}
            {methods.length > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
                <h2 className="text-lg font-semibold text-gray-800">Preferred Method</h2>
                <select
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={status.preferredMethod || methods[0]}
                  onChange={(e) => setPreferred.mutate(e.target.value)}>
                  {methods.includes('totp') && <option value="totp">Authenticator App</option>}
                  {methods.includes('email') && <option value="email">Email</option>}
                  {methods.includes('sms') && <option value="sms">Text Message</option>}
                </select>
                <p className="text-xs text-gray-500">This method will be shown first when you log in.</p>
              </div>
            )}

            {/* Recovery Codes */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">Recovery Codes</h2>
              <div className="flex items-center gap-2">
                {(status.recoveryCodesRemaining || 0) < 3 && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <p className="text-sm text-gray-600">
                  {status.recoveryCodesRemaining || 0} codes remaining
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setShowRegenerate(true); setPassword(''); }}>
                Regenerate Codes
              </Button>
            </div>

            {/* Trusted Devices */}
            {status.trustDeviceEnabled && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Trusted Devices</h2>
                  {devices.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setPendingConfirm('revokeAllDevices')}>
                      Revoke All
                    </Button>
                  )}
                </div>
                {devices.length === 0 ? (
                  <p className="text-sm text-gray-500">No trusted devices.</p>
                ) : (
                  <div className="space-y-2">
                    {devices.map((d: TrustedDevice) => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Monitor className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-900">{d.deviceName?.slice(0, 50) || 'Unknown device'}</p>
                            <p className="text-xs text-gray-500">{d.ipAddress} — trusted {d.trustedAt ? new Date(d.trustedAt).toLocaleDateString() : 'recently'}</p>
                          </div>
                        </div>
                        <button onClick={() => revokeDevice.mutate(d.id)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Disable */}
            <Button variant="danger" onClick={() => { setShowDisable(true); setPassword(''); }}>
              Disable Two-Factor Authentication
            </Button>
          </>
        )}

        {/* Login Methods (Passkeys + Magic Link) */}
        <div className="mt-8">
          <LoginMethodSettings />
        </div>
      </div>
    </div>
  );
}
