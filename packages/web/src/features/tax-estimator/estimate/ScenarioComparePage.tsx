// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MAX_SCENARIOS_PER_YEAR, type EstimateResultDTO } from '@kis-books/shared';
import { useTaxpayer, useTaxEstimatorScope } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { useYear, useCloneScenario, useRenameScenario, useDeleteScenario } from '../../../api/hooks/useTaxEstimatorYears';
import { useEstimates, downloadEstimatePdf } from '../../../api/hooks/useTaxEstimatorEstimate';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { TableScroll } from '../../../components/ui/TableScroll';
import { ScenarioTabs } from '../years/ScenarioTabs';
import { SELECT_CLASS } from '../taxpayers/labels';
import { EstimateTabs } from './EstimateTabs';
import { buildCompareRows, deltaOf } from './compareRows';
import { nextFederalPayment } from './KeyFigures';
import { dollars, errMsg, fmtDate, num, pct } from './format';

const THIS_YEAR = new Date().getFullYear();
const COMPARE_MAX = 3;
const NONE = '';

function signed(n: number): string {
  if (Math.round(n) === 0) return '0';
  return `${n < 0 ? '−' : '+'}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

export function ScenarioComparePage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  const taxYear = Number(search.get('year')) || THIS_YEAR;
  const taxpayer = useTaxpayer(id);
  const scope = useTaxEstimatorScope();
  const year = useYear(id, taxYear);
  const clone = useCloneScenario();
  const rename = useRenameScenario();
  const del = useDeleteScenario();
  const [showChange, setShowChange] = useState(true);
  const [manage, setManage] = useState<string | undefined>();
  const [pdfError, setPdfError] = useState<string | undefined>();
  const scenarios = year.data?.scenarios ?? [];

  const picked = search.getAll('s').filter((sid) => scenarios.some((s) => s.id === sid)).slice(0, COMPARE_MAX);
  const chosen = picked.length > 0 ? picked : scenarios.slice(0, COMPARE_MAX).map((s) => s.id);
  const estimates = useEstimates(id, taxYear, chosen);

  if (taxpayer.isLoading || year.isLoading) return <LoadingSpinner className="py-16" />;
  if (taxpayer.isError || !taxpayer.data) {
    return <ErrorMessage message={(taxpayer.error as { status?: number } | null)?.status === 404 ? 'Taxpayer not found.' : 'Could not load this taxpayer.'} onRetry={() => taxpayer.refetch()} />;
  }
  if (year.isError || !year.data) return <ErrorMessage message="Could not load this tax year." onRetry={() => year.refetch()} />;
  const tp = taxpayer.data.taxpayer;
  const canWrite = scope.data ? (scope.data.canWrite ?? scope.data.firmRole !== 'firm_readonly') : false;
  const manageId = scenarios.some((s) => s.id === manage) ? manage : scenarios.find((s) => s.isBase)?.id ?? scenarios[0]?.id;
  const setSlot = (slot: number, sid: string) => {
    const next = [...chosen];
    if (sid === NONE) next.splice(slot, 1); else next[slot] = sid;
    const params = new URLSearchParams();
    params.set('year', String(taxYear));
    [...new Set(next)].slice(0, COMPARE_MAX).forEach((x) => params.append('s', x));
    setSearch(params, { replace: true });
  };
  const scenarioError = [clone, rename, del].find((m) => m.isError);
  const results: EstimateResultDTO[] = estimates.data ?? [];
  const rows = results.length > 0 ? buildCompareRows(results) : [];
  const maxTotal = Math.max(1, ...results.map((r) => Math.abs(num(r.summary.total))));

  return (
    <div className="space-y-5">
      <div>
        <nav className="text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
          <Link to="/tax-estimator/taxpayers" className="hover:underline">Taxpayers</Link> &rsaquo;{' '}
          <Link to={`/tax-estimator/taxpayers/${tp.id}`} className="hover:underline">{tp.displayName}</Link> &rsaquo; Tax Estimator
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Compare scenarios &middot; {taxYear} projected</h1>
      </div>
      <EstimateTabs taxpayerId={tp.id} taxYear={taxYear} active="scenarios" />

      {!year.data.exists || scenarios.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6 space-y-2" aria-label="Year not set up">
          <p className="text-sm text-gray-700">No annual settings exist for {taxYear} yet, so there are no scenarios to compare.</p>
          <Link className="text-sm font-medium text-primary-700 hover:underline" to={`/tax-estimator/taxpayers/${tp.id}/annual-settings?year=${taxYear}`}>Set up {taxYear}</Link>
        </section>
      ) : (
        <>
          <section aria-label="Manage scenarios" className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Scenarios ({scenarios.length} of {MAX_SCENARIOS_PER_YEAR})</h2>
            <ScenarioTabs scenarios={scenarios} selectedId={manageId} canWrite={canWrite} busy={clone.isPending || rename.isPending || del.isPending}
              error={scenarioError ? errMsg(scenarioError.error) : undefined} onSelect={setManage}
              onClone={(sid, name) => clone.mutate({ id: sid, name }, { onSuccess: (s) => setManage(s.id) })}
              onRename={(sid, name) => rename.mutate({ id: sid, name })}
              onDelete={(sid) => del.mutate(sid, { onSuccess: () => setManage(undefined) })} />
            {scenarios.length < 2 && <p className="text-sm text-gray-600">Clone the Base scenario to compare a what-if against it.</p>}
          </section>

          <section aria-label="Scenarios being compared" className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((slot) => {
              const sid = chosen[slot];
              const r = results.find((x) => x.scenarioId === sid);
              const base = results[0];
              const delta = r && base && r !== base ? num(r.summary.total) - num(base.summary.total) : null;
              const next = r ? nextFederalPayment(r) : null;
              return (
                <div key={slot} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor={`cmp-${slot}`}>Scenario {'ABC'[slot]}</label>
                  <select id={`cmp-${slot}`} className={SELECT_CLASS} value={sid ?? NONE} onChange={(e) => setSlot(slot, e.target.value)}>
                    {slot > 0 && <option value={NONE}>None</option>}
                    {scenarios.map((s) => <option key={s.id} value={s.id} disabled={chosen.includes(s.id) && s.id !== sid}>{s.name}{s.isBase ? ' (base)' : ''}</option>)}
                  </select>
                  {sid && (r ? (
                    <>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-semibold tabular-nums">{dollars(r.summary.total)}</span>
                        {delta != null && <span className={`text-sm font-semibold ${delta < 0 ? 'text-green-700' : delta > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{signed(delta)}</span>}
                      </div>
                      <div className="h-2.5 rounded bg-gray-100 overflow-hidden"><div className="h-2.5 rounded bg-primary-600" style={{ width: `${Math.max(2, Math.round((Math.abs(num(r.summary.total)) / maxTotal) * 100))}%` }} /></div>
                      <p className="text-xs text-gray-500">
                        Total estimated tax &middot; {next ? `next federal payment ${dollars(next.catchUpAmount)} (${fmtDate(next.dueDate)})` : num(r.federalEstimates.totals.excess) > 0 ? `next federal payment $0 (overpaid ${dollars(r.federalEstimates.totals.excess)})` : 'no federal payment due'}
                      </p>
                      <Button size="sm" variant="secondary" onClick={async () => { setPdfError(undefined); try { await downloadEstimatePdf(tp.id, taxYear, r.scenarioId); } catch (err) { setPdfError(errMsg(err)); } }}>Download PDF</Button>
                    </>
                  ) : estimates.isLoading ? <LoadingSpinner className="py-3" /> : null)}
                </div>
              );
            })}
          </section>
          {pdfError && <p className="text-sm text-red-600" role="alert">{pdfError}</p>}

          {estimates.isLoading ? <LoadingSpinner className="py-12" />
            : estimates.isError ? <ErrorMessage message={`Could not compute the comparison${errMsg(estimates.error) === 'Request failed' ? '.' : `: ${errMsg(estimates.error)}`}`} onRetry={() => estimates.refetch()} />
            : results.length === 0 ? <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-700">Pick at least one scenario to compare.</p>
            : (
              <section aria-label="Line comparison" className="rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Line by line</h2>
                  <label className="ml-auto flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={showChange} onChange={(e) => setShowChange(e.target.checked)} /> Show change vs. {results[0]!.scenarioName}
                  </label>
                </div>
                <TableScroll className="border-0 shadow-none rounded-none">
                  <table className="min-w-[44rem] w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left">Line</th>
                        {results.map((r) => <th key={r.scenarioId} scope="col" className="px-4 py-2 text-right">{r.scenarioName}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.key} className={row.key === 'total' ? 'bg-gray-50 font-semibold' : undefined}>
                          <th scope="row" className="px-4 py-2 text-left font-normal text-gray-900">{row.label}</th>
                          {row.values.map((v, i) => {
                            const d = i > 0 && showChange && row.kind === 'money' ? deltaOf(row.values[0] ?? null, v) : null;
                            return (
                              <td key={i} className="px-4 py-2 text-right tabular-nums align-baseline">
                                {v == null ? '—' : row.kind === 'rate' ? pct(v, 0) : dollars(v)}
                                {d != null && (
                                  <span className={`block text-xs font-semibold ${row.isTax ? (d < 0 ? 'text-green-700' : d > 0 ? 'text-amber-700' : 'text-gray-500') : 'text-gray-500'}`}>{signed(d)}</span>
                                )}
                                {row.notes[i] && <span className="block text-xs font-normal text-gray-500">{row.notes[i]}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
                <p className="px-4 py-3 text-xs text-gray-500">Every figure is calculated by the same engine as the summary (brackets, not an effective-rate shortcut unless a scenario overrides it). A negative change on a tax line means lower tax.</p>
              </section>
            )}
        </>
      )}
    </div>
  );
}
