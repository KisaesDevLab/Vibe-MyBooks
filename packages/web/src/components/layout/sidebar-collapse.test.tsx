// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Collapsible sidebar (hamburger at the top left of the header):
//   - desktop: toggles the icons-only rail, persists to localStorage
//     ('vibe:sidebar-collapsed'), aria-expanded tracks the state
//   - collapsed rail still renders every nav item (icon + aria-label)
//   - mobile: the same button drives the slide-in drawer and does NOT
//     touch the collapse preference

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => ({
    data: {
      user: { id: 'u1', email: 't@example.com', isSuperAdmin: false, role: 'owner', userType: 'staff' },
      branding: { appName: 'Vibe MyBooks', isCustomName: false },
    },
  }),
  useLogout: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../api/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));
// Composite widgets with their own data needs — not under test here.
vi.mock('./CompanySwitcher', () => ({ CompanySwitcher: () => null }));
vi.mock('./PracticeGroup', () => ({ PracticeGroup: () => null }));
vi.mock('./FirmGroup', () => ({ FirmGroup: () => null }));
// Real TrialBalanceGroup (a self-owned collapse state) with one item, so
// the title's collapse-all broadcast is exercised end to end.
vi.mock('../../hooks/useTrialBalanceVisibility', () => ({
  useTrialBalanceVisibility: () => ({
    ready: true,
    showGroup: true,
    items: [{ key: 'workpaper', label: 'Workpaper', path: '/tb/workpaper', minRole: 'bookkeeper' }],
  }),
}));
vi.mock('./SidebarDisplayControls', () => ({ SidebarDisplayControls: () => null }));
vi.mock('../../features/chat/ChatFab', () => ({ ChatFab: () => null }));
vi.mock('../../features/chat/ChatController', () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AppShell } from './AppShell';

// AppShell reads matchMedia('(min-width: 1024px)') to decide whether the
// hamburger collapses the rail (desktop) or opens the drawer (mobile).
function setViewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('collapsible sidebar', () => {
  it('desktop: hamburger collapses to an icon rail and persists the preference', () => {
    setViewport(true);
    renderRoute(<AppShell />);

    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    // Default expanded.
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Collapse → aria + localStorage flip, labels give way to icon links.
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem('vibe:sidebar-collapsed')).toBe('1');
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    // The rail ignores per-group collapse, so items from a group that
    // starts collapsed (Reporting) are still reachable as icons.
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();

    // Expand again → back to labeled items, preference updated.
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(window.localStorage.getItem('vibe:sidebar-collapsed')).toBe('0');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    // Reporting group is collapsed by default in the expanded sidebar.
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
  });

  it('desktop: persisted preference restores the rail on mount', () => {
    setViewport(true);
    window.localStorage.setItem('vibe:sidebar-collapsed', '1');
    renderRoute(<AppShell />);

    expect(screen.getByRole('button', { name: 'Toggle menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('mobile: the hamburger drives the drawer and leaves the preference alone', () => {
    setViewport(false);
    renderRoute(<AppShell />);

    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    // Drawer starts closed.
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Drawer shows the FULL sidebar (labels, not the rail)…
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    // …and the desktop collapse preference is untouched.
    expect(window.localStorage.getItem('vibe:sidebar-collapsed')).toBeNull();

    // Backdrop close button appears with the open drawer.
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking the app title collapses every menu group and persists it', () => {
    setViewport(true);
    renderRoute(<AppShell />);

    // Defaults: Transactions + Trial Balance open, Reporting closed.
    expect(screen.getByRole('link', { name: 'Registers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Workpaper' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Reporting$/i }));
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all menu groups' }));

    expect(screen.queryByRole('link', { name: 'Registers' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Workpaper' })).toBeNull();
    // Unlabeled top group (Dashboard) has no header, so it stays reachable.
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem('sidebar-collapsed-groups') ?? '{}') as Record<string, boolean>;
    expect(stored['Transactions']).toBe(true);
    expect(stored['Reporting']).toBe(true);
    expect(stored['Manage']).toBe(true);
    expect(window.localStorage.getItem('tb-group-collapsed')).toBe('1');
  });
});
