// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Admin user directory: the list paginates, so sort and the Role / Active
// header filters go to the server as query params.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const { apiClientMock } = vi.hoisted(() => ({ apiClientMock: vi.fn() }));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});
vi.mock('../../api/hooks/useFirmCapabilities', () => ({
  useFirmCapabilities: () => ({ isSuperAdmin: true, can: () => true, capabilities: {} }),
}));

import { UserListPage } from './UserListPage';

const users = [
  { id: 'u1', email: 'a@x.com', displayName: 'A', tenantName: 'T', tenantId: 't1', role: 'owner', isActive: true, isSuperAdmin: false, lastLoginAt: null },
  { id: 'u2', email: 'b@x.com', displayName: 'B', tenantName: 'T', tenantId: 't1', role: 'bookkeeper', isActive: false, isSuperAdmin: false, lastLoginAt: null },
];

function lastQuery(): URLSearchParams {
  const call = [...apiClientMock.mock.calls].reverse().find((a) => typeof a[0] === 'string' && String(a[0]).startsWith('/admin/users?'));
  return new URLSearchParams(String(call?.[0]).split('?')[1]);
}

beforeEach(() => {
  sessionStorage.clear();
  apiClientMock.mockReset();
  apiClientMock.mockImplementation((path: string) => {
    if (path.startsWith('/admin/users')) return Promise.resolve({ users, total: users.length });
    if (path.startsWith('/admin/tenants')) return Promise.resolve({ tenants: [], total: 0 });
    return Promise.resolve({});
  });
});

describe('UserListPage — sort and filters', () => {
  it('a header click sends sortBy/sortDir with the offset reset', async () => {
    renderRoute(<UserListPage />, { route: '/admin/users', path: '/admin/users' });
    await screen.findByText('a@x.com');
    expect(lastQuery().get('sortBy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^email/i }));
    await waitFor(() => expect(lastQuery().get('sortBy')).toBe('email'));
    expect(lastQuery().get('sortDir')).toBe('asc');
    expect(lastQuery().get('offset')).toBe('0');
  });

  it('Role and Active popovers become roles / isActive params, with role options from the rows', async () => {
    renderRoute(<UserListPage />, { route: '/admin/users', path: '/admin/users' });
    await screen.findByText('a@x.com');
    fireEvent.click(screen.getByRole('button', { name: 'Filter Role' }));
    fireEvent.click(screen.getByLabelText('bookkeeper'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(lastQuery().get('roles')).toBe('bookkeeper'));
    fireEvent.click(screen.getByRole('button', { name: 'Filter Active' }));
    fireEvent.click(screen.getByLabelText('Inactive'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(lastQuery().get('isActive')).toBe('false'));
  });
});
