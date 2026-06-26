// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { PortalFirmSwitcher, type LinkedContact } from './PortalFirmSwitcher';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 9.5 — portal UI shell.
// Mobile-first, separate visual identity from the firm app.

export interface PortalMe {
  contact: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    companies: Array<{
      companyId: string;
      companyName: string;
      role: string;
      assignable: boolean;
      financialsAccess: boolean;
      filesAccess: boolean;
      questionsForUsAccess: boolean;
    }>;
  };
  preview: {
    isPreview: true;
    previewSessionId: string;
    companyId: string;
  } | null;
}

const ME_KEY = 'kisbooks-portal-me';
const ACTIVE_COMPANY_KEY = 'kisbooks-portal-active-company';

async function fetchPortalMe(): Promise<PortalMe | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/portal/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to load portal session');
  return res.json();
}

// PORTAL_IDENTITY_LINKING_V1 — returns the list of sibling firm
// contacts the current identity can switch to. Server returns
// { contacts: [] } when the session isn't identity-linked or the
// flag is off; the layout uses that to hide the switcher entirely.
async function fetchLinkedContacts(): Promise<LinkedContact[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/portal/auth/linked-contacts`, { credentials: 'include' });
  if (res.status === 401) return [];
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[PortalLayout] linked-contacts returned ${res.status}; switcher will stay hidden.`);
    return [];
  }
  const body = (await res.json()) as { contacts?: LinkedContact[] };
  return body.contacts ?? [];
}

export function PortalLayout() {
  const navigate = useNavigate();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_COMPANY_KEY),
  );
  // PORTAL_IDENTITY_LINKING_V1 — empty when the session is unlinked
  // or the flag is off. Switcher renders only with >1 entries.
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);

  useEffect(() => {
    // 18.1 — register the service worker once when the portal layout
    // first mounts. SW registration only succeeds on HTTPS or
    // localhost; on plain HTTP it throws and we silently ignore.
    // BASE_URL prefix matters for appliance subpath installs: when the
    // SPA is mounted at /mybooks/, the SW lives at /mybooks/portal-sw.js
    // with scope /mybooks/portal/ — hardcoding the root paths breaks
    // registration on those installs.
    if ('serviceWorker' in navigator) {
      const base = import.meta.env.BASE_URL;
      navigator.serviceWorker
        .register(`${base}portal-sw.js`, { scope: `${base}portal/` })
        .catch(() => {
          // expected on HTTP origins — not a hard failure
        });
    }
    let cancelled = false;
    // Fire /me and /linked-contacts in parallel — they're independent
    // and the layout doesn't need /linked-contacts to render initial
    // content (the switcher only shows after both resolve).
    fetchLinkedContacts()
      .then((list) => {
        if (!cancelled) setLinkedContacts(list);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[PortalLayout] linked-contacts fetch failed:', err);
      });
    fetchPortalMe()
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        if (!data) {
          navigate('/portal/login', { replace: true });
        } else {
          // Hydrate the active company if missing or invalid.
          const valid = data.contact.companies.find((c) => c.companyId === activeCompanyId);
          if (!valid && data.contact.companies[0]) {
            const next = data.contact.companies[0].companyId;
            setActiveCompanyId(next);
            localStorage.setItem(ACTIVE_COMPANY_KEY, next);
          }
          try {
            sessionStorage.setItem(ME_KEY, JSON.stringify(data));
          } catch {
            // ignore quota
          }
        }
      })
      .catch((err) => {
        console.error('portal /me failed', err);
        navigate('/portal/login', { replace: true });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    // Best-effort server logout — if it fails we still clear local state
    // and navigate to login, because trapping the user on an authenticated
    // page when their session might be invalid is worse than a stranded
    // server-side session (which will expire on its own). Log so the
    // failure is debuggable without surfacing it as a user-facing error.
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/auth/logout`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[PortalLayout] logout returned ${res.status}; clearing local state anyway.`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[PortalLayout] logout request failed; clearing local state anyway:', err);
    }
    sessionStorage.removeItem(ME_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    navigate('/portal/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }
  if (!me) return null;

  const fullName =
    [me.contact.firstName, me.contact.lastName].filter(Boolean).join(' ') || me.contact.email;
  const activeCompany = me.contact.companies.find((c) => c.companyId === activeCompanyId);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {me.preview && (
        <div
          className="px-4 py-2 text-sm font-medium text-white sticky top-0 z-40 flex items-center justify-between gap-3"
          style={{ background: '#7c3aed' }}
        >
          <span>
            Preview mode — viewing as {fullName}
            {activeCompany ? ` at ${activeCompany.companyName}` : ''} · Actions are simulated
          </span>
          <button
            onClick={async () => {
              // Best-effort cleanup of the server-side preview session. If
              // it fails we still close/redirect — the preview cookie's
              // TTL bounds the worst-case exposure, and keeping the staff
              // user stuck in preview mode is a worse UX failure.
              try {
                const res = await fetch(`${import.meta.env.BASE_URL}api/v1/practice/portal/preview/end`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
                  },
                  body: JSON.stringify({ previewSessionId: me.preview!.previewSessionId }),
                });
                if (!res.ok) {
                  // eslint-disable-next-line no-console
                  console.warn(`[PortalLayout] preview/end returned ${res.status}.`);
                }
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[PortalLayout] preview/end request failed:', err);
              }
              window.close();
              // If the tab can't close itself (no opener), redirect to admin.
              // BASE_URL prefix preserves correctness on appliance subpath
              // mounts (the SPA at /mybooks/ resolves /mybooks/practice/...).
              window.location.href = `${import.meta.env.BASE_URL}practice/client-portal`;
            }}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-semibold"
          >
            Exit Preview
          </button>
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/portal" className="flex items-center gap-2">
            <span className="font-semibold text-base text-gray-900">Client Portal</span>
          </Link>
          <div className="flex items-center gap-3">
            {linkedContacts.length > 1 && !me.preview && (
              <PortalFirmSwitcher
                linkedContacts={linkedContacts}
                activeContactId={me.contact.id}
              />
            )}
            {me.contact.companies.length > 1 ? (
              <select
                value={activeCompanyId ?? ''}
                onChange={(e) => {
                  setActiveCompanyId(e.target.value);
                  localStorage.setItem(ACTIVE_COMPANY_KEY, e.target.value);
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                {me.contact.companies.map((c) => (
                  <option key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-600">{activeCompany?.companyName ?? ''}</span>
            )}
            <button
              onClick={logout}
              title="Sign out"
              className="text-gray-500 hover:text-gray-800 p-1"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <PortalContext.Provider value={{ me, activeCompanyId, fullName, refresh: () => fetchPortalMe().then(setMe) }}>
          <Outlet />
        </PortalContext.Provider>
      </main>

      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        Powered by Vibe MyBooks
      </footer>
    </div>
  );
}

import { createContext, useContext } from 'react';

export interface PortalContextValue {
  me: PortalMe;
  activeCompanyId: string | null;
  fullName: string;
  refresh: () => Promise<unknown>;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be inside a PortalLayout');
  return ctx;
}

export default PortalLayout;
