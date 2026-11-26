// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { clearTokens, setTokens } from '../../api/client';

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

  describe('OAuthConsentPage', () => {
    const details = {
      clientName: 'Claude', isDynamic: true, redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      redirectHost: 'claude.ai', redirectIsThisComputer: false, scopes: ['read', 'banking'],
    };
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body } as Partial<Response>);

    /** Answers the consent page's own calls with `oauth`; everything else the layout asks for gets an empty 200. */
    function stubOAuth(oauth: () => Promise<Partial<Response>>) {
      const calls: string[] = [];
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/oauth/')) {
          calls.push(url);
          return oauth();
        }
        return reply(200, {});
      }));
      return calls;
    }

    beforeEach(() => { setTokens({ accessToken: 'session' }); });
    afterEach(() => { clearTokens(); });

    it('shows what the server says about the request, never what the URL says', async () => {
      const calls = stubOAuth(async () => reply(200, details));
      // client_name in the URL is ignored: only `request` is used.
      renderRoute(<OAuthConsentPage />, { route: '/oauth/consent?request=signed.value&client_name=Trusted%20Bank' });
      expect(await screen.findByText('Claude')).toBeInTheDocument();
      expect(screen.queryByText(/Trusted Bank/)).not.toBeInTheDocument();
      expect(screen.getByText('claude.ai')).toBeInTheDocument();
      expect(screen.getByText(/nobody has checked it/i)).toBeInTheDocument();
      expect(screen.getByText(/reconcile accounts/i)).toBeInTheDocument();
      // Both actions are offered.
      expect(screen.getByRole('button', { name: /authorize/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument();
      expect(calls[0]).toContain('/oauth/authorize/details?request=signed.value');
    });

    it('a link without a request is refused without asking the server', async () => {
      const calls = stubOAuth(async () => reply(200, details));
      renderRoute(<OAuthConsentPage />, { route: '/oauth/consent?client_id=x&redirect_uri=https://example.com/cb' });
      expect(await screen.findByRole('alert')).toHaveTextContent(/not complete/i);
      expect(screen.queryByRole('button', { name: /authorize/i })).not.toBeInTheDocument();
      expect(calls).toEqual([]);
    });

    it('an expired request says so and offers nothing to approve', async () => {
      stubOAuth(async () => reply(400, { error: 'invalid_request', error_description: 'This sign-in request has expired.' }));
      renderRoute(<OAuthConsentPage />, { route: '/oauth/consent?request=old' });
      expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
      expect(screen.queryByRole('button', { name: /authorize/i })).not.toBeInTheDocument();
    });

    it('a server that cannot be reached offers a retry', async () => {
      stubOAuth(async () => { throw new Error('network'); });
      renderRoute(<OAuthConsentPage />, { route: '/oauth/consent?request=signed.value' });
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });
});
