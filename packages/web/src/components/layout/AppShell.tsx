// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { Menu } from 'lucide-react';
import { ChatFab } from '../../features/chat/ChatFab';
import { ChatProvider } from '../../features/chat/ChatController';
import { useMe } from '../../api/hooks/useAuth';
import { useBranding } from '../../api/hooks/useBranding';

// Desktop sidebar collapse preference — survives sessions. '1' means
// collapsed to the icons-only rail; anything else (including absent)
// means expanded, so the default stays expanded.
const SIDEBAR_COLLAPSED_KEY = 'vibe:sidebar-collapsed';

const DESKTOP_QUERY = '(min-width: 1024px)'; // Tailwind lg breakpoint

function readInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Track the lg breakpoint so ONE hamburger can drive both behaviors:
// mobile → slide-in drawer overlay, desktop → collapse to an icon rail.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const isDesktop = useIsDesktop();
  const { appName } = useBranding();

  // Active tenant (organization) name for the header bar. `activeTenantId`
  // falls back to the user's home tenant; the matching accessibleTenants
  // entry carries the display name.
  const { data: me } = useMe();
  const activeTenantId = me?.activeTenantId ?? me?.user.tenantId;
  const tenantName = me?.accessibleTenants?.find((t) => t.tenantId === activeTenantId)?.tenantName ?? '';

  const toggleSidebar = () => {
    if (isDesktop) {
      setCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
        } catch {
          // ignore quota / privacy-mode errors
        }
        return next;
      });
    } else {
      setSidebarOpen((o) => !o);
    }
  };

  // aria-expanded reflects whatever the button controls on the current
  // breakpoint: the drawer on mobile, the expanded rail on desktop.
  const menuExpanded = isDesktop ? !collapsed : sidebarOpen;

  return (
    <ChatProvider>
    <ImpersonationBanner />
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay — clickable backdrop closes the sidebar.
          Native <button> gives free keyboard support (Enter/Space)
          plus correct focus-ring behavior so the close action is
          reachable without a mouse. aria-label communicates intent
          to screen readers. */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop (full width or icon rail),
          slide-in drawer on mobile. The drawer always shows the FULL
          sidebar (collapsed only applies from lg up), so the width
          classes and the `collapsed` prop are both breakpoint-gated. */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-[transform,width] duration-200 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${collapsed ? 'lg:w-16' : 'lg:w-64'}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} collapsed={isDesktop && collapsed} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Header with the hamburger at the top left. On mobile it opens
            the drawer; on desktop it collapses/expands the icon rail. */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuExpanded}
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          {/* App name shows on mobile (drawer closed) and on desktop when
              the rail hides the sidebar's own title — never twice. */}
          <span className={`text-sm font-semibold text-gray-900 ${collapsed ? '' : 'lg:hidden'}`}>
            {appName}
          </span>
          {/* Active tenant (organization) name, shown in the header on every
              breakpoint. A divider separates it from the app name when both
              are visible. */}
          {tenantName && (
            <span className="flex items-center gap-3 min-w-0">
              <span className={`h-4 w-px bg-gray-300 ${collapsed ? '' : 'lg:hidden'}`} aria-hidden="true" />
              <span className="truncate text-sm font-semibold text-gray-900" title={tenantName}>
                {tenantName}
              </span>
            </span>
          )}
        </div>
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>

      {/* AI chat assistant — only renders if chat is enabled at both
          the system and company level (handled inside ChatFab). */}
      <ChatFab />
    </div>
    </ChatProvider>
  );
}
