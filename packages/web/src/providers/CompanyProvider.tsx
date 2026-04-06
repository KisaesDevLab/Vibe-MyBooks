import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '../api/client';

interface CompanySummary {
  id: string;
  businessName: string;
  setupComplete: boolean;
}

interface CompanyContextValue {
  activeCompanyId: string | null;
  companies: CompanySummary[];
  activeCompanyName: string;
  setActiveCompany: (companyId: string) => void;
  refreshCompanies: () => void;
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

      // Validate stored companyId
      const stored = localStorage.getItem(STORAGE_KEY);
      if (list.length > 0) {
        if (!stored || !list.find((c) => c.id === stored)) {
          // Default to first company
          const firstId = list[0]!.id;
          localStorage.setItem(STORAGE_KEY, firstId);
          setActiveCompanyIdState(firstId);
        }
      }
    } catch {
      // Ignore errors during initial load
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const setActiveCompany = useCallback((companyId: string) => {
    localStorage.setItem(STORAGE_KEY, companyId);
    setActiveCompanyIdState(companyId);
    // Clear all React Query caches — data will refetch for the new company
    queryClient.removeQueries();
  }, [queryClient]);

  const activeCompanyName = companies.find((c) => c.id === activeCompanyId)?.businessName || '';

  return (
    <CompanyContext.Provider value={{
      activeCompanyId,
      companies,
      activeCompanyName,
      setActiveCompany,
      refreshCompanies: fetchCompanies,
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
