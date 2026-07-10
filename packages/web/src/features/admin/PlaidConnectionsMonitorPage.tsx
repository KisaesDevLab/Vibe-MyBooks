// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { Landmark, CheckCircle, AlertTriangle, XCircle, Clock, AlertCircle, ChevronRight, ChevronDown, Link2, Link2Off, Trash2 } from 'lucide-react';

interface PlaidStats {
  totalItems: number;
  activeItems: number;
  needsAttention: number;
  totalAccounts: number;
  mappedAccounts: number;
}

interface PlaidAccountRow {
  id: string;
  name: string | null;
  mask: string | null;
  accountType: string | null;
  isActive: boolean | null;
  isMapped: boolean;
  tenantId: string | null;
  tenantName: string | null;
  mappedAccountId: string | null;
  mappedAccountName: string | null;
  syncEnabled: boolean | null;
}

interface PlaidConnectionRow {
  id: string;
  institutionName?: string;
  plaidInstitutionId?: string;
  itemStatus: string;
  lastSyncAt?: string | null;
  createdAt: string;
  accounts: PlaidAccountRow[];
  mappedTenantNames: string[];
}

interface PlaidWebhookLog {
  id: string;
  webhookType: string;
  webhookCode?: string;
  receivedAt?: string;
  processed?: boolean;
  error?: string | null;
}

interface TenantOption { id: string; name: string }
interface CoaOption { id: string; name: string; accountNumber: string | null; detailType: string | null }

const statusBadge = (status: string) => {
  switch (status) {
    case 'active': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Active</span>;
    case 'login_required': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" />Login Required</span>;
    case 'pending_disconnect': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="h-3 w-3" />Pending Disconnect</span>;
    case 'error': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle className="h-3 w-3" />Error</span>;
    case 'revoked': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Revoked</span>;
    default: return <span className="text-xs text-gray-500">{status}</span>;
  }
};

// Modal to map a single Plaid account into a tenant's GL account. Tenant and
// account are both super-admin choices (Plaid accounts are system-scoped).
function MapAccountModal({ account, onClose }: { account: PlaidAccountRow; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tenantId, setTenantId] = useState('');
  const [coaAccountId, setCoaAccountId] = useState('');
  const [syncStartDate, setSyncStartDate] = useState('');

  const { data: tenantData } = useQuery({
    queryKey: ['admin', 'plaid-tenants'],
    queryFn: () => apiClient<{ tenants: TenantOption[] }>('/admin/plaid/tenants'),
  });
  const { data: coaData, isLoading: coaLoading } = useQuery({
    queryKey: ['admin', 'plaid-tenant-accounts', tenantId],
    queryFn: () => apiClient<{ accounts: CoaOption[] }>(`/admin/plaid/tenant-accounts?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  const mapMutation = useMutation({
    mutationFn: () => apiClient(`/admin/plaid/accounts/${account.id}/map`, {
      method: 'POST',
      body: JSON.stringify({ tenantId, coaAccountId, syncStartDate: syncStartDate || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-connections'] });
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-stats'] });
      toast.success('Account mapped.');
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not map the account.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Map bank account</h3>
        <p className="text-sm text-gray-600">
          <span className="font-medium">{account.name || 'Account'}</span>
          {account.mask ? ` ··${account.mask}` : ''} → a tenant’s chart-of-accounts entry.
          One bank account maps to one tenant; unmap it first to move it.
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tenant</label>
          <select value={tenantId} onChange={(e) => { setTenantId(e.target.value); setCoaAccountId(''); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select a tenant…</option>
            {(tenantData?.tenants ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Chart of Accounts entry</label>
          <select value={coaAccountId} onChange={(e) => setCoaAccountId(e.target.value)} disabled={!tenantId || coaLoading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50">
            <option value="">{!tenantId ? 'Pick a tenant first' : coaLoading ? 'Loading…' : 'Select an account…'}</option>
            {(coaData?.accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} · ` : ''}{a.name}</option>
            ))}
          </select>
          {tenantId && !coaLoading && (coaData?.accounts?.length ?? 0) === 0 && (
            <p className="text-xs text-amber-600 mt-1">This tenant has no unmapped bank / credit-card / current asset-liability accounts.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Sync start date (optional)</label>
          <input type="date" value={syncStartDate} onChange={(e) => setSyncStartDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Leave blank to import all available history.</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mapMutation.isPending}>Cancel</Button>
          <Button onClick={() => mapMutation.mutate()} loading={mapMutation.isPending} disabled={!tenantId || !coaAccountId}>Map account</Button>
        </div>
      </div>
    </div>
  );
}

export function PlaidConnectionsMonitorPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mapping, setMapping] = useState<PlaidAccountRow | null>(null);

  const { data: stats, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['admin', 'plaid-stats'],
    queryFn: () => apiClient<PlaidStats>('/admin/plaid/stats'),
  });

  const { data: connData, isLoading, isError: connError, refetch: refetchConn } = useQuery({
    queryKey: ['admin', 'plaid-connections'],
    queryFn: () => apiClient<{ connections: PlaidConnectionRow[] }>('/admin/plaid/connections'),
  });

  const { data: logData, isError: logError, refetch: refetchLog } = useQuery({
    queryKey: ['admin', 'plaid-webhook-log'],
    queryFn: () => apiClient<{ logs: PlaidWebhookLog[] }>('/admin/plaid/webhook-log'),
  });

  const unmapMutation = useMutation({
    mutationFn: (v: { plaidAccountId: string; tenantId: string }) =>
      apiClient(`/admin/plaid/accounts/${v.plaidAccountId}/unmap`, { method: 'POST', body: JSON.stringify({ tenantId: v.tenantId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-connections'] });
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-stats'] });
      toast.success('Account unmapped.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not unmap the account.'),
  });

  // Remove the whole connection: revokes the Item at PLAID first (billing
  // stops) and only deletes it here after Plaid confirms. Super-admin passes
  // deleteConnection's permission gate.
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const removeMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiClient(`/plaid/items/${itemId}?deletePendingItems=false`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-connections'] });
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-stats'] });
      toast.success('Connection revoked at Plaid and removed.');
      setConfirmRemove(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Plaid did not confirm the removal — nothing was deleted.'),
  });

  // Escape hatch when Plaid can't confirm (dead token after a cross-host
  // restore, etc.): local-only removal. Offered only after a normal remove
  // attempt fails.
  const forceRemoveMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiClient<{ removed: boolean; plaidRevoked: boolean }>(`/admin/plaid/connections/${itemId}/force`, { method: 'DELETE' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-connections'] });
      qc.invalidateQueries({ queryKey: ['admin', 'plaid-stats'] });
      if (res.plaidRevoked) toast.success('Connection revoked at Plaid and removed.');
      else toast.success('Removed locally — revoke the item from the Plaid dashboard to stop billing.');
      setConfirmRemove(null);
      removeMutation.reset();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Force remove failed.'),
  });

  const toggleRow = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Plaid Connection Monitor</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-3">
        Plaid connections are shared installation-wide. Each bank account is mapped into a single tenant’s books — expand a connection to map or unmap its accounts.
      </p>

      {/* Summary Cards */}
      {statsError ? (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          Failed to load Plaid stats.
          <button onClick={() => refetchStats()} className="ml-2 underline font-medium">Retry</button>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Connections', value: stats.totalItems },
            { label: 'Active', value: stats.activeItems, color: 'text-green-600' },
            { label: 'Needs Attention', value: stats.needsAttention, color: stats.needsAttention > 0 ? 'text-amber-600' : '' },
            { label: 'Total Accounts', value: stats.totalAccounts },
            { label: 'Mapped', value: stats.mappedAccounts },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color || 'text-gray-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Connections Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Connections</h2>
        </div>
        {isLoading ? <LoadingSpinner className="py-8" /> : connError ? (
          <div className="flex items-center gap-2 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            Failed to load connections.
            <button onClick={() => refetchConn()} className="ml-2 underline font-medium">Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-8" />
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Institution</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Mapped Tenants</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Accounts</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Sync</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(connData?.connections || []).map((conn) => {
                  const isOpen = expanded.has(conn.id);
                  const mappedCount = conn.accounts.filter((a) => a.isMapped).length;
                  return (
                    <Fragment key={conn.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(conn.id)}>
                        <td className="px-4 py-3 text-gray-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{conn.institutionName || conn.plaidInstitutionId || 'Unknown'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {conn.mappedTenantNames.length > 0
                            ? conn.mappedTenantNames.join(', ')
                            : <span className="text-gray-400">Unmapped</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{conn.accounts.length} ({mappedCount} mapped)</td>
                        <td className="px-4 py-3">{statusBadge(conn.itemStatus)}</td>
                        <td className="px-4 py-3 text-gray-600">{conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(conn.createdAt).toLocaleDateString()}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-gray-50">
                            <div className="space-y-2">
                              {conn.accounts.length === 0 && <p className="text-xs text-gray-400">No accounts on this connection.</p>}
                              {conn.accounts.map((a) => (
                                <div key={a.id} className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-md px-3 py-2">
                                  <span className="font-medium text-gray-900">{a.name || 'Account'}</span>
                                  {a.mask && <span className="text-gray-400">··{a.mask}</span>}
                                  <span className="text-xs text-gray-400">{a.accountType}</span>
                                  <div className="ml-auto flex items-center gap-3">
                                    {a.isMapped ? (
                                      <>
                                        <span className="text-xs text-gray-600">
                                          <span className="font-medium text-gray-800">{a.tenantName}</span>
                                          {a.mappedAccountName ? ` · ${a.mappedAccountName}` : ''}
                                        </span>
                                        <Button size="sm" variant="ghost"
                                          loading={unmapMutation.isPending && unmapMutation.variables?.plaidAccountId === a.id}
                                          onClick={() => a.tenantId && unmapMutation.mutate({ plaidAccountId: a.id, tenantId: a.tenantId })}>
                                          <Link2Off className="h-4 w-4 mr-1" /> Unmap
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-xs text-gray-400">Unmapped</span>
                                        <Button size="sm" variant="secondary" onClick={() => setMapping(a)}>
                                          <Link2 className="h-4 w-4 mr-1" /> Map to tenant
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {/* Danger zone: remove the whole connection. */}
                              <div className="flex items-center justify-end gap-2 pt-1">
                                {confirmRemove === conn.id ? (
                                  <>
                                    <span className="text-xs text-red-700">
                                      {removeMutation.isError
                                        ? 'Plaid could not confirm the removal. Force-remove deletes it here only — revoke it from the Plaid dashboard to stop billing.'
                                        : 'Revoke this connection at Plaid and remove it (all tenant mappings are deleted)?'}
                                    </span>
                                    <Button size="sm" variant="secondary" onClick={() => { setConfirmRemove(null); removeMutation.reset(); }}>Cancel</Button>
                                    {removeMutation.isError && (
                                      <Button size="sm" variant="danger"
                                        loading={forceRemoveMutation.isPending}
                                        onClick={() => forceRemoveMutation.mutate(conn.id)}>
                                        Force remove (local only)
                                      </Button>
                                    )}
                                    <Button size="sm" variant="danger"
                                      loading={removeMutation.isPending}
                                      onClick={() => removeMutation.mutate(conn.id)}>
                                      Confirm remove
                                    </Button>
                                  </>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(conn.id)}>
                                    <Trash2 className="h-4 w-4 mr-1 text-red-500" /> Remove connection
                                  </Button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {(!connData?.connections || connData.connections.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No Plaid connections</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook Log */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Webhook Log (Last 100)</h2>
        </div>
        {logError ? (
          <div className="flex items-center gap-2 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            Failed to load webhook log.
            <button onClick={() => refetchLog()} className="ml-2 underline font-medium">Retry</button>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(logData?.logs || []).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600 text-xs">{log.receivedAt ? new Date(log.receivedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.webhookType}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.webhookCode}</td>
                  <td className="px-4 py-2">{log.processed ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-gray-400" />}</td>
                </tr>
              ))}
              {(!logData?.logs || logData.logs.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No webhooks received</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {mapping && <MapAccountModal account={mapping} onClose={() => setMapping(null)} />}
    </div>
  );
}
