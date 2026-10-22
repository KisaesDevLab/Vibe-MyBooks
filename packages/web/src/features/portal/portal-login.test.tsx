// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PortalLoginPage: one field for email or mobile number; the button says
// how the code will arrive; step 2 posts the code with what was typed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { PortalLoginPage, identifierKind } from './PortalLoginPage';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as Response));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BASE_URL', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('identifierKind', () => {
  it('tells an email from a mobile number', () => {
    expect(identifierKind('pat@example.com')).toBe('email');
    expect(identifierKind('(417) 555-0100')).toBe('phone');
    expect(identifierKind('+1 417 555 0100')).toBe('phone');
    expect(identifierKind('4175')).toBeNull();
    expect(identifierKind('pat@')).toBeNull();
  });
});

describe('PortalLoginPage', () => {
  it('texts a code for a mobile number and signs in with it', async () => {
    renderRoute(<PortalLoginPage />);
    fireEvent.change(screen.getByLabelText('Email or mobile number'), { target: { value: '(417) 555-0100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Text me a sign-in code' }));

    await waitFor(() => expect(screen.getByText(/Check your texts/)).toBeTruthy());
    const [reqUrl, reqInit] = fetchMock.mock.calls[0]!;
    expect(String(reqUrl)).toContain('api/portal/auth/request-link');
    expect(JSON.parse(String((reqInit as RequestInit).body))).toMatchObject({ identifier: '(417) 555-0100' });

    fireEvent.change(screen.getByLabelText('Sign-in code'), { target: { value: '12a3456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('verify-code'))).toBe(true));
    const verify = fetchMock.mock.calls.find((c) => String(c[0]).includes('verify-code'))!;
    expect(JSON.parse(String((verify[1] as RequestInit).body))).toEqual({ identifier: '(417) 555-0100', code: '123456' });
  });

  it('offers email for an address and shows the server error for a bad code', async () => {
    renderRoute(<PortalLoginPage />);
    fireEvent.change(screen.getByLabelText('Email or mobile number'), { target: { value: 'pat@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in code' }));
    await waitFor(() => expect(screen.getByText(/Check your email/)).toBeTruthy());

    fetchMock.mockImplementationOnce(() => Promise.resolve({
      ok: false, status: 401, json: async () => ({ error: { message: 'That code is not valid or has expired. Request a new one.' } }),
    } as Response));
    fireEvent.change(screen.getByLabelText('Sign-in code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not valid'));
  });

  it('does not send for something that is neither', async () => {
    renderRoute(<PortalLoginPage />);
    fireEvent.change(screen.getByLabelText('Email or mobile number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send me a sign-in code' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('valid email address or mobile number'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
