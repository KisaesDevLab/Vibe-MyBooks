// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken, TOKEN_CHANGE_EVENT } from '../api/client';
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
      const res = await fetch('/api/v1/company/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
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
    } catch {
      // Ignore errors during initial load
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
