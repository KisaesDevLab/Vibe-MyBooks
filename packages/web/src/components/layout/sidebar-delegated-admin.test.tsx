// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Sidebar Admin section for delegated firm members: shown when the member
// holds an admin access right, trimmed to the pages that right unlocks;
// absent entirely for plain staff; complete for super admins.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const meState: { data: unknown } = { data: undefined };
vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => meState,
  useLogout: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../api/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));
vi.mock('../../api/hooks/useFirms', () => ({
  useFirms: () => ({ data: { firms: [] } }),
}));
vi.mock('./CompanySwitcher', () => ({ CompanySwitcher: () => null }));
vi.mock('./PracticeGroup', () => ({ PracticeGroup: () => null }));
vi.mock('./FirmGroup', () => ({ FirmGroup: () => null }));
vi.mock('./SidebarDisplayControls', () => ({ SidebarDisplayControls: () => null }));

const { Sidebar } = await import('./Sidebar');

const me = (isSuperAdmin: boolean, admin: Record<string, boolean> | undefined) => ({
  user: { id: 'u1', email: 't@example.com', isSuperAdmin, role: 'accountant', userType: 'staff' },
  branding: { appName: 'Vibe MyBooks', isCustomName: false },
  ...(admin ? { firmCapabilities: { tenant: {}, admin } } : {}),
});

beforeEach(() => { window.localStorage.clear(); meState.data = undefined; });

describe('sidebar — delegated admin', () => {
  it('shows only the Tenants entry for a member with admin_tenant_ops', () => {
    meState.data = me(false, { admin_tenant_ops: true });
    renderRoute(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByRole('link', { name: 'Tenants' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'System Settings' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Admin Dashboard' })).toBeNull();
  });

  it('shows no Admin section at all without an admin right (or with no map)', () => {
    meState.data = me(false, undefined);
    const { unmount } = renderRoute(<Sidebar />);
    expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
    unmount();
    meState.data = me(false, { team_management: true });
    renderRoute(<Sidebar />);
    expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
  });

  it('super admin still sees the full section', () => {
    meState.data = me(true, undefined);
    renderRoute(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByRole('link', { name: 'System Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });
});
