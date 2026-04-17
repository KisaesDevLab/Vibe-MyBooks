// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startRegistration } from '@simplewebauthn/browser';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Fingerprint, Mail, KeyRound, Trash2, Pencil, Plus } from 'lucide-react';

export function LoginMethodSettings() {
  const queryClient = useQueryClient();
  const [passkeyName, setPasskeyName] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Fetch system methods
  const { data: methods } = useQuery({
    queryKey: ['auth-methods'],
    queryFn: () => fetch('/api/v1/auth/methods').then((r) => r.json()),
  });

  // Fetch user passkeys
  const { data: passkeyData, isLoading: passkeysLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => apiClient<{ passkeys: any[] }>('/auth/passkeys/me'),
    enabled: methods?.loginMethods?.passkey,
  });

  // Fetch TFA status (for magic link prerequisite check)
  const { data: tfaStatus } = useQuery({
    queryKey: ['tfa', 'status'],
    queryFn: () => apiClient<any>('/users/me/tfa/status'),
  });

  // Mutations
  const registerPasskey = useMutation({
    mutationFn: async (name: string) => {
      const options = await apiClient<any>('/auth/passkeys/register/options', { method: 'POST' });
      const attResp = await startRegistration({ optionsJSON: options });
      return apiClient('/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({ response: attResp, name }),
      });
    },
    onSuccess: () => { setShowRegister(false); setPasskeyName(''); setRegisterError(''); queryClient.invalidateQueries({ queryKey: ['passkeys'] }); },
    onError: (e: any) => setRegisterError(e.name === 'NotAllowedError' ? 'Registration was cancelled.' : (e.message || 'Registration failed.')),
  });

  const removePasskey = useMutation({
    mutationFn: (id: string) => apiClient(`/auth/passkeys/me/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
  });

  const renamePasskey = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient(`/auth/passkeys/me/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    onSuccess: () => { setRenamingId(null); queryClient.invalidateQueries({ queryKey: ['passkeys'] }); },
  });

  const toggleMagicLink = useMutation({
    mutationFn: (enabled: boolean) => apiClient('/users/me/login-preference', { method: 'PUT', body: JSON.stringify({ magicLinkEnabled: enabled }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tfa'] }),
  });

  const setPreferredLogin = useMutation({
    mutationFn: (method: string) => apiClient('/users/me/login-preference', { method: 'PUT', body: JSON.stringify({ preferredLoginMethod: method }) }),
  });

  const passkeys = passkeyData?.passkeys || [];
  const hasNonEmail2fa = tfaStatus?.methods?.some((m: string) => m === 'totp' || m === 'sms');
  const showPasskeySection = methods?.loginMethods?.passkey;
  const showMagicLinkSection = methods?.loginMethods?.magicLink;

  // If no passwordless methods available, don't render anything
  if (!showPasskeySection && !showMagicLinkSection) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Login Methods</h2>

      {/* Passkey Section */}
      {showPasskeySection && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">Passkeys</h3>
            </div>
            <Button size="sm" onClick={() => { setShowRegister(true); setPasskeyName(''); setRegisterError(''); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Passkey
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Use your fingerprint, face, or security key to sign in. Your biometric data never leaves your device.
          </p>

          {/* Register Modal */}
          {showRegister && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <Input label="Name this passkey" value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="e.g., MacBook Touch ID, YubiKey" />
              {registerError && <p className="text-sm text-red-600">{registerError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => registerPasskey.mutate(passkeyName || 'Passkey')} loading={registerPasskey.isPending}>
                  Register Passkey
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowRegister(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Passkey List */}
          {passkeysLoading ? <LoadingSpinner /> : passkeys.length === 0 ? (
            <p className="text-sm text-gray-400">No passkeys registered.</p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk: any) => (
                <div key={pk.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    {renamingId === pk.id ? (
                      <div className="flex items-center gap-2">
                        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-8 text-sm" />
                        <Button size="sm" onClick={() => renamePasskey.mutate({ id: pk.id, name: renameValue })}>Save</Button>
                        <Button variant="secondary" size="sm" onClick={() => setRenamingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900">{pk.deviceName || 'Passkey'}</p>
                        <p className="text-xs text-gray-500">
                          Added {new Date(pk.createdAt).toLocaleDateString()}
                          {pk.lastUsedAt && ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                          {pk.backedUp && ' · Synced'}
                        </p>
                      </>
                    )}
                  </div>
                  {renamingId !== pk.id && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setRenamingId(pk.id); setRenameValue(pk.deviceName || ''); }} className="p-1 text-gray-400 hover:text-gray-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm('Remove this passkey?')) removePasskey.mutate(pk.id); }} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Magic Link Section */}
      {showMagicLinkSection && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-gray-500" />
            <h3 className="font-medium text-gray-900">Email Login Links</h3>
          </div>
          {!hasNonEmail2fa ? (
            <p className="text-sm text-amber-600">
              Requires an authenticator app or SMS verification.{' '}
              <a href="/settings/security" className="underline">Set up now</a>
            </p>
          ) : (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={tfaStatus?.magicLinkEnabled || false}
                onChange={(e) => toggleMagicLink.mutate(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4" />
              <span className="text-sm text-gray-700">Enable email login links</span>
            </label>
          )}
        </div>
      )}

      {/* Preferred Login Method */}
      {(passkeys.length > 0 || tfaStatus?.magicLinkEnabled) && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gray-500" />
            <h3 className="font-medium text-gray-900">Preferred Login Method</h3>
          </div>
          <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            defaultValue={tfaStatus?.preferredLoginMethod || 'password'}
            onChange={(e) => setPreferredLogin.mutate(e.target.value)}>
            <option value="password">Password</option>
            {passkeys.length > 0 && <option value="passkey">Passkey</option>}
            {tfaStatus?.magicLinkEnabled && <option value="magic_link">Email Login Link</option>}
          </select>
          <p className="text-xs text-gray-500">This method will be shown first on the login page.</p>
        </div>
      )}
    </div>
  );
}
