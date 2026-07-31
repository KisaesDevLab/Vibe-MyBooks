// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
//
// The admin tenant/user directories used to fetch the whole table in one
// unpaged request and filter it in the browser, so large installs rendered a
// wall of rows with no way to move through them. Both pages now drive the
// limit/offset/search query params on the API.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { TenantListPage } from './TenantListPage';
import { UserListPage } from './UserListPage';

const TOTAL = 120;

const tenantRow = (i: number) => ({
  id: `t${i}`, name: `Tenant ${i}`, slug: `tenant-${i}`,
  userCount: 1, companyCount: 1, transactionCount: 0,
  isActive: true, createdAt: '2026-01-01T00:00:00.000Z',
});

const userRow = (i: number) => ({
  id: `u${i}`, email: `user${i}@example.com`, displayName: `User ${i}`,
  tenantName: 'Tenant 0', tenantId: 't0', role: 'owner',
  isActive: true, isSuperAdmin: false, lastLoginAt: null,
});

// Echo back a page of rows sized to whatever ?limit= the page asked for.
function pageOf<T>(path: string, make: (i: number) => T): T[] {
  const params = new URLSearchParams(path.split('?')[1] ?? '');
  const limit = Math.min(parseInt(params.get('limit') || '50', 10), TOTAL);
  const offset = parseInt(params.get('offset') || '0', 10);
  return Array.from({ length: Math.max(0, Math.min(limit, TOTAL - offset)) }, (_, i) => make(offset + i));
}

/** Query params of the most recent GET to `prefix`. */
function lastQuery(prefix: string): URLSearchParams {
  const call = [...apiClientMock.mock.calls].reverse()
    .find((args) => typeof args[0] === 'string' && args[0].startsWith(`${prefix}?`));
  return new URLSearchParams(String(call?.[0]).split('?')[1]);
}

beforeEach(() => {
  apiClientMock.mockReset();
  apiClientMock.mockImplementation((path: string) => {
    if (path.startsWith('/admin/tenants')) {
      return Promise.resolve({ tenants: pageOf(path, tenantRow), total: TOTAL });
    }
    if (path.startsWith('/admin/users')) {
      return Promise.resolve({ users: pageOf(path, userRow), total: TOTAL });
    }
    return Promise.resolve({});
  });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')));
});

describe('TenantListPage pagination', () => {
  it('pages through tenants and changes the rows-per-page', async () => {
    renderRoute(<TenantListPage />, { route: '/admin/tenants', path: '/admin/tenants' });

    await screen.findByText('Tenant 0');
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(lastQuery('/admin/tenants').get('limit')).toBe('50');
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Tenant 50');
    expect(lastQuery('/admin/tenants').get('offset')).toBe('50');
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(lastQuery('/admin/tenants').get('offset')).toBe('0'));

    // Changing the page size refetches from page 1.
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } });
    await waitFor(() => expect(lastQuery('/admin/tenants').get('limit')).toBe('25'));
    expect(lastQuery('/admin/tenants').get('offset')).toBe('0');
    await screen.findByText('Page 1 of 5');
  });

  it('pushes the search term to the API instead of filtering one page', async () => {
    renderRoute(<TenantListPage />, { route: '/admin/tenants', path: '/admin/tenants' });
    await screen.findByText('Tenant 0');

    fireEvent.change(screen.getByPlaceholderText('Search tenants...'), { target: { value: 'acme' } });

    await waitFor(() => expect(lastQuery('/admin/tenants').get('search')).toBe('acme'));
    expect(lastQuery('/admin/tenants').get('offset')).toBe('0');
  });
});

describe('UserListPage pagination', () => {
  it('pages through users and changes the rows-per-page', async () => {
    renderRoute(<UserListPage />, { route: '/admin/users', path: '/admin/users' });

    await screen.findByText('user0@example.com');
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('user50@example.com');
    expect(lastQuery('/admin/users').get('offset')).toBe('50');

    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '100' } });
    await waitFor(() => expect(lastQuery('/admin/users').get('limit')).toBe('100'));
    expect(lastQuery('/admin/users').get('offset')).toBe('0');
  });

  it('pushes the search term to the API', async () => {
    renderRoute(<UserListPage />, { route: '/admin/users', path: '/admin/users' });
    await screen.findByText('user0@example.com');

    fireEvent.change(screen.getByPlaceholderText('Search users...'), { target: { value: 'bob@' } });

    await waitFor(() => expect(lastQuery('/admin/users').get('search')).toBe('bob@'));
  });
});
