// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A delegated firm member (Tenant operations access right) sees the tenant
// detail page WITHOUT any destructive control: no Danger Zone, no company
// Delete. Non-destructive cards (feature flags, retained earnings, system
// accounts, managing firm) stay.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.fn();

vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => ({
    data: {
      user: { id: 'staff', email: 'staff@firm.com', isSuperAdmin: false, role: 'accountant' },
      firmCapabilities: { tenant: {}, admin: { admin_tenant_ops: true } },
    },
  }),
}));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { TenantDetailPage } from './TenantDetailPage';

const TENANT = {
  tenant: { id: 't1', name: 'Acme', slug: 'acme', created_at: '2026-01-01' },
  users: [],
  companies: [
    { id: 'c1', businessName: 'Acme Co', setupComplete: true },
    { id: 'c2', businessName: 'Acme Two', setupComplete: true },
  ],
  firm: { current: null, history: [] },
  stats: { accounts: '5', transactions: '9', contacts: '2' },
};

beforeEach(() => {
  apiClientMock.mockReset();
  apiClientMock.mockImplementation((path: string) => {
    if (path === '/admin/tenants/t1') return Promise.resolve(TENANT);
    if (path.startsWith('/admin/firms')) return Promise.resolve({ firms: [], total: 0 });
    if (path.startsWith('/admin/feature-flags/')) return Promise.resolve({ flags: [] });
    return Promise.resolve({});
  });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')));
});

describe('TenantDetailPage — delegated viewer', () => {
  it('hides the Danger Zone and company Delete buttons; keeps the managing-firm card', async () => {
    renderRoute(<TenantDetailPage />, { route: '/admin/tenants/t1', path: '/admin/tenants/:id' });
    await screen.findByText('Managing firm');
    expect(screen.queryByText('Danger Zone')).toBeNull();
    expect(screen.queryByText('Delete tenant')).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
    expect(screen.getByText(/Reassigning requires you to be a firm admin/)).toBeInTheDocument();
  });
});
