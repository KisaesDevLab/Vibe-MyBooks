// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Firm creation is super-admin only (POST /firms), so the "New firm"
// affordance is gated the same way instead of letting the server 403.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const meMock = vi.fn(() => ({ data: { user: { id: 'u1', role: 'owner', isSuperAdmin: false } } }));
vi.mock('../../api/hooks/useAuth', () => ({ useMe: () => meMock() }));
vi.mock('../../api/hooks/useFirms', () => ({
  useFirms: () => ({ data: { firms: [{ id: 'f1', name: 'Smith CPAs', slug: 'smith', isActive: true, superAdminManaged: false }] }, isLoading: false }),
  useCreateFirm: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { FirmListPage } from './FirmListPage';

describe('FirmListPage', () => {
  it('hides "New firm" from non-super-admins', () => {
    renderRoute(<FirmListPage />, { route: '/firm', path: '/firm' });
    expect(screen.getByText('Smith CPAs')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new firm/i })).not.toBeInTheDocument();
  });

  it('shows "New firm" to super admins', () => {
    meMock.mockReturnValueOnce({ data: { user: { id: 'u1', role: 'owner', isSuperAdmin: true } } });
    renderRoute(<FirmListPage />, { route: '/firm', path: '/firm' });
    expect(screen.getByRole('button', { name: /new firm/i })).toBeInTheDocument();
  });
});
