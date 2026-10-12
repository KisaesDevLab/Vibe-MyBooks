// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSnapshots, downloadSnapshotPdf } from '../../../api/hooks/useTaxEstimatorSnapshots';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Pagination } from '../../../components/ui/Pagination';
import { dollars, errMsg } from '../estimate/format';
import { SNAPSHOT_REASON_LABELS, fmtTimestamp } from './labels';

const PAGE = 20;

interface Props { taxpayerId: string; taxYear: number }

/** Snapshot history for one taxpayer-year (newest first, paged). Rows are immutable. */
export function SnapshotHistory({ taxpayerId, taxYear }: Props) {
  const [offset, setOffset] = useState(0);
  const list = useSnapshots(taxpayerId, taxYear, { limit: PAGE, offset });
  const [busy, setBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | undefined>();
  const download = async (sid: string) => {
    setBusy(sid); setDlError(undefined);
    try { await downloadSnapshotPdf(sid); } catch (e) { setDlError(errMsg(e)); } finally { setBusy(null); }
  };
  const base = `/tax-estimator/taxpayers/${taxpayerId}/snapshots`;
  return (
    <section aria-label="Snapshot history" className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">Snapshots &middot; {taxYear}</h2>
      {list.isLoading ? <LoadingSpinner className="py-6" />
        : list.isError || !list.data ? <ErrorMessage message="Could not load snapshots." onRetry={() => list.refetch()} />
        : list.data.data.length === 0 ? (
          <p className="text-sm text-gray-600">No snapshots yet. Finalize the estimate, or download its PDF, to freeze one.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">Taken</th>
                    <th className="py-2 pr-3 font-medium">Reason</th>
                    <th className="py-2 pr-3 font-medium">Scenario</th>
                    <th className="py-2 pr-3 font-medium text-right">Total</th>
                    <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((s) => (
                    <tr key={s.id} className={`border-b border-gray-100 align-top ${s.accessible ? '' : 'text-gray-400'}`} data-testid="snapshot-row">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtTimestamp(s.createdAt)}{s.note && <div className="text-xs text-gray-500">{s.note}</div>}</td>
                      <td className="py-2 pr-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{SNAPSHOT_REASON_LABELS[s.reason] ?? s.reason}</span></td>
                      <td className="py-2 pr-3">{s.scenarioName}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.summary ? dollars(s.summary.total) : '—'}</td>
                      <td className="py-2">
                        {s.accessible ? (
                          <div className="flex flex-wrap gap-2">
                            <Link className="text-primary-700 hover:underline" to={`${base}/${s.id}?year=${taxYear}`}>View</Link>
                            <Link className="text-primary-700 hover:underline" to={`${base}/${s.id}?year=${taxYear}&compare=1`}>Compare with live</Link>
                            <Button size="sm" variant="ghost" loading={busy === s.id} onClick={() => download(s.id)}>PDF</Button>
                          </div>
                        ) : (
                          <span className="text-xs">Includes a client you can no longer reach</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dlError && <p className="text-sm text-red-600" role="alert">{dlError}</p>}
            <Pagination total={list.data.total} limit={PAGE} offset={offset} onChange={setOffset} unit="snapshots" />
          </>
        )}
    </section>
  );
}
