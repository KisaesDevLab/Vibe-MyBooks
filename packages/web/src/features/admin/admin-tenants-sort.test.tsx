// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tenants list: sort is server-side (the list paginates), so a header click
// must reach GET /admin/tenants as sortBy/sortDir with the offset back at 0.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { TenantListPage } from './TenantListPage';

const row = { id: 't1', name: 'Acme', slug: 'acme', userCount: 2, companyCount: 1, transactionCount: 5, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', firmId: null, firmName: null };

function lastQuery(): URLSearchParams {
  const call = [...apiClientMock.mock.calls].reverse().find((a) => String(a[0]).startsWith('/admin/tenants?'));
  return new URLSearchParams(String(call?.[0]).split('?')[1]);
}

beforeEach(() => {
  sessionStorage.clear();
  apiClientMock.mockReset();
  apiClientMock.mockImplementation((path: string) =>
    Promise.resolve(path.startsWith('/admin/tenants') ? { tenants: [row], total: 1 } : { firms: [] }));
});

describe('TenantListPage — column sort', () => {
  it('sends the header sort to the server and resets the offset', async () => {
    renderRoute(<TenantListPage />, { route: '/admin/tenants', path: '/admin/tenants' });
    await screen.findByText('Acme');
    expect(lastQuery().get('sortBy')).toBe('name');
    expect(lastQuery().get('sortDir')).toBe('asc');
    fireEvent.click(screen.getByRole('button', { name: /^users/i }));
    await waitFor(() => expect(lastQuery().get('sortBy')).toBe('userCount'));
    expect(lastQuery().get('sortDir')).toBe('desc');   // counts open descending
    expect(lastQuery().get('offset')).toBe('0');
    expect(JSON.parse(sessionStorage.getItem('vibe:admin-tenants:view')!)).toMatchObject({ sortCol: 'userCount', sortDir: 'desc' });
  });
});
