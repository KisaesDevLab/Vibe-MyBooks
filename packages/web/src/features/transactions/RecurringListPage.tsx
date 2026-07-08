// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Play, Pause, Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { RecurringScheduleModal, type EditableSchedule } from './RecurringScheduleModal';

interface RecurringSchedule {
  id: string; templateTransactionId: string; name: string | null; frequency: string;
  intervalValue: number; mode: string; startDate: string; endDate: string | null;
  nextOccurrence: string; isActive: boolean; lastPostedAt: string | null;
  archivedAt: string | null;
}

type Status = 'active' | 'paused' | 'archived';
const statusOf = (s: RecurringSchedule): Status => (s.archivedAt ? 'archived' : s.isActive ? 'active' : 'paused');
const STATUS_BADGE: Record<Status, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  archived: 'bg-gray-100 text-gray-500',
};
type SortKey = 'frequency' | 'nextOccurrence' | 'lastPostedAt' | 'status';

// Friendly labels for the frequency cell. Semi-monthly is twice a month, so it
// never shows the "every N" suffix.
const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-weekly',
  semimonthly: 'Semi-monthly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually',
};
const freqLabel = (s: { frequency: string; intervalValue: number }) => {
  const base = FREQ_LABELS[s.frequency] ?? s.frequency;
  return s.frequency !== 'semimonthly' && s.intervalValue > 1 ? `${base} (every ${s.intervalValue})` : base;
};

export function RecurringListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => apiClient<{ schedules: RecurringSchedule[] }>('/recurring'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recurring'] });
  const postNow = useMutation({
    mutationFn: (id: string) => apiClient(`/recurring/${id}/post-now`, { method: 'POST' }),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['transactions'] }); },
  });
  const stop = useMutation({ mutationFn: (id: string) => apiClient(`/recurring/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
  const archive = useMutation({ mutationFn: (id: string) => apiClient(`/recurring/${id}/archive`, { method: 'POST' }), onSuccess: invalidate });
  const unarchive = useMutation({ mutationFn: (id: string) => apiClient(`/recurring/${id}/unarchive`, { method: 'POST' }), onSuccess: invalidate });

  const [statusFilter, setStatusFilter] = useState<'all' | Status>('active');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditableSchedule | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('nextOccurrence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const all = useMemo(() => data?.schedules ?? [], [data]);
  const counts = useMemo(() => ({
    all: all.length,
    active: all.filter((s) => statusOf(s) === 'active').length,
    paused: all.filter((s) => statusOf(s) === 'paused').length,
    archived: all.filter((s) => statusOf(s) === 'archived').length,
  }), [all]);

  const view = useMemo(() => {
    let rows = all;
    if (statusFilter !== 'all') rows = rows.filter((s) => statusOf(s) === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((s) => `${s.name ?? ''} ${s.frequency} ${s.mode}`.toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let c = 0;
      if (sortKey === 'frequency') c = a.frequency.localeCompare(b.frequency);
      else if (sortKey === 'nextOccurrence') c = String(a.nextOccurrence).localeCompare(String(b.nextOccurrence));
      else if (sortKey === 'lastPostedAt') c = String(a.lastPostedAt ?? '').localeCompare(String(b.lastPostedAt ?? ''));
      else c = statusOf(a).localeCompare(statusOf(b));
      return c * dir;
    });
  }, [all, statusFilter, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(k); setSortDir('asc'); } };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Recurring Transactions</h1>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {([['all', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['archived', 'Archived']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm border ${statusFilter === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {label} ({counts[key]})
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / frequency / mode…"
          className="ml-auto rounded-md border-gray-300 text-sm px-3 py-1.5 min-w-[14rem]" />
      </div>

      {view.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
          {all.length === 0 ? "No recurring transactions. Set one up from a transaction's detail page." : 'No plans match this filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('frequency')}>Frequency{arrow('frequency')}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('nextOccurrence')}>Next Occurrence{arrow('nextOccurrence')}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('lastPostedAt')}>Last Posted{arrow('lastPostedAt')}</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {view.map((s) => {
                const st = statusOf(s);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{s.name || <span className="text-gray-400 font-normal">Untitled</span>}</td>
                    <td className="px-4 py-2">{freqLabel(s)}</td>
                    <td className="px-4 py-2 capitalize">{s.mode}</td>
                    <td className="px-4 py-2">{s.nextOccurrence}</td>
                    <td className="px-4 py-2 text-gray-500">{s.lastPostedAt ? new Date(s.lastPostedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[st]}`}>{st}</span></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        {st !== 'archived' && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing({ id: s.id, name: s.name, frequency: s.frequency, intervalValue: s.intervalValue, mode: s.mode, startDate: s.startDate, endDate: s.endDate })}>
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                        )}
                        {st === 'active' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => postNow.mutate(s.id)} loading={postNow.isPending}><Play className="h-3 w-3 mr-1" /> Post Now</Button>
                            <Button variant="ghost" size="sm" onClick={() => stop.mutate(s.id)} loading={stop.isPending}><Pause className="h-3 w-3 mr-1" /> Stop</Button>
                          </>
                        )}
                        {st === 'paused' && (
                          <Button variant="ghost" size="sm" onClick={() => archive.mutate(s.id)} loading={archive.isPending}><Archive className="h-3 w-3 mr-1" /> Archive</Button>
                        )}
                        {st === 'archived' && (
                          <Button variant="ghost" size="sm" onClick={() => unarchive.mutate(s.id)} loading={unarchive.isPending}><ArchiveRestore className="h-3 w-3 mr-1" /> Unarchive</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecurringScheduleModal schedule={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
