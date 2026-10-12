// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FILING_STATUSES, STATE_CODES, STATE_NAMES, type FilingStatus } from '@kis-books/shared';
import {
  useTaxpayers, useCreateTaxpayer, useTaxEstimatorScope, setTaxEstimatorFirmId,
} from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { useFirms } from '../../../api/hooks/useFirms';
import { SortableTh } from '../../../components/ui/SortableTh';
import { useColumnView } from '../../../hooks/useColumnView';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Pagination } from '../../../components/ui/Pagination';
import { FILING_STATUS_LABELS, SELECT_CLASS } from './labels';
import { StateSelect } from './StateSelect';

type SortKey = 'displayName' | 'filingStatus' | 'residentState' | 'createdAt';
const SORT_KEYS: readonly SortKey[] = ['displayName', 'filingStatus', 'residentState', 'createdAt'];
const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', '500'];
const DEFAULT_PAGE_SIZE = '50';
const SEARCH_DEBOUNCE_MS = 300;
const TH = 'text-xs font-medium text-gray-500';

function NewTaxpayerForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const create = useCreateTaxpayer();
  const [name, setName] = useState('');
  const [filing, setFiling] = useState<FilingStatus>('single');
  const [state, setState] = useState('');
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-4 mb-4 space-y-3" role="form" aria-label="New taxpayer">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label htmlFor="new-tp-filing" className="block text-sm font-medium text-gray-700 mb-1">Filing status</label>
          <select id="new-tp-filing" className={SELECT_CLASS} value={filing} onChange={(e) => setFiling(e.target.value as FilingStatus)}>
            {FILING_STATUSES.map((f) => <option key={f} value={f}>{FILING_STATUS_LABELS[f]}</option>)}
          </select>
        </div>
        <StateSelect id="new-tp-state" label="Resident state" value={state} onChange={setState} />
      </div>
      {create.isError && <p className="text-sm text-red-600" role="alert">{create.error instanceof Error ? create.error.message : 'Could not create taxpayer'}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!name.trim()} loading={create.isPending}
          onClick={() => create.mutate({ displayName: name.trim(), filingStatus: filing, residentState: state || null },
            { onSuccess: (tp) => navigate(`/tax-estimator/taxpayers/${tp.id}`) })}>Create taxpayer</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/** Shown when the caller belongs to several firms and has not picked one (server: TE_FIRM_REQUIRED). */
function FirmChooser() {
  const { data } = useFirms();
  return (
    <div className="max-w-md mx-auto py-12 space-y-3 text-center">
      <p className="text-gray-700">Choose which firm you are working for.</p>
      <select aria-label="Firm" className={SELECT_CLASS} defaultValue=""
        onChange={(e) => { setTaxEstimatorFirmId(e.target.value || null); window.location.reload(); }}>
        <option value="">Select a firm</option>
        {(data?.firms ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  );
}

export function TaxpayerListPage() {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const limit = parseInt(pageSize, 10);
  const view = useColumnView<SortKey>('vibe:tax-estimator-taxpayers:view', {
    sortKeys: SORT_KEYS, defaultSort: { col: 'displayName', dir: 'asc' },
    defaultDir: (col) => (col === 'createdAt' ? 'desc' : 'asc'),
  });
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS); return () => clearTimeout(t); }, [search]);
  useEffect(() => setOffset(0), [view.signature, q, showArchived]);
  const filingFilter = view.filters.filingStatus;
  const stateFilter = view.filters.residentState;
  const scope = useTaxEstimatorScope();
  const { data, isLoading, isError, error, refetch } = useTaxpayers({
    limit, offset, q: q || undefined, status: showArchived ? 'all' : 'active',
    ...(filingFilter && filingFilter.length > 0 ? { filingStatus: filingFilter } : {}),
    ...(stateFilter && stateFilter.length > 0 ? { residentState: stateFilter } : {}),
    ...(view.sortCol ? { sortBy: view.sortCol, sortDir: view.sortDir } : {}),
  });
  const canWrite = scope.data ? (scope.data.canWrite ?? scope.data.firmRole !== 'firm_readonly') : false;

  if ((error as { code?: string } | null)?.code === 'TE_FIRM_REQUIRED') return <FirmChooser />;
  const rows = data?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Taxpayers</h1>
        {canWrite && !creating && <Button onClick={() => setCreating(true)}>New taxpayer</Button>}
      </div>
      {creating && <NewTaxpayerForm onCancel={() => setCreating(false)} />}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="w-72"><Input aria-label="Search taxpayers" placeholder="Search by taxpayer or person" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        {view.anyFilterActive && <Button variant="ghost" size="sm" onClick={view.clearAll}>Clear filters</Button>}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        {isLoading ? <LoadingSpinner className="py-12" />
          : isError ? <ErrorMessage message="Could not load taxpayers." onRetry={() => refetch()} />
          : rows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">
              {q || view.anyFilterActive ? 'No taxpayers match your search.' : 'No taxpayers yet. Create one to start an estimate.'}
            </p>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <SortableTh padding="py-2 px-3" className={TH} label="Taxpayer" {...view.thProps('displayName')} />
                  <th className={`py-2 px-3 text-left ${TH}`}>Persons</th>
                  <SortableTh padding="py-2 px-3" className={TH} label="Filing status" {...view.thProps('filingStatus')}
                    filter={view.filterProps('filingStatus', FILING_STATUSES.map((f) => ({ value: f, label: FILING_STATUS_LABELS[f] })), { ariaLabel: 'Filter filing status' })} />
                  <SortableTh padding="py-2 px-3" className={TH} label="State" {...view.thProps('residentState')}
                    filter={view.filterProps('residentState', STATE_CODES.map((c) => ({ value: c, label: `${c} · ${STATE_NAMES[c]}` })), { ariaLabel: 'Filter state', searchable: true })} />
                  <th className={`py-2 px-3 text-right ${TH}`}>Links</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm">
                      <Link className="text-primary-700 hover:underline" to={`/tax-estimator/taxpayers/${t.id}`}>{t.displayName}</Link>
                      {!t.isActive && <span className="ml-2 text-xs text-gray-500">(archived)</span>}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600">{t.personNames.join(', ') || '—'}</td>
                    <td className="py-2 px-3 text-sm">{FILING_STATUS_LABELS[t.filingStatus]}</td>
                    <td className="py-2 px-3 text-sm">{t.residentState ?? '—'}</td>
                    <td className="py-2 px-3 text-sm text-right tabular-nums">{t.linkCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {data && (
        <Pagination total={data.total} limit={limit} offset={offset} onChange={setOffset} unit="taxpayers"
          pageSize={pageSize} pageSizeOptions={PAGE_SIZE_OPTIONS} onPageSizeChange={(s) => { setPageSize(s); setOffset(0); }} />
      )}
    </div>
  );
}
