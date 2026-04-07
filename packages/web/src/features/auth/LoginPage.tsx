import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { setTokens } from '../../api/client';
import { TfaVerifyStep } from './TfaVerifyStep';
import { Fingerprint, Mail, KeyRound } from 'lucide-react';

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

  // Fetch available login methods on mount
  useEffect(() => {
    fetch('/api/v1/auth/methods').then((r) => r.json()).then(setMethods).catch(() => {});
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Personalize methods after email entered
  const handleEmailBlur = () => {
    if (email) {
      fetch(`/api/v1/auth/methods?email=${encodeURIComponent(email)}`).then((r) => r.json()).then(setMethods).catch(() => {});
    }
  };

  // ─── Password Login ──────────────────────────────────────────

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error?.message || 'Login failed'); return; }

      if (data.tfa_required) {
        setTfaRequired(true);
        setTfaToken(data.tfa_token);
        setTfaMethods(data.available_methods || []);
        setTfaPreferred(data.preferred_method || '');
        setPhoneMasked(data.phone_masked);
        setEmailMasked(data.email_masked);
        return;
      }

      setTokens(data.tokens);
      setTimeout(() => navigate('/'), 50);
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
        body: JSON.stringify({ email: email || undefined }),
      });
      const options = await optRes.json();

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/v1/auth/passkeys/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      });
      const data = await verifyRes.json();

      if (!verifyRes.ok) { setError(data.error?.message || 'Passkey login failed'); return; }

      setTokens(data.tokens);
      setTimeout(() => navigate('/'), 50);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled.');
      } else {
        setError(err.message || 'Passkey login failed. Try another method.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Magic Link ──────────────────────────────────────────────

  const handleSendMagicLink = async () => {
    if (!email) { setError('Enter your email address first.'); return; }
    setMagicLinkLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || 'Failed to send login link'); return; }
      setMagicLinkSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to send login link');
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
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
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
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
          </form>
        )}

        {/* Show error outside form if password not shown */}
        {!showPassword && error && <p className="text-sm text-red-600">{error}</p>}

        <div className="text-center text-sm text-gray-500 space-y-1">
          <p><Link to="/forgot-password" className="text-primary-600 hover:text-primary-500">Forgot your password?</Link></p>
          <p>Don't have an account? <Link to="/register" className="text-primary-600 hover:text-primary-500">Sign up</Link></p>
        </div>
      </div>
    </AuthLayout>
  );
}
