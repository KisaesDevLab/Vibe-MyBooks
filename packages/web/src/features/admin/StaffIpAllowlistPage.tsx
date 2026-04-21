// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ShieldAlert, AlertTriangle, Trash2, Plus } from 'lucide-react';

// CLOUDFLARE_TUNNEL_PLAN Phase 6 — super-admin UI for the staff IP
// allowlist. Paired with /admin/ip-allowlist endpoints in
// packages/api/src/routes/admin.routes.ts.

interface AllowlistEntry {
  id: string;
  cidr: string;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface AllowlistResponse {
  enforced: boolean;
  entries: AllowlistEntry[];
}

export function StaffIpAllowlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'ip-allowlist'],
    queryFn: () => apiClient<AllowlistResponse>('/admin/ip-allowlist'),
  });

  const [cidr, setCidr] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const addMutation = useMutation({
    mutationFn: (body: { cidr: string; description: string | null }) =>
      apiClient<AllowlistEntry>('/admin/ip-allowlist', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setCidr('');
      setDescription('');
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'ip-allowlist'] });
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Failed to add entry');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/admin/ip-allowlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'ip-allowlist'] }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cidr.trim();
    if (!trimmed) { setFormError('Enter a CIDR like 203.0.113.0/24 or a single IP.'); return; }
    addMutation.mutate({ cidr: trimmed, description: description.trim() || null });
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load allowlist: {(error as Error)?.message}
        </div>
      </div>
    );
  }

  const enforced = !!data?.enforced;
  const entries = data?.entries || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Staff IP Allowlist</h1>
      </div>

      {/* Enforcement banner. Enforcement is gated by the
          STAFF_IP_ALLOWLIST_ENFORCED env var on the api container —
          populating entries here is always safe; flipping the flag is
          the commit action. */}
      <div className={`rounded-lg border shadow-sm p-4 flex items-start gap-3 ${
        enforced
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <AlertTriangle className={`h-5 w-5 mt-0.5 ${enforced ? 'text-red-700' : 'text-amber-700'}`} />
        <div className="text-sm">
          <p className="font-semibold text-gray-900">
            Enforcement is {enforced ? 'ON' : 'OFF'}.
          </p>
          <p className="text-gray-700 mt-1">
            {enforced
              ? <>Requests from IPs outside the allowlist will get <code className="bg-white/60 px-1 rounded">403 STAFF_IP_BLOCKED</code>. Webhook paths and super-admin sessions bypass this check.</>
              : <>Entries below are inactive until an operator sets <code className="bg-white/60 px-1 rounded">STAFF_IP_ALLOWLIST_ENFORCED=1</code> in the appliance's <code className="bg-white/60 px-1 rounded">.env</code> and restarts the api container.</>
            }
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-800">Add a CIDR</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Input label="CIDR" value={cidr} onChange={(e) => setCidr(e.target.value)}
              placeholder="203.0.113.0/24 or 2001:db8::/32" required />
            <Input label="Description (optional)" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., main office" />
            <Button type="submit" loading={addMutation.isPending} disabled={!cidr.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </form>
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Entries ({entries.length})
          </h2>
          {entries.length === 0 && enforced && (
            <p className="text-xs text-amber-700 mt-1">
              Enforcement is ON but the list is empty. The middleware's cold-start safety allows all traffic while the list is empty — populate at least one entry before relying on the lockdown.
            </p>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No CIDRs configured.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">CIDR</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Added</th>
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-gray-900">{entry.cidr}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.description ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Remove ${entry.cidr}?`)) deleteMutation.mutate(entry.id); }}
                      className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-500 max-w-2xl">
        Break-glass: super-admin sessions bypass this allowlist so an operator locked out of their office can always recover. Webhook paths (<code>/api/v1/stripe</code>, <code>/api/v1/plaid/webhooks</code>) are exempt by routing order — external machine-to-machine traffic is never affected.
      </div>
    </div>
  );
}
