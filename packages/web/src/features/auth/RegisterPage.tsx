// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRegister } from '../../api/hooks/useAuth';
import { useCoaTemplateOptions } from '../../api/hooks/useCoaTemplateOptions';
import { TurnstileWidget } from '../../components/auth/TurnstileWidget';
import { API_BASE } from '../../api/client';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('general_business');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const businessTypeOptions = useCoaTemplateOptions();
  const register = useRegister();
  const navigate = useNavigate();

  // If a super-admin has disabled public sign-up, bounce direct
  // /register hits to the login page rather than rendering a form whose
  // submit will 403. Server-side enforcement still happens in
  // POST /api/v1/auth/register; this is just the UX layer.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/methods`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (cancelled || !m) return;
        if (m.registrationEnabled === false) {
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        // Silent fail — the user can still attempt submit; the server
        // will return REGISTRATION_DISABLED if they shouldn't be here.
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(
      { email, password, displayName, companyName, businessType, turnstileToken: turnstileToken ?? '' },
      { onSuccess: () => setTimeout(() => navigate('/setup'), 50) },
    );
  };

  return (
    <AuthLayout title="Create account" subtitle="Start bookkeeping in minutes">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Company name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          placeholder="Your Business LLC"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {businessTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Input
          label="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="Jane Doe"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <TurnstileWidget action="register" onToken={setTurnstileToken} />
        {register.error && (
          <p className="text-sm text-red-600">{register.error.message}</p>
        )}
        <Button type="submit" className="w-full" loading={register.isPending} disabled={turnstileToken === null}>
          Create account
        </Button>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-500">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
