// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo, useState } from 'react';
import type { Account, AccountType } from '@kis-books/shared';
import { ACCOUNT_TYPES, DETAIL_TYPES, formatAccountTypeLabel } from '@kis-books/shared';
import { useAccounts, useBulkUpdateAccounts } from '../../api/hooks/useAccounts';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { X, Search, Shield } from 'lucide-react';

// One row's editable state. Only the four inline-editable columns —
// changing `accountType` clears `detailType` (detail options depend on
// the type, same behavior as AccountFormModal).
interface RowEdit {
  accountNumber: string;
  name: string;
  accountType: AccountType;
  detailType: string;
}

function toRowEdit(a: Account): RowEdit {
  return {
    accountNumber: a.accountNumber || '',
    name: a.name,
    accountType: a.accountType as AccountType,
    detailType: a.detailType || '',
  };
}

function isDirty(a: Account, e: RowEdit): boolean {
  return (
    e.accountNumber !== (a.accountNumber || '') ||
    e.name !== a.name ||
    e.accountType !== a.accountType ||
    e.detailType !== (a.detailType || '')
  );
}

function prettyDetail(dt: string): string {
  return dt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BulkEditAccountsModal({ onClose }: { onClose: () => void }) {
  // Load the whole COA (list endpoint caps at 500 — same as the bulk
  // update schema, so one save can cover everything shown).
  const { data, isLoading } = useAccounts({ limit: 500, offset: 0 });
  const bulkUpdate = useBulkUpdateAccounts();
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const allAccounts = useMemo(() => data?.data ?? [], [data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allAccounts;
    return allAccounts.filter((a) =>
      a.name.toLowerCase().includes(q) || (a.accountNumber || '').toLowerCase().includes(q));
  }, [allAccounts, search]);

  const getEdit = (a: Account): RowEdit => edits[a.id] ?? toRowEdit(a);
  const setEdit = (a: Account, patch: Partial<RowEdit>) => {
    setEdits((prev) => ({ ...prev, [a.id]: { ...getEdit(a), ...patch } }));
  };

  const dirtyRows = allAccounts.filter((a) => edits[a.id] && isDirty(a, edits[a.id]!));

  const handleSave = () => {
    setError('');
    const updates = dirtyRows.map((a) => {
      const e = edits[a.id]!;
      return {
        id: a.id,
        ...(e.accountNumber !== (a.accountNumber || '') ? { accountNumber: e.accountNumber || null } : {}),
        ...(e.name !== a.name ? { name: e.name } : {}),
        ...(e.accountType !== a.accountType ? { accountType: e.accountType } : {}),
        ...(e.detailType !== (a.detailType || '') ? { detailType: e.detailType || null } : {}),
      };
    });
    bulkUpdate.mutate({ updates }, {
      onSuccess: onClose,
      onError: (err: Error) => setError(err.message),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Bulk edit accounts">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Edit Accounts</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Edit number, name, type, and detail type inline. Only changed rows are saved.
              System accounts (<Shield className="inline h-3 w-3" />) keep their type.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or number…"
              className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {isLoading ? (
            <LoadingSpinner className="py-12" />
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Number</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 w-44">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 w-52">Detail Type</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const e = getEdit(a);
                  const dirty = !!edits[a.id] && isDirty(a, e);
                  const detailOptions = DETAIL_TYPES[e.accountType] || [];
                  return (
                    <tr key={a.id} className={`border-b border-gray-100 ${dirty ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-1.5">
                        <input
                          value={e.accountNumber}
                          onChange={(ev) => setEdit(a, { accountNumber: ev.target.value })}
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-sm font-mono focus:border-primary-400"
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={e.name}
                            onChange={(ev) => setEdit(a, { name: ev.target.value })}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-primary-400"
                          />
                          {a.isSystem && <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="System account" />}
                        </div>
                      </td>
                      <td className="px-4 py-1.5">
                        <select
                          value={e.accountType}
                          disabled={a.isSystem}
                          onChange={(ev) => setEdit(a, { accountType: ev.target.value as AccountType, detailType: '' })}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                        >
                          {ACCOUNT_TYPES.map((t) => (
                            <option key={t} value={t}>{formatAccountTypeLabel(t)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-1.5">
                        <select
                          value={e.detailType}
                          onChange={(ev) => setEdit(a, { detailType: ev.target.value })}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                        >
                          <option value="">— None —</option>
                          {detailOptions.map((dt) => (
                            <option key={dt} value={dt}>{prettyDetail(dt)}</option>
                          ))}
                          {/* Preserve a legacy value not present in the current type's list */}
                          {e.detailType && !detailOptions.includes(e.detailType) && (
                            <option value={e.detailType}>{prettyDetail(e.detailType)}</option>
                          )}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {dirtyRows.length > 0
              ? <span className="font-medium text-amber-700">{dirtyRows.length} account(s) modified</span>
              : 'No changes yet'}
            {error && <span className="text-red-600 ml-3">{error}</span>}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={bulkUpdate.isPending} disabled={dirtyRows.length === 0}>
              Save {dirtyRows.length > 0 ? `${dirtyRows.length} change(s)` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
