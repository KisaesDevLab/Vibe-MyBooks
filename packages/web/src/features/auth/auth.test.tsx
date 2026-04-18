// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

// LoginPage + RegisterPage both fire unauthenticated GETs on mount to
// /api/setup/status and /api/v1/auth/methods. Without mocking fetch the
// tests would hit jsdom's default fetch (network error) which is noisy but
// not fatal — still cleaner to stub so the tests don't produce an unhandled
// rejection.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ setupComplete: true, hasAdminUser: true, loginMethods: { password: true, magicLink: false, passkey: false } }),
  } as Partial<Response>));
});

import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { MagicLinkVerifyPage } from './MagicLinkVerifyPage';
import { OAuthConsentPage } from './OAuthConsentPage';

describe('auth pages', () => {
  it('LoginPage renders the sign-in form', () => {
    renderRoute(<LoginPage />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('RegisterPage renders the sign-up form', () => {
    renderRoute(<RegisterPage />);
    // RegisterPage uses a heading like "Create your account" or similar —
    // match the common registration affordances.
    expect(screen.getAllByLabelText(/email/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/password/i).length).toBeGreaterThan(0);
  });

  it('ForgotPasswordPage renders the reset request form', () => {
    renderRoute(<ForgotPasswordPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send|reset/i })).toBeInTheDocument();
  });

  it('ResetPasswordPage shows the invalid-link state when no token is in the URL', () => {
    renderRoute(<ResetPasswordPage />, { route: '/reset-password' });
    // Multiple "invalid" strings appear (heading + subtitle); just assert
    // the "Request a new link" CTA is present, since it's unique to the
    // no-token branch.
    expect(screen.getByRole('button', { name: /request a new link/i })).toBeInTheDocument();
  });

  it('ResetPasswordPage renders the form when a token is present', () => {
    renderRoute(<ResetPasswordPage />, { route: '/reset-password?token=abc123' });
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('MagicLinkVerifyPage shows an error when token is missing from URL', async () => {
    renderRoute(<MagicLinkVerifyPage />, { route: '/auth/magic' });
    // Error state shows a "request a new link" or similar CTA.
    expect(await screen.findByText(/invalid|expired/i)).toBeInTheDocument();
  });

  it('OAuthConsentPage renders the authorization prompt', () => {
    renderRoute(<OAuthConsentPage />, {
      route: '/oauth/consent?client_id=x&redirect_uri=https://example.com/cb&scope=read&state=s',
    });
    // The page renders both Authorize and Deny buttons — assert both are
    // present so the test protects the "Deny" action too.
    expect(screen.getByRole('button', { name: /authorize/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument();
  });
});
