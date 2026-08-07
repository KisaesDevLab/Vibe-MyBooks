// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// AJE register (Phase 5): the firm's adjusting entries per fiscal
// year, with reverse / duplicate / void actions (5.5) and drill-down
// to the transaction detail.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { activeCompanyId, publishTbChange } from './workpaperShared';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toaster';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface AjeLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string | null;
}

interface Aje {
  id: string;
  txnDate: string;
  memo: string | null;
  status: string;
  basis: string;
  ajeNumber: number | null;
  ajeNumberLabel: string | null;
  lines: AjeLine[];
}

const PAGE_SIZE = 50;
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function AjeListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [includeVoid, setIncludeVoid] = useState(false);
  const [page, setPage] = useState(0);
  const [voidTarget, setVoidTarget] = useState<Aje | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tb', 'ajes', fiscalYear, includeVoid, page],
    queryFn: () => apiClient<{ ajes: Aje[]; total: number }>(
      `/tb/ajes?fiscalYear=${fiscalYear}&includeVoid=${includeVoid}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    ),
  });

  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'reverse' | 'duplicate' | 'void'; reason?: string }) =>
      apiClient(`/tb/ajes/${id}/${action}`, { method: 'POST', body: reason ? JSON.stringify({ reason }) : undefined }),
    onSuccess: (_res, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['tb'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      publishTbChange(activeCompanyId());
      toast.success(action === 'void' ? 'AJE voided' : action === 'reverse' ? 'Reversing AJE posted' : 'AJE duplicated');
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Action failed'),
  });

  const total = (aje: Aje) => aje.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Adjusting Entries</h1>
          <p className="text-gray-600 text-sm">Firm AJEs post to the general ledger and appear on client reports read-only.</p>
        </div>
        <Button onClick={() => navigate('/tb/ajes/new')}>New AJE</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm text-gray-700" htmlFor="aje-fy">Fiscal year</label>
        <input id="aje-fy" type="number" value={fiscalYear}
          onChange={(e) => { setFiscalYear(Number(e.target.value)); setPage(0); }}
          className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={includeVoid} onChange={(e) => { setIncludeVoid(e.target.checked); setPage(0); }} />
          Include void
        </label>
      </div>

      {isLoading && <LoadingSpinner className="py-12" />}
      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load AJEs. <button onClick={() => refetch()} className="underline font-medium">Retry</button>
        </div>
      )}
      {data && data.ajes.length === 0 && (
        <p className="text-sm text-gray-500 py-8">No adjusting entries for FY{fiscalYear}.</p>
      )}
      {data && data.ajes.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Memo</th>
                  <th className="px-4 py-2">Basis</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.ajes.map((aje) => (
                  <tr key={aje.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link to={`/transactions/${aje.id}`} className="font-mono text-xs text-purple-700 font-medium">
                        {aje.ajeNumberLabel ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{aje.txnDate}</td>
                    <td className="px-4 py-2 max-w-md truncate">{aje.memo || '—'}</td>
                    <td className="px-4 py-2">{aje.basis === 'both' ? '—' : aje.basis}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{usd(total(aje))}</td>
                    <td className="px-4 py-2">
                      {aje.status === 'void'
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">void</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">posted</span>}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {aje.status !== 'void' && (
                        <>
                          <button className="text-xs text-gray-500 hover:text-blue-600 underline mr-3"
                            onClick={() => navigate(`/tb/ajes/${aje.id}/edit`)}>edit</button>
                          <button className="text-xs text-gray-500 hover:text-blue-600 underline mr-3"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ id: aje.id, action: 'reverse' })}
                            title="Post an auto-reversing entry dated the first day of the next period">
                            reverse
                          </button>
                          <button className="text-xs text-gray-500 hover:text-blue-600 underline mr-3"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ id: aje.id, action: 'duplicate' })}>duplicate</button>
                          <button className="text-xs text-gray-500 hover:text-red-600 underline"
                            onClick={() => setVoidTarget(aje)}>void</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination total={data.total} limit={PAGE_SIZE} offset={page * PAGE_SIZE}
              onChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE))} unit="entries" />
          </div>
        </>
      )}

      <ConfirmDialog
        open={voidTarget !== null}
        title={`Void ${voidTarget?.ajeNumberLabel ?? 'AJE'}?`}
        message="Voiding writes reversing lines to the ledger — history is preserved. This cannot be undone."
        confirmLabel="Void AJE"
        variant="danger"
        onConfirm={() => {
          if (voidTarget) act.mutate({ id: voidTarget.id, action: 'void', reason: 'Voided from AJE register' });
          setVoidTarget(null);
        }}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  );
}
