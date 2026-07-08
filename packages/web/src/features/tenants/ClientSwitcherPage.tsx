// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useMemo } from 'react';
import { useMe, type AccessibleTenant } from '../../api/hooks/useAuth';
import { apiClient, setTokens } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Search, Check, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

type SortKey = 'name' | 'role' | 'lastAccessed';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 25;

function fmtLastAccessed(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString();
}

export function ClientSwitcherPage() {
  const { data: meData } = useMe();
  const { clearActiveCompany } = useCompanyContext();
  const queryClient = useQueryClient();

  const tenants = useMemo(() => meData?.accessibleTenants ?? [], [meData]);
  const activeTenantId = meData?.activeTenantId;

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastAccessed');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = q ? tenants.filter((t) => t.tenantName.toLowerCase().includes(q)) : [...tenants];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows = rows.sort((a, b) => {
      let c = 0;
      if (sortKey === 'name') c = a.tenantName.localeCompare(b.tenantName);
      else if (sortKey === 'role') c = (a.role ?? '').localeCompare(b.role ?? '');
      else c = (a.lastAccessedAt ?? '').localeCompare(b.lastAccessedAt ?? '');
      return c * dir;
    });
    return rows;
  }, [tenants, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filteredSorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'lastAccessed' ? 'desc' : 'asc'); }
    setPage(0);
  };

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? null : sortDir === 'asc' ? <ChevronUp className="inline h-3.5 w-3.5" /> : <ChevronDown className="inline h-3.5 w-3.5" />;

  const handleSwitch = async (t: AccessibleTenant) => {
    if (t.tenantId === activeTenantId || switchingId) return;
    setError('');
    setSwitchingId(t.tenantId);
    try {
      const result = await apiClient<{ tokens: { accessToken: string } }>('/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId: t.tenantId }),
      });
      if (!result?.tokens?.accessToken) throw new Error('Server did not return new access tokens.');
      setTokens(result.tokens);
      // Drop the previous tenant's active company so the new tenant's first
      // page load doesn't 403 on a stale X-Company-Id (same fix as the header
      // switcher). Then force a full navigation so every provider/closure is
      // rebuilt with the new tenant context.
      clearActiveCompany();
      queryClient.clear();
      window.onbeforeunload = null;
      window.location.assign(`${window.location.origin}${import.meta.env.BASE_URL}?_switch=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch client.');
      setSwitchingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Users className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Every client (tenant) you have access to. Search, sort, and click a row to switch to it.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search clients…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('name')}>Name {sortIcon('name')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('role')}>Role {sortIcon('role')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('lastAccessed')}>Last accessed {sortIcon('lastAccessed')}</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map((t) => {
              const isActive = t.tenantId === activeTenantId;
              return (
                <tr
                  key={t.tenantId}
                  onClick={() => handleSwitch(t)}
                  className={`hover:bg-gray-50 cursor-pointer ${isActive ? 'bg-primary-50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {t.tenantName}
                    {isActive && <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary-700"><Check className="h-3.5 w-3.5" /> current</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.role ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtLastAccessed(t.lastAccessedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {switchingId === t.tenantId ? (
                      <span className="text-xs text-gray-400">switching…</span>
                    ) : !isActive ? (
                      <span className="text-xs text-primary-600 font-medium">Switch →</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                {search ? 'No clients match your search.' : 'No clients found.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredSorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
          <span>
            Showing {clampedPage * PAGE_SIZE + 1}–{Math.min((clampedPage + 1) * PAGE_SIZE, filteredSorted.length)} of {filteredSorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >Previous</button>
            <span>Page {clampedPage + 1} of {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={clampedPage >= pageCount - 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
