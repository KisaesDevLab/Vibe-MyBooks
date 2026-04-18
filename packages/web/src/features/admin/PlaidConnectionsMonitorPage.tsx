// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Landmark, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface PlaidStats {
  totalItems: number;
  activeItems: number;
  needsAttention: number;
  totalAccounts: number;
  mappedAccounts: number;
}

interface PlaidConnectionRow {
  id: string;
  institutionName: string;
  plaidInstitutionId?: string;
  tenantId?: string;
  tenantName?: string;
  itemStatus: string;
  lastSyncAt?: string | null;
  createdAt: string;
  accounts?: Array<{ id: string; isMapped: boolean }>;
  [key: string]: unknown;
}

interface PlaidWebhookLog {
  id: string;
  webhookType: string;
  webhookCode?: string;
  itemId?: string;
  receivedAt?: string;
  processedAt?: string;
  processed?: boolean;
  error?: string | null;
  [key: string]: unknown;
}

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

export function PlaidConnectionsMonitorPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'plaid-stats'],
    queryFn: () => apiClient<PlaidStats>('/admin/plaid/stats'),
  });

  const { data: connData, isLoading } = useQuery({
    queryKey: ['admin', 'plaid-connections'],
    queryFn: () => apiClient<{ connections: PlaidConnectionRow[] }>('/admin/plaid/connections'),
  });

  const { data: logData } = useQuery({
    queryKey: ['admin', 'plaid-webhook-log'],
    queryFn: () => apiClient<{ logs: PlaidWebhookLog[] }>('/admin/plaid/webhook-log'),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Plaid Connection Monitor</h1>
      </div>

      {/* Summary Cards */}
      {stats && (
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
      )}

      {/* Connections Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Connections</h2>
        </div>
        {isLoading ? <LoadingSpinner className="py-8" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Institution</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Accounts</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Sync</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(connData?.connections || []).map((conn) => (
                  <tr key={conn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{conn.institutionName || conn.plaidInstitutionId || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-600">{conn.tenantId?.slice(0, 8) ?? '—'}...</td>
                    <td className="px-4 py-3 text-gray-600">{conn.accounts?.length || 0} ({conn.accounts?.filter((a) => a.isMapped).length || 0} mapped)</td>
                    <td className="px-4 py-3">{statusBadge(conn.itemStatus)}</td>
                    <td className="px-4 py-3 text-gray-600">{conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(conn.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {(!connData?.connections || connData.connections.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No Plaid connections</td></tr>
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
      </div>
    </div>
  );
}
