// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Search, Download, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: string | null;
  afterData: string | null;
  userId: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
}

const actionOptions = ['create', 'update', 'delete', 'void', 'login'] as const;

const entityTypeOptions = [
  'transaction',
  'account',
  'contact',
  'settings',
  'invoice',
  'item',
  'tag',
  'reconciliation',
  'bank_rule',
  'recurring',
  'budget',
] as const;

const actionBadgeColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  void: 'bg-yellow-100 text-yellow-700',
  login: 'bg-purple-100 text-purple-700',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

function parseJsonSafe(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  if (!before && !after) return '—';
  if (!before && after) return Object.keys(after).join(', ');
  if (before && !after) return 'deleted';

  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(before!), ...Object.keys(after!)]);
  for (const key of allKeys) {
    if (JSON.stringify(before![key]) !== JSON.stringify(after![key])) {
      changed.push(key);
    }
  }
  return changed.length > 0 ? changed.join(', ') : 'no changes';
}

function DiffView({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) {
    return <p className="text-sm text-gray-500">No data recorded.</p>;
  }

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  const changedKeys = new Set<string>();
  for (const key of allKeys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      changedKeys.add(key);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Before</h4>
        {before ? (
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-64">
            {Object.entries(before).map(([key, val]) => {
              const isChanged = changedKeys.has(key);
              return (
                <div key={key} className={isChanged ? 'text-red-600 line-through' : ''}>
                  {`"${key}": ${JSON.stringify(val, null, 2)}`}
                </div>
              );
            })}
          </pre>
        ) : (
          <p className="text-xs text-gray-400 italic">No previous state</p>
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">After</h4>
        {after ? (
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-64">
            {Object.entries(after).map(([key, val]) => {
              const isChanged = changedKeys.has(key);
              return (
                <div key={key} className={isChanged ? 'text-green-600 font-medium' : ''}>
                  {`"${key}": ${JSON.stringify(val, null, 2)}`}
                </div>
              );
            })}
          </pre>
        ) : (
          <p className="text-xs text-gray-400 italic">No resulting state</p>
        )}
      </div>
    </div>
  );
}

export function AuditLogPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 25;

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    action: action || undefined,
    entityType: entityType || undefined,
    search: search || undefined,
    limit: perPage,
    offset: (page - 1) * perPage,
  };

  const buildQueryString = (params: Record<string, string | number | undefined>): string => {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) qs.set(key, String(val));
    }
    const str = qs.toString();
    return str ? `?${str}` : '';
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () =>
      apiClient<AuditLogResponse>(`/audit-log${buildQueryString(filters)}`),
  });

  const handleExportCsv = () => {
    const exportParams: Record<string, string | number | undefined> = {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      action: action || undefined,
      entityType: entityType || undefined,
      search: search || undefined,
    };
    const qs = buildQueryString(exportParams);
    const token = getAccessToken();
    fetch(`/api/v1/audit-log/export${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const entries = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <Button variant="secondary" size="sm" onClick={handleExportCsv}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
          <select
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {entityTypeOptions.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Search entity IDs, data..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No audit log entries found matching the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => {
                const before = parseJsonSafe(entry.beforeData);
                const after = parseJsonSafe(entry.afterData);
                const isExpanded = expandedId === entry.id;

                return (
                  <Fragment key={entry.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatTimestamp(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            actionBadgeColors[entry.action] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.entityType}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono" title={entry.entityId}>
                        {truncateId(entry.entityId)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                        {getChangedFields(before, after)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                          <DiffView before={before} after={after} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-500">
          {data?.total ?? 0} entries total — Page {page} of {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
