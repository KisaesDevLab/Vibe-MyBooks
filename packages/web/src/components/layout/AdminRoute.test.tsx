// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// AdminRoute: super admins pass everywhere; a firm member holding the
// route's delegated capability passes; anyone else (or a route with no
// capability) is sent home. AdminIndexRoute redirects delegated members to
// their first usable admin page.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderRoute } from '../../test-utils';

const meState: { data: unknown } = { data: undefined };
vi.mock('../../api/hooks/useAuth', () => ({ useMe: () => meState }));

const { AdminRoute, AdminIndexRoute } = await import('./AdminRoute');

function app(route: string) {
  return renderRoute(
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route path="/admin" element={<AdminIndexRoute><p>dashboard</p></AdminIndexRoute>} />
      <Route path="/admin/tenants" element={<AdminRoute capability="admin_tenant_ops"><p>tenants</p></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute capability="admin_user_support"><p>users</p></AdminRoute>} />
      <Route path="/admin/system" element={<AdminRoute><p>system</p></AdminRoute>} />
    </Routes>,
    { route },
  );
}

const staff = (admin: Record<string, boolean>) => ({
  user: { id: 'u1', role: 'accountant', isSuperAdmin: false },
  firmCapabilities: { tenant: {}, admin },
});

beforeEach(() => { meState.data = undefined; });

describe('AdminRoute', () => {
  it('super admin reaches every admin route', () => {
    meState.data = { user: { id: 'u1', role: 'owner', isSuperAdmin: true } };
    app('/admin/system');
    expect(screen.getByText('system')).toBeInTheDocument();
  });

  it('delegated member with the capability passes; without it goes home', () => {
    meState.data = staff({ admin_tenant_ops: true });
    app('/admin/tenants');
    expect(screen.getByText('tenants')).toBeInTheDocument();
  });

  it('delegated member is refused on a route for a capability they lack', () => {
    meState.data = staff({ admin_tenant_ops: true });
    app('/admin/users');
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('routes without a capability stay super-admin only', () => {
    meState.data = staff({ admin_tenant_ops: true, admin_user_support: true });
    app('/admin/system');
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('renders children while /me is still loading (no flash redirect)', () => {
    app('/admin/tenants');
    expect(screen.getByText('tenants')).toBeInTheDocument();
  });
});

describe('AdminIndexRoute', () => {
  it('super admin gets the dashboard', () => {
    meState.data = { user: { id: 'u1', role: 'owner', isSuperAdmin: true } };
    app('/admin');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
  it('delegated member is redirected to Tenants, else Users', () => {
    meState.data = staff({ admin_tenant_ops: true });
    app('/admin');
    expect(screen.getByText('tenants')).toBeInTheDocument();
  });
  it('user-support-only member lands on Users', () => {
    meState.data = staff({ admin_user_support: true });
    app('/admin');
    expect(screen.getByText('users')).toBeInTheDocument();
  });
  it('plain staff bounce home', () => {
    meState.data = staff({});
    app('/admin');
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
