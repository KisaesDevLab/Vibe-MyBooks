// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Creating a portal contact has to carry the invitation decision to the
// server, and hand the outcome back: a contact created in silence is a
// contact who never logs in, and an invitation SMTP dropped must not be
// reported as sent.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const apiClientMock = vi.hoisted(() => vi.fn());
vi.mock('../client', () => ({ apiClient: (...args: unknown[]) => apiClientMock(...args) }));

const { useCreatePortalContact } = await import('./usePortalContacts');

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const input = { email: 'client@example.com', companies: [{ companyId: 'co1', role: 'owner' }] };

beforeEach(() => apiClientMock.mockReset());

describe('useCreatePortalContact', () => {
  it('sends the invitation choice and returns what happened to it', async () => {
    apiClientMock.mockResolvedValue({ id: 'pc1', invite: { sent: true, viaStub: false, rateLimited: false } });
    const { result } = renderHook(() => useCreatePortalContact(), { wrapper });
    result.current.mutate({ ...input, sendInvite: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [path, init] = apiClientMock.mock.calls[0]!;
    expect(path).toBe('/practice/portal/contacts');
    expect(JSON.parse((init as { body: string }).body)).toMatchObject({ sendInvite: true });
    expect(result.current.data?.invite).toMatchObject({ sent: true });
  });

  it('carries back an invitation that was only logged, never delivered', async () => {
    apiClientMock.mockResolvedValue({ id: 'pc1', invite: { sent: false, viaStub: true, rateLimited: false } });
    const { result } = renderHook(() => useCreatePortalContact(), { wrapper });
    result.current.mutate({ ...input, sendInvite: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.invite).toMatchObject({ sent: false, viaStub: true });
  });

  it('lets staff create a contact without telling them yet', async () => {
    apiClientMock.mockResolvedValue({ id: 'pc1', invite: null });
    const { result } = renderHook(() => useCreatePortalContact(), { wrapper });
    result.current.mutate({ ...input, sendInvite: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse((apiClientMock.mock.calls[0]![1] as { body: string }).body)).toMatchObject({ sendInvite: false });
    expect(result.current.data?.invite).toBeNull();
  });
});
