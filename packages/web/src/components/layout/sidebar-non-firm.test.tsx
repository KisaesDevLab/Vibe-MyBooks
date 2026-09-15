// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Banking → Uncategorized is for tenant users who are NOT firm members.
// Firm members and super admins use Practice → Uncategorized instead, and
// readonly cannot suggest, so none of them see the Banking entry.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const meState: { data: unknown } = { data: undefined };
const firmsState: { data: unknown } = { data: { firms: [] } };
vi.mock('../../api/hooks/useAuth', () => ({ useMe: () => meState, useLogout: () => ({ mutate: vi.fn() }) }));
vi.mock('../../api/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('../../api/hooks/useFirms', () => ({ useFirms: () => firmsState }));
vi.mock('./CompanySwitcher', () => ({ CompanySwitcher: () => null }));
vi.mock('./PracticeGroup', () => ({ PracticeGroup: () => null }));
vi.mock('./FirmGroup', () => ({ FirmGroup: () => null }));
vi.mock('./SidebarDisplayControls', () => ({ SidebarDisplayControls: () => null }));

const { Sidebar } = await import('./Sidebar');

const me = (role: string, isSuperAdmin = false) => ({
  user: { id: 'u1', email: 't@example.com', isSuperAdmin, role, userType: 'staff' },
  branding: { appName: 'Vibe MyBooks', isCustomName: false },
});

function renderAndOpenBanking() {
  renderRoute(<Sidebar />);
  const toggle = screen.queryByRole('button', { name: /^Banking$/ });
  if (toggle && toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
}

beforeEach(() => { window.localStorage.clear(); meState.data = undefined; firmsState.data = { firms: [] }; });

describe('sidebar — Banking → Uncategorized', () => {
  it('shows for a non-firm accountant and a bare owner', () => {
    meState.data = me('accountant');
    renderAndOpenBanking();
    expect(screen.getByRole('link', { name: 'Uncategorized' })).toHaveAttribute('href', '/banking/uncategorized');
  });
  it('hides for a firm member', () => {
    meState.data = me('accountant'); firmsState.data = { firms: [{ id: 'f1' }] };
    renderAndOpenBanking();
    expect(screen.queryByRole('link', { name: 'Uncategorized' })).toBeNull();
  });
  it('hides for a super admin', () => {
    meState.data = me('owner', true);
    renderAndOpenBanking();
    expect(screen.queryByRole('link', { name: 'Uncategorized' })).toBeNull();
  });
  it('hides for readonly', () => {
    meState.data = me('readonly');
    renderAndOpenBanking();
    expect(screen.queryByRole('link', { name: 'Uncategorized' })).toBeNull();
  });
});
