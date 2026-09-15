// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// useFirmCapabilities fails CLOSED: no /me, no map, or an old server → no
// rights. Owner / super admin pass canOwnerAction on their own.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const meState: { data: unknown } = { data: undefined };
vi.mock('./useAuth', () => ({ useMe: () => meState }));

const { useFirmCapabilities } = await import('./useFirmCapabilities');

beforeEach(() => { meState.data = undefined; });

describe('useFirmCapabilities', () => {
  it('grants nothing while /me is loading', () => {
    const { result } = renderHook(() => useFirmCapabilities());
    expect(result.current.ready).toBe(false);
    expect(result.current.hasTenantCap('team_management')).toBe(false);
    expect(result.current.hasAdminCap('admin_tenant_ops')).toBe(false);
    expect(result.current.isDelegatedAdmin).toBe(false);
    expect(result.current.canOwnerAction('team_management')).toBe(false);
  });

  it('grants nothing when the server sends no firmCapabilities (pre-capability server)', () => {
    meState.data = { user: { id: 'u1', role: 'accountant', isSuperAdmin: false } };
    const { result } = renderHook(() => useFirmCapabilities());
    expect(result.current.ready).toBe(true);
    expect(result.current.canOwnerAction('check_signatures')).toBe(false);
    expect(result.current.isDelegatedAdmin).toBe(false);
  });

  it('reads tenant and admin maps; admin map drives isDelegatedAdmin', () => {
    meState.data = {
      user: { id: 'u1', role: 'accountant', isSuperAdmin: false },
      firmCapabilities: { tenant: { team_management: true }, admin: { admin_tenant_ops: true } },
    };
    const { result } = renderHook(() => useFirmCapabilities());
    expect(result.current.hasTenantCap('team_management')).toBe(true);
    expect(result.current.hasTenantCap('check_signatures')).toBe(false);
    expect(result.current.canOwnerAction('team_management')).toBe(true);
    expect(result.current.hasAdminCap('admin_tenant_ops')).toBe(true);
    expect(result.current.hasAdminCap('admin_user_support')).toBe(false);
    expect(result.current.isDelegatedAdmin).toBe(true);
  });

  it('tenant-only rights do not make a delegated admin', () => {
    meState.data = {
      user: { id: 'u1', role: 'accountant', isSuperAdmin: false },
      firmCapabilities: { tenant: { team_management: true }, admin: { team_management: true } },
    };
    const { result } = renderHook(() => useFirmCapabilities());
    expect(result.current.isDelegatedAdmin).toBe(false);
  });

  it('owner and super admin pass canOwnerAction without any map; super admin is never "delegated"', () => {
    meState.data = { user: { id: 'u1', role: 'owner', isSuperAdmin: false } };
    expect(renderHook(() => useFirmCapabilities()).result.current.canOwnerAction('screen_share_admin')).toBe(true);
    meState.data = {
      user: { id: 'u1', role: 'accountant', isSuperAdmin: true },
      firmCapabilities: { tenant: {}, admin: { admin_user_support: true } },
    };
    const { result } = renderHook(() => useFirmCapabilities());
    expect(result.current.canOwnerAction('screen_share_admin')).toBe(true);
    expect(result.current.isDelegatedAdmin).toBe(false);
    expect(result.current.isSuperAdmin).toBe(true);
  });
});
