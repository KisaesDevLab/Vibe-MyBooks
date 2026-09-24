// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { Play, Pause, Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { RecurringScheduleModal, type EditableSchedule } from './RecurringScheduleModal';
import { SortableTh } from '../../components/ui/SortableTh';
import { useColumnView } from '../../hooks/useColumnView';

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
type SortKey = 'name' | 'frequency' | 'mode' | 'nextOccurrence' | 'lastPostedAt' | 'status';
const SORT_KEYS: readonly SortKey[] = ['name', 'frequency', 'mode', 'nextOccurrence', 'lastPostedAt', 'status'];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'archived', label: 'Archived' },
];

// Rows-per-page choices — GET /recurring caps limit at 500.
const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', '500'];
const DEFAULT_PAGE_SIZE = '50';

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
  // Server-side pagination; the status/search filters below stay client-side
  // (the endpoint takes no status/search params) so they only narrow the
  // fetched page.
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const limit = parseInt(pageSize, 10);
  // Sort is server-side (the list paginates); status + search stay
  // client-side over the loaded page as before.
  const cols = useColumnView<SortKey>('vibe:recurring:view', {
    sortKeys: SORT_KEYS, defaultSort: { col: 'nextOccurrence', dir: 'asc' },
  });
  useEffect(() => setOffset(0), [cols.signature]);
  const sortQs = cols.sortCol ? `&sortBy=${cols.sortCol}&sortDir=${cols.sortDir}` : '';
  const { data, isLoading } = useQuery({
    queryKey: ['recurring', limit, offset, cols.sortCol, cols.sortDir],
    queryFn: () => apiClient<{ schedules: RecurringSchedule[]; total: number }>(`/recurring?limit=${limit}&offset=${offset}${sortQs}`),
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
    return rows;
  }, [all, statusFilter, search]);

  // The Status popover mirrors the filter buttons: one value = that status,
  // none or several = All.
  const statusFilterProps = cols.filterProps('status', STATUS_OPTIONS);
  const statusPopover = {
    ...statusFilterProps,
    selected: statusFilter === 'all' ? new Set<string>() : new Set([statusFilter]),
    onApply: (sel: Set<string>) => {
      const pick = sel.size === 1 ? [...sel][0] as Status : 'all';
      setStatusFilter(pick); setOffset(0);
    },
  };
  const th = 'text-xs font-medium text-gray-500';

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Recurring Transactions</h1>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {([['all', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['archived', 'Archived']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setStatusFilter(key); setOffset(0); }}
            className={`px-3 py-1.5 rounded-md text-sm border ${statusFilter === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {label} ({counts[key]})
          </button>
        ))}
        <input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Search name / frequency / mode…"
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
                <SortableTh padding="px-4 py-2" className={th} label="Name" {...cols.thProps('name')} />
                <SortableTh padding="px-4 py-2" className={th} label="Frequency" {...cols.thProps('frequency')} />
                <SortableTh padding="px-4 py-2" className={th} label="Mode" {...cols.thProps('mode')} />
                <SortableTh padding="px-4 py-2" className={th} label="Next Occurrence" {...cols.thProps('nextOccurrence')} />
                <SortableTh padding="px-4 py-2" className={th} label="Last Posted" {...cols.thProps('lastPostedAt')} />
                <SortableTh padding="px-4 py-2" className={th} align="center" label="Status" {...cols.thProps('status')} filter={statusPopover} />
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

      {data && (
        <Pagination
          total={data.total}
          limit={limit}
          offset={offset}
          onChange={setOffset}
          unit="schedules"
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setPageSize(size); setOffset(0); }}
        />
      )}

      {editing && (
        <RecurringScheduleModal schedule={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
