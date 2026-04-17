// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { setTokens } from '../../api/client';
import { TfaVerifyStep } from './TfaVerifyStep';
import { AlertCircle, Fingerprint, Mail, KeyRound } from 'lucide-react';

// ─── Error helpers ────────────────────────────────────────────
//
// The login flow has four fetch calls (methods lookup, password login,
// passkey login, magic link). Each can fail in many distinct ways:
// invalid credentials, deactivated account, rate-limited, network down,
// server crash returning HTML, validation error, etc. Without specific
// messages the user just sees "Login failed" and has no idea what to do.

interface AuthErrorInput {
  status?: number;
  code?: string;
  serverMessage?: string;
  thrown?: unknown;
  defaultMessage: string;
}

function describeAuthError({ status, code, serverMessage, thrown, defaultMessage }: AuthErrorInput): string {
  // Network failures: fetch throws TypeError when it can't reach the server
  // (DNS failure, server down, CORS preflight rejected, offline, etc.)
  if (thrown instanceof TypeError) {
    return 'Cannot reach the server. Check your internet connection, or contact your administrator if the problem persists.';
  }

  // Specific error codes returned by the API
  if (code === 'INVALID_CREDENTIALS') return 'The email or password you entered is incorrect.';
  if (code === 'ACCOUNT_DEACTIVATED') {
    return serverMessage || 'This account has been deactivated. Please contact your administrator.';
  }
  if (code === 'RATE_LIMIT' || code === 'TOO_MANY_REQUESTS') {
    return 'Too many sign-in attempts. Please wait a minute and try again.';
  }
  if (code === 'VALIDATION_ERROR') {
    return serverMessage || 'Please check the form and try again.';
  }

  // Status-based fallbacks for codes we don't recognize
  if (status === 401) return 'The email or password you entered is incorrect.';
  if (status === 403) return serverMessage || 'You do not have permission to sign in.';
  if (status === 429) return 'Too many sign-in attempts. Please wait a minute and try again.';
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Please try again in a moment.';
  }
  if (status && status >= 500) {
    return 'Something went wrong on our end. Please try again, and contact support if the problem persists.';
  }

  return serverMessage || defaultMessage;
}

// res.json() throws on empty bodies or non-JSON responses (e.g. an HTML
// 502 page from a reverse proxy). Returning null lets the caller handle
// the failure path with describeAuthError instead of crashing.
async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

interface AuthMethods {
  loginMethods: { password: boolean; magicLink: boolean; passkey: boolean };
  userHasPasskeys?: boolean;
  userPreferredMethod?: string;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auth methods (fetched from server)
  const [methods, setMethods] = useState<AuthMethods | null>(null);

  // Magic link state
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // 2FA state
  const [tfaRequired, setTfaRequired] = useState(false);
  const [tfaToken, setTfaToken] = useState('');
  const [tfaMethods, setTfaMethods] = useState<string[]>([]);
  const [tfaPreferred, setTfaPreferred] = useState('');
  const [phoneMasked, setPhoneMasked] = useState<string | undefined>();
  const [emailMasked, setEmailMasked] = useState<string | undefined>();

  const navigate = useNavigate();

  // If the app has never been set up (no admin user exists yet), redirect
  // to the first-run wizard instead of showing a login form no one can use.
  // This is a common new-install footgun: the user lands on /login, types
  // credentials that don't exist, gets "Invalid email or password", and has
  // no indication that they needed to run through setup first.
  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((status) => {
        if (status && status.setupComplete === false && status.hasAdminUser === false) {
          navigate('/first-run-setup', { replace: true });
        }
      })
      .catch(() => {
        // If the status endpoint is unreachable we silently fall through to
        // showing the normal login form — better than blocking the user.
      });
  }, [navigate]);

  // Fetch available login methods on mount. Failures are silent — we just
  // fall back to the password-only form rather than blocking the page.
  useEffect(() => {
    fetch('/api/v1/auth/methods')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m) setMethods(m); })
      .catch(() => {});
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Personalize methods after email entered
  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (trimmed) {
      fetch(`/api/v1/auth/methods?email=${encodeURIComponent(trimmed)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => { if (m) setMethods(m); })
        .catch(() => {});
    }
  };

  // Clear any previous error as soon as the user starts editing — otherwise
  // a stale "incorrect password" message lingers while they retype.
  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError('');
  };
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  // ─── Password Login ──────────────────────────────────────────

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await safeJson(res);

      if (!res.ok) {
        setError(describeAuthError({
          status: res.status,
          code: data?.error?.code,
          serverMessage: data?.error?.message,
          defaultMessage: 'Sign in failed. Please try again.',
        }));
        return;
      }

      if (data?.tfa_required) {
        setTfaRequired(true);
        setTfaToken(data.tfa_token);
        setTfaMethods(data.available_methods || []);
        setTfaPreferred(data.preferred_method || '');
        setPhoneMasked(data.phone_masked);
        setEmailMasked(data.email_masked);
        return;
      }

      if (!data?.tokens) {
        setError('Unexpected response from server. Please try again.');
        return;
      }

      setTokens(data.tokens);
      setTimeout(() => navigate('/'), 50);
    } catch (err) {
      setError(describeAuthError({ thrown: err, defaultMessage: 'Sign in failed. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  // ─── Passkey Login ───────────────────────────────────────────

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const optRes = await fetch('/api/v1/auth/passkeys/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const options = await safeJson(optRes);
      if (!optRes.ok || !options) {
        setError(describeAuthError({
          status: optRes.status,
          code: options?.error?.code,
          serverMessage: options?.error?.message,
          defaultMessage: 'Could not start passkey sign-in. Try another method.',
        }));
        return;
      }

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/v1/auth/passkeys/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      });
      const data = await safeJson(verifyRes);

      if (!verifyRes.ok) {
        setError(describeAuthError({
          status: verifyRes.status,
          code: data?.error?.code,
          serverMessage: data?.error?.message,
          defaultMessage: 'Passkey sign-in failed. Try another method.',
        }));
        return;
      }

      if (!data?.tokens) {
        setError('Unexpected response from server. Please try again.');
        return;
      }

      setTokens(data.tokens);
      setTimeout(() => navigate('/'), 50);
    } catch (err: unknown) {
      // WebAuthn-specific errors thrown by the browser API
      const name = (err as { name?: string } | null)?.name;
      if (name === 'NotAllowedError') {
        setError('Passkey sign-in was cancelled or timed out.');
      } else if (name === 'SecurityError') {
        setError('Passkey sign-in is not allowed in this context. Try using HTTPS or another method.');
      } else if (name === 'InvalidStateError') {
        setError('No passkey is registered for this device. Try another sign-in method.');
      } else {
        setError(describeAuthError({
          thrown: err,
          defaultMessage: 'Passkey sign-in failed. Try another method.',
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Magic Link ──────────────────────────────────────────────

  const handleSendMagicLink = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError('Please enter your email address first.'); return; }
    setMagicLinkLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setError(describeAuthError({
          status: res.status,
          code: data?.error?.code,
          serverMessage: data?.error?.message,
          defaultMessage: 'Could not send the login link. Please try again.',
        }));
        return;
      }
      setMagicLinkSent(true);
      setResendCooldown(60);
    } catch (err) {
      setError(describeAuthError({
        thrown: err,
        defaultMessage: 'Could not send the login link. Please try again.',
      }));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  // ─── TFA Success ─────────────────────────────────────────────

  const handleTfaSuccess = (data: any) => {
    setTokens(data.tokens);
    setTimeout(() => navigate('/'), 50);
  };

  // ─── Render: TFA Step ────────────────────────────────────────

  if (tfaRequired) {
    return (
      <AuthLayout title="Verification Required" subtitle="Complete two-factor authentication to continue">
        <TfaVerifyStep
          tfaToken={tfaToken}
          availableMethods={tfaMethods}
          preferredMethod={tfaPreferred}
          phoneMasked={phoneMasked}
          emailMasked={emailMasked}
          onSuccess={handleTfaSuccess}
        />
      </AuthLayout>
    );
  }

  // ─── Render: Magic Link Sent ─────────────────────────────────

  if (magicLinkSent) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a login link to ${email}`}>
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary-600" />
          </div>
          <p className="text-sm text-gray-600">Click the link in your email to continue. It expires in 15 minutes.</p>
          <p className="text-xs text-gray-500">You'll need your authenticator app or phone to complete login.</p>
          <div className="pt-2">
            <Button variant="secondary" size="sm" disabled={resendCooldown > 0} onClick={handleSendMagicLink} loading={magicLinkLoading}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link'}
            </Button>
          </div>
          <button onClick={() => { setMagicLinkSent(false); setError(''); }} className="text-sm text-primary-600 hover:text-primary-500">
            Use a different method
          </button>
        </div>
      </AuthLayout>
    );
  }

  // ─── Render: Login Form ──────────────────────────────────────

  const hasPasskey = methods?.loginMethods.passkey;
  const hasMagicLink = methods?.loginMethods.magicLink;
  const hasAlternatives = hasPasskey || hasMagicLink;

  return (
    <AuthLayout title="Sign in" subtitle="Enter your credentials to access your account">
      <div className="space-y-4">
        {/* Passkey Login */}
        {hasPasskey && (
          <>
            <Button type="button" variant="secondary" className="w-full" onClick={handlePasskeyLogin} loading={loading}>
              <Fingerprint className="h-5 w-5 mr-2" />
              Sign in with Passkey
            </Button>
            {hasAlternatives && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">or</span></div>
              </div>
            )}
          </>
        )}

        {/* Email field (always shown) */}
        <Input label="Email" type="email" value={email} onChange={handleEmailChange}
          onBlur={handleEmailBlur} required autoComplete="email" />

        {/* Magic Link Button */}
        {hasMagicLink && !showPassword && (
          <Button type="button" variant="secondary" className="w-full" onClick={handleSendMagicLink} loading={magicLinkLoading}>
            <Mail className="h-4 w-4 mr-2" />
            Send Login Link
          </Button>
        )}

        {/* Password section */}
        {!showPassword && hasAlternatives ? (
          <button type="button" onClick={() => setShowPassword(true)}
            className="w-full text-center text-sm text-primary-600 hover:text-primary-500 py-2">
            <KeyRound className="h-4 w-4 inline mr-1" />
            Continue with password
          </button>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            {hasAlternatives && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">or use password</span></div>
              </div>
            )}
            {/* When no alternatives, email is already above. Only show password here if alternatives exist and password section is expanded */}
            {!hasAlternatives && null}
            <Input label="Password" type="password" value={password} onChange={handlePasswordChange}
              required autoComplete="current-password" />
            {error && <ErrorAlert message={error} />}
            <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
          </form>
        )}

        {/* Show error outside form if password not shown */}
        {!showPassword && error && <ErrorAlert message={error} />}

        <div className="text-center text-sm text-gray-500 space-y-1">
          <p><Link to="/forgot-password" className="text-primary-600 hover:text-primary-500">Forgot your password?</Link></p>
          <p>Don't have an account? <Link to="/register" className="text-primary-600 hover:text-primary-500">Sign up</Link></p>
        </div>
      </div>
    </AuthLayout>
  );
}
