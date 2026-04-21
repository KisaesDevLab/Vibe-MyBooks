// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { TurnstileWidget } from '../../components/auth/TurnstileWidget';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, turnstileToken: turnstileToken ?? '' }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-sm text-gray-600 text-center mb-4">
          If an account exists for {email}, we've sent a password reset link.
        </p>
        <Link
          to="/login"
          className="block text-center text-sm text-primary-600 hover:text-primary-500"
        >
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset password" subtitle="Enter your email to receive a reset link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <TurnstileWidget action="forgot_password" onToken={setTurnstileToken} />
        <Button type="submit" className="w-full" loading={loading} disabled={turnstileToken === null}>
          Send reset link
        </Button>
        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-primary-600 hover:text-primary-500">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
