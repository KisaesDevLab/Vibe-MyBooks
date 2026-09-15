// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { FIRM_CAPABILITIES } from '@kis-books/shared';
import type { FirmUserWithProfile } from '@kis-books/shared';
import { renderRoute } from '../../test-utils';

const capsState: { data: unknown; isLoading: boolean; error: unknown } = { data: undefined, isLoading: false, error: null };
const mutateAsync = vi.fn();
vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => ({ data: { user: { id: 'me', role: 'accountant', isSuperAdmin: false } } }),
}));
vi.mock('../../api/hooks/useFirms', () => ({
  useFirmUserCapabilities: () => capsState,
  useSetFirmUserCapabilities: () => ({ mutateAsync, isPending: false }),
}));

const { FirmMemberCapabilitiesDrawer } = await import('./FirmMemberCapabilitiesDrawer');

const allFalse = Object.fromEntries(FIRM_CAPABILITIES.map((c) => [c.key, false]));
const member = (firmRole: FirmUserWithProfile['firmRole']): FirmUserWithProfile => ({
  id: 'fu1', firmId: 'f1', userId: 'u2', firmRole, isActive: true, createdAt: '2026-01-01T00:00:00Z',
  email: 'staff@firm.com', displayName: 'Staffer', capabilities: allFalse as FirmUserWithProfile['capabilities'], capabilitiesCustomized: false,
});

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({});
  capsState.data = { firmUserId: 'fu1', userId: 'u2', firmRole: 'firm_staff', capabilities: allFalse, capabilitiesCustomized: false, stored: null, updatedAt: null };
  capsState.isLoading = false;
  capsState.error = null;
});

describe('FirmMemberCapabilitiesDrawer', () => {
  it('renders one checkbox per catalog entry and saves the draft', async () => {
    const onClose = vi.fn();
    renderRoute(<FirmMemberCapabilitiesDrawer firmId="f1" firmUser={member('firm_staff')} superAdminManaged={false} onClose={onClose} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(FIRM_CAPABILITIES.length);
    expect(screen.getByText('Using role defaults')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Team management' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({ firmUserId: 'fu1', capabilities: { ...allFalse, team_management: true }, isSelf: false });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('"Reset to role defaults" PUTs null and is only enabled when customized', async () => {
    capsState.data = { ...(capsState.data as object), capabilitiesCustomized: true, stored: {} };
    renderRoute(<FirmMemberCapabilitiesDrawer firmId="f1" firmUser={member('firm_staff')} superAdminManaged={false} onClose={vi.fn()} />);
    expect(screen.getByText('Customized')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to role defaults' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ capabilities: null })));
  });

  it('firm_readonly member: everything disabled with an explanation', () => {
    renderRoute(<FirmMemberCapabilitiesDrawer firmId="f1" firmUser={member('firm_readonly')} superAdminManaged={false} onClose={vi.fn()} />);
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText(/Read-only firm members can/)).toBeInTheDocument();
  });

  it('super-admin-managed firm locks the editor for a non-super-admin', () => {
    renderRoute(<FirmMemberCapabilitiesDrawer firmId="f1" firmUser={member('firm_admin')} superAdminManaged onClose={vi.fn()} />);
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
    expect(screen.getByText(/managed by the system administrator/)).toBeInTheDocument();
  });

  it('maps FIRM_SUPER_ADMIN_MANAGED save errors to friendly text', async () => {
    const { ApiError } = await import('../../api/client');
    mutateAsync.mockRejectedValue(new ApiError('This firm is managed by the system administrator', 'FIRM_SUPER_ADMIN_MANAGED', undefined, 403));
    renderRoute(<FirmMemberCapabilitiesDrawer firmId="f1" firmUser={member('firm_staff')} superAdminManaged={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText(/only they can change member access rights/)).toBeInTheDocument());
  });
});
