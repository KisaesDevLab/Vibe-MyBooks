// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, getAccessToken, isApiError, TOKEN_CHANGE_EVENT } from '../api/client';
import { setActiveCurrency } from '../utils/money';

interface CompanySummary {
  id: string;
  businessName: string;
  setupComplete: boolean;
  currency?: string | null;
}

interface CompanyContextValue {
  activeCompanyId: string | null;
  companies: CompanySummary[];
  activeCompanyName: string;
  setActiveCompany: (companyId: string) => void;
  refreshCompanies: () => void;
  clearActiveCompany: () => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);
const STORAGE_KEY = 'activeCompanyId';

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY),
  );
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const queryClient = useQueryClient();

  const fetchCompanies = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      // Route through apiClient (not raw fetch) so this request inherits
      // the same plumbing every other endpoint uses:
      //
      //  - API_BASE prefix — works under subpath deployments (e.g. the
      //    appliance mounted at `/mb/`). A bare `/api/v1/...` 404s there.
      //  - Automatic 401 refresh+retry — without this, an expired access
      //    token caused the raw fetch to 401, the sidebar's
      //    "Select Company" became sticky for the whole session, and
      //    apiClient-based calls (dashboard, etc.) silently refreshed
      //    around it. That divergence is the bug behind every
      //    intermittent "switcher won't update" report.
      //  - Structured ApiError on non-2xx, so failure modes are
      //    surfaced in the console with the server's actual message
      //    instead of being silently swallowed.
      //
      // Important: we deliberately do NOT add this request to the
      // companyContext middleware's protected set on the server (see
      // company.routes.ts §`/list registered BEFORE companyContext`),
      // because /list is what *recovers* from a bad X-Company-Id. The
      // header is still sent by apiClient, but the server ignores it for
      // /list.
      const data = await apiClient<{ companies: CompanySummary[] }>('/company/list');
      const list: CompanySummary[] = data.companies || [];
      setCompanies(list);

      // Reconcile the locally-cached active company with what the server
      // actually has. A stale id from a previous session (e.g. left behind
      // when the DB was rebuilt or the user now belongs to a different
      // tenant) would otherwise be sent as X-Company-Id on every request
      // and trip a 403 cascade from the company-context middleware.
      const stored = localStorage.getItem(STORAGE_KEY);
      if (list.length > 0) {
        if (!stored || !list.find((c) => c.id === stored)) {
          const firstId = list[0]!.id;
          localStorage.setItem(STORAGE_KEY, firstId);
          setActiveCompanyIdState(firstId);
          // Bust per-company caches so any in-flight query retries with
          // the new id rather than the rejected stale one.
          queryClient.removeQueries();
        }
      } else {
        // Server says this user has no companies. Clear any stale id so we
        // don't keep sending it.
        if (stored) {
          localStorage.removeItem(STORAGE_KEY);
          setActiveCompanyIdState(null);
        }
      }
    } catch (err) {
      // 401/403 from /list almost always means the stored X-Company-Id is
      // stale (different tenant, DB rebuilt, company deleted, or the
      // refresh-token flow itself failed and apiClient gave up). Drop the
      // local id so the next render — and any in-flight apiClient calls —
      // stop sending the bad header.
      if (isApiError(err) && (err.status === 401 || err.status === 403)) {
        if (localStorage.getItem(STORAGE_KEY)) {
          localStorage.removeItem(STORAGE_KEY);
          setActiveCompanyIdState(null);
          queryClient.removeQueries();
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[CompanyProvider] /company/list returned ${err.status}; cleared stale activeCompanyId.`,
        );
        return;
      }
      // Network errors, JSON parse failures, 5xx, etc. The previous
      // version silently swallowed these, which is exactly why the
      // sidebar's "Select Company" was so hard to diagnose — there was
      // no signal anywhere that the underlying request had even failed.
      // eslint-disable-next-line no-console
      console.error('[CompanyProvider] /company/list failed:', err);
    }
  }, [queryClient]);

  // Run on mount AND whenever the access token changes (login, logout,
  // refresh). Without the token-change hook, a provider that first mounted
  // on /login would see no token, return early, and never retry — leaving
  // the stale activeCompanyId in localStorage to trigger 403s forever.
  useEffect(() => {
    fetchCompanies();
    const onTokenChange = () => fetchCompanies();
    window.addEventListener(TOKEN_CHANGE_EVENT, onTokenChange);
    return () => window.removeEventListener(TOKEN_CHANGE_EVENT, onTokenChange);
  }, [fetchCompanies]);

  const setActiveCompany = useCallback((companyId: string) => {
    localStorage.setItem(STORAGE_KEY, companyId);
    setActiveCompanyIdState(companyId);
    // Clear all React Query caches — data will refetch for the new company
    queryClient.removeQueries();
  }, [queryClient]);

  // Used during tenant switching: drop the current company id so the next
  // tenant's CompanyProvider load will auto-pick its own first company
  // instead of carrying the old tenant's id and triggering 403 cascades
  // from the company-context middleware.
  const clearActiveCompany = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveCompanyIdState(null);
    setCompanies([]);
    queryClient.removeQueries();
  }, [queryClient]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const activeCompanyName = activeCompany?.businessName || '';

  // Push the active company's currency into the money formatter's runtime
  // registry whenever the selected company changes. Individual formatMoney
  // calls across the app don't know about CompanyContext — this one-line
  // effect gets them the right currency without threading a prop through
  // every component.
  useEffect(() => {
    setActiveCurrency(activeCompany?.currency || 'USD');
  }, [activeCompany?.currency]);

  return (
    <CompanyContext.Provider value={{
      activeCompanyId,
      companies,
      activeCompanyName,
      setActiveCompany,
      refreshCompanies: fetchCompanies,
      clearActiveCompany,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompanyContext must be used within CompanyProvider');
  return ctx;
}
