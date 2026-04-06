import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Shield, CheckCircle } from 'lucide-react';

const SCOPE_LABELS: Record<string, string> = {
  all: 'Full access to your financial data',
  read: 'Read your financial data',
  write: 'Create and update transactions',
  reports: 'Run financial reports',
  banking: 'Access bank feeds',
  invoicing: 'Manage invoices and payments',
};

export function OAuthConsentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const scope = params.get('scope') || 'all';
  const state = params.get('state') || '';
  const scopes = scope.split(',').filter(Boolean);

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, scope }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || 'Authorization failed'); return; }

      // Redirect back to the app with the code
      const url = new URL(redirectUri);
      url.searchParams.set('code', data.code);
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } catch (err: any) {
      setError(err.message || 'Authorization failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } else {
      navigate('/');
    }
  };

  return (
    <AuthLayout title="Authorize Application" subtitle="An application is requesting access to your account">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Shield className="h-8 w-8 text-primary-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">Application requesting access</p>
          <p className="text-xs text-gray-500 font-mono mt-1">{clientId}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">This app wants to:</p>
          {scopes.map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {SCOPE_LABELS[s] || s}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleApprove} loading={loading} className="flex-1">Authorize</Button>
          <Button variant="secondary" onClick={handleDeny} className="flex-1">Deny</Button>
        </div>

        <p className="text-xs text-gray-400 text-center">You can revoke access at any time from Settings → Connected Apps</p>
      </div>
    </AuthLayout>
  );
}
