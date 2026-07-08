// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building, Search, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  useAssignableTenants,
  useAssignTenantToFirm,
  useFirm,
  useFirmTenants,
  useUnassignTenantFromFirm,
} from '../../api/hooks/useFirms';
import { FirmTabs } from './FirmTabs';

// 3-tier rules plan, Phase 1 — managed-tenants page. 1:N: at most
// one ACTIVE assignment per tenant. Soft-detach preserves history.
export function FirmTenantsPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const firm = useFirm(firmId ?? null);
  const { data, isLoading } = useFirmTenants(firmId ?? null);
  const assign = useAssignTenantToFirm(firmId ?? '');
  const unassign = useUnassignTenantFromFirm(firmId ?? '');

  const [assignOpen, setAssignOpen] = useState(false);

  if (!firmId) return null;

  const assignments = data?.assignments ?? [];
  const active = assignments.filter((a) => a.isActive);
  const inactive = assignments.filter((a) => !a.isActive);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{firm.data?.name ?? 'Firm'}</h1>
        <FirmTabs firmId={firmId} active="tenants" />
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Managed tenants</h2>
          <p className="text-xs text-gray-500">
            Tenants assigned to this firm receive the firm&apos;s tenant_firm and
            global_firm rules.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAssignOpen(true)}>
          <Building className="h-4 w-4 mr-1" />
          Assign tenant
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner size="md" />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Active ({active.length})
            </h3>
            {active.length === 0 ? (
              <p className="text-xs italic text-gray-500">No active tenants.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">Tenant</th>
                      <th className="px-3 py-2">Slug</th>
                      <th className="px-3 py-2">Assigned</th>
                      <th className="px-3 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {active.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{a.tenantName}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{a.tenantSlug}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {new Date(a.assignedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Un-assign ${a.tenantName}? Firm and global rules will stop applying to this tenant.`,
                                )
                              ) {
                                unassign.mutate(a.tenantId);
                              }
                            }}
                            aria-label={`Un-assign ${a.tenantName}`}
                            className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {inactive.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Past assignments ({inactive.length})
              </h3>
              <ul className="text-xs text-gray-500 font-mono">
                {inactive.map((a) => (
                  <li key={a.id}>
                    {a.tenantName} — {new Date(a.assignedAt).toLocaleDateString()} (detached)
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {assignOpen && (
        <AssignTenantDialog
          firmId={firmId}
          onSubmit={async (tenantId, force) => {
            await assign.mutateAsync({ tenantId, force });
            setAssignOpen(false);
          }}
          onClose={() => setAssignOpen(false)}
          isPending={assign.isPending}
        />
      )}
    </div>
  );
}

function AssignTenantDialog({
  firmId,
  onSubmit,
  onClose,
  isPending,
}: {
  firmId: string;
  onSubmit: (tenantId: string, force: boolean) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}) {
  const { data, isLoading } = useAssignableTenants(firmId, true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenants = data?.tenants ?? [];
  const q = query.trim().toLowerCase();
  const matches = q
    ? tenants.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
    : tenants;

  const handle = async () => {
    if (!selected) return;
    setError(null);
    try {
      await onSubmit(selected, force);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Assign tenant</h2>
        <p className="text-xs text-gray-500">
          Pick a tenant to bring under this firm. Only tenants you own or are the accountant on (and
          that aren&apos;t already assigned here) are shown.
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 py-1.5 text-sm"
            placeholder="Search tenants by name or slug…"
            autoFocus
          />
        </div>

        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : tenants.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No assignable tenants. You can only assign tenants you own or are the accountant on that
            aren&apos;t already managed by this firm.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">No tenants match “{query}”.</p>
            ) : (
              matches.map((t) => (
                <button
                  key={t.tenantId}
                  type="button"
                  onClick={() => setSelected(t.tenantId)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 ${
                    selected === t.tenantId ? 'bg-primary-50' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-900">{t.name}</span>
                    <span className="block truncate font-mono text-[11px] text-gray-500">{t.slug}</span>
                  </span>
                  {selected === t.tenantId && (
                    <span className="ml-2 text-xs font-medium text-primary-600">Selected</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span className="text-xs text-gray-700">
            Force reassign (soft-detaches any existing managing firm)
          </span>
        </label>
        {error && <p className="text-xs text-rose-700">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handle} disabled={isPending || !selected}>
            {isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>
    </div>
  );
}
