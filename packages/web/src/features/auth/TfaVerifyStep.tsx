// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Shield, Mail, Smartphone, Key } from 'lucide-react';

interface TfaVerifyStepProps {
  tfaToken: string;
  availableMethods: string[];
  preferredMethod: string;
  phoneMasked?: string;
  emailMasked?: string;
  onSuccess: (data: { user: any; tokens: any; accessibleTenants: any[] }) => void;
  /** Override the verify endpoint (e.g. for magic link flow) */
  verifyEndpoint?: string;
  /** Override the send-code endpoint */
  sendCodeEndpoint?: string;
}

export function TfaVerifyStep({ tfaToken, availableMethods, preferredMethod, phoneMasked, emailMasked, onSuccess, verifyEndpoint, sendCodeEndpoint }: TfaVerifyStepProps) {
  const [method, setMethod] = useState(preferredMethod || availableMethods[0] || 'totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-send code for email/sms on method select
  useEffect(() => {
    if ((method === 'email' || method === 'sms') && !codeSent) {
      sendCode();
    }
  }, [method]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, [method, showRecovery]);

  const [failedMethods, setFailedMethods] = useState<string[]>([]);
  const workingMethods = availableMethods.filter((m) => !failedMethods.includes(m));

  const sendCode = async () => {
    try {
      const res = await fetch(sendCodeEndpoint || '/api/v1/auth/tfa/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tfaToken}` },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        // Method delivery failed — mark it as unavailable
        setFailedMethods((prev) => [...prev, method]);
        const remaining = availableMethods.filter((m) => m !== method && !failedMethods.includes(m));
        if (remaining.length > 0) {
          setMethod(remaining[0]!);
          setError('That method is temporarily unavailable. Switched to another method.');
        } else {
          setError('Two-factor authentication is temporarily unavailable. Contact your administrator.');
        }
        return;
      }
      setCodeSent(true);
      setResendCooldown(60);
    } catch {
      setFailedMethods((prev) => [...prev, method]);
      setError('Failed to send code. Try another method.');
    }
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const fingerprint = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
      const res = await fetch(verifyEndpoint || '/api/v1/auth/tfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tfaToken}` },
        body: JSON.stringify({ code, method, trustDevice, deviceFingerprint: trustDevice ? fingerprint : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Verification failed');
        if (data.error?.remaining_attempts !== undefined) {
          setError(`Invalid code. ${data.error.remaining_attempts} attempts remaining.`);
        }
        if (data.error?.locked_until) {
          const mins = Math.ceil((new Date(data.error.locked_until).getTime() - Date.now()) / 60000);
          setError(`Account locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
        }
        setCode('');
      } else {
        onSuccess(data);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!recoveryCode) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/tfa/verify-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tfaToken}` },
        body: JSON.stringify({ code: recoveryCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Invalid recovery code');
      } else {
        onSuccess(data);
      }
    } catch (err: any) {
      setError(err.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit on 6 digits
  useEffect(() => {
    if (code.length === 6 && !loading) handleVerify();
  }, [code]);

  const methodIcons: Record<string, any> = { totp: Key, email: Mail, sms: Smartphone };
  const methodLabels: Record<string, string> = { totp: 'Authenticator', email: 'Email', sms: 'Text Message' };

  if (showRecovery) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <Shield className="h-10 w-10 text-primary-600 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-gray-900">Recovery Code</h2>
          <p className="text-sm text-gray-500 mt-1">Enter one of your saved recovery codes</p>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          className="block w-full text-center text-lg font-mono tracking-widest rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          maxLength={9}
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <Button onClick={handleRecovery} loading={loading} className="w-full">Verify Recovery Code</Button>
        <button onClick={() => { setShowRecovery(false); setError(''); }} className="block w-full text-sm text-primary-600 hover:underline text-center">
          Back to verification
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Shield className="h-10 w-10 text-primary-600 mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
      </div>

      {/* Zero methods — blocked */}
      {workingMethods.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-sm text-red-700 font-medium">Two-factor authentication is temporarily unavailable.</p>
          <p className="text-xs text-red-600 mt-1">Contact your administrator for assistance.</p>
        </div>
      )}

      {/* Method tabs */}
      {workingMethods.length > 1 && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {workingMethods.map((m) => {
            const Icon = methodIcons[m] || Key;
            return (
              <button key={m} onClick={() => { setMethod(m); setCode(''); setError(''); setCodeSent(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  method === m ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="h-3.5 w-3.5" />
                {methodLabels[m] || m}
              </button>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      <p className="text-sm text-gray-600 text-center">
        {method === 'totp' && 'Enter the 6-digit code from your authenticator app'}
        {method === 'email' && `We sent a code to ${emailMasked || 'your email'}`}
        {method === 'sms' && `We sent a code to ${phoneMasked || 'your phone'}`}
      </p>

      {/* Code input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="block w-full text-center text-2xl font-mono tracking-[0.5em] rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
        maxLength={6}
        autoComplete="one-time-code"
      />

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <Button onClick={handleVerify} loading={loading} disabled={code.length < 6} className="w-full">
        Verify
      </Button>

      {/* Resend for email/sms */}
      {(method === 'email' || method === 'sms') && (
        <div className="text-center">
          {resendCooldown > 0 ? (
            <span className="text-xs text-gray-400">Resend available in {resendCooldown}s</span>
          ) : (
            <button onClick={sendCode} className="text-xs text-primary-600 hover:underline">
              Didn't receive it? Resend code
            </button>
          )}
        </div>
      )}

      {/* Trust device */}
      <label className="flex items-center gap-2 justify-center cursor-pointer">
        <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)}
          className="rounded border-gray-300 text-primary-600" />
        <span className="text-xs text-gray-500">Trust this device for 30 days</span>
      </label>

      {/* Recovery code link */}
      <button onClick={() => { setShowRecovery(true); setError(''); }} className="block w-full text-xs text-gray-400 hover:text-primary-600 text-center">
        Can't access your authenticator? Use a recovery code
      </button>
    </div>
  );
}
