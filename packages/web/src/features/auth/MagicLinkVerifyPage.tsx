import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { setTokens } from '../../api/client';
import { TfaVerifyStep } from './TfaVerifyStep';

export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'tfa' | 'error'>('loading');
  const [error, setError] = useState('');

  // TFA state
  const [tfaToken, setTfaToken] = useState('');
  const [tfaMethods, setTfaMethods] = useState<string[]>([]);
  const [tfaPreferred, setTfaPreferred] = useState('');
  const [phoneMasked, setPhoneMasked] = useState<string | undefined>();
  const [emailMasked, setEmailMasked] = useState<string | undefined>();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid login link.');
      return;
    }

    fetch(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setError(data.error?.message || 'Invalid or expired login link.');
          return;
        }
        // Magic link verified — now need 2FA
        setTfaToken(data.tfaToken);
        setTfaMethods(data.availableMethods || []);
        setTfaPreferred(data.preferredMethod || '');
        setPhoneMasked(data.phoneMasked);
        setEmailMasked(data.emailMasked);
        setStatus('tfa');
      })
      .catch(() => {
        setStatus('error');
        setError('Failed to verify login link.');
      });
  }, [token]);

  const handleTfaSuccess = (data: any) => {
    setTokens(data.tokens);
    setTimeout(() => navigate('/'), 50);
  };

  if (status === 'loading') {
    return (
      <AuthLayout title="Verifying..." subtitle="Checking your login link">
        <LoadingSpinner className="py-8" />
      </AuthLayout>
    );
  }

  if (status === 'error') {
    return (
      <AuthLayout title="Login Link Error" subtitle="">
        <div className="text-center space-y-4">
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/login">
            <Button variant="secondary">Go to Login</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // TFA step — use the magic link TFA endpoint that excludes email method
  return (
    <AuthLayout title="Verify Your Identity" subtitle="Complete two-factor authentication to log in">
      <TfaVerifyStep
        tfaToken={tfaToken}
        availableMethods={tfaMethods}
        preferredMethod={tfaPreferred}
        verifyEndpoint="/api/v1/auth/magic-link/tfa/verify"
        phoneMasked={phoneMasked}
        emailMasked={emailMasked}
        onSuccess={handleTfaSuccess}
      />
    </AuthLayout>
  );
}
