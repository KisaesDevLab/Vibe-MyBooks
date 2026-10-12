// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_ASSUMPTIONS_DISCLAIMER } from '@kis-books/shared';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTaxpayer, useTaxEstimatorScope } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { useYear, useFirmSettings } from '../../../api/hooks/useTaxEstimatorYears';
import { useEstimate, useEstimateReadiness, downloadEstimatePdf } from '../../../api/hooks/useTaxEstimatorEstimate';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { FILING_STATUS_LABELS, SELECT_CLASS } from '../taxpayers/labels';
import { EstimateTabs } from './EstimateTabs';
import { ReadinessBanner } from './ReadinessBanner';
import { KeyFigures } from './KeyFigures';
import { CalculationTable } from './CalculationTable';
import { SafeHarborCard } from './SafeHarborCard';
import { SeTaxTiles } from './SeTaxTiles';
import { VoucherTable, JurisdictionTabs, useJurisdictionTab } from './VoucherTable';
import { PaymentsLedger } from './PaymentsLedger';
import { WarningsList } from './WarningsList';
import { SpecialCases } from './SpecialCases';
import { TraceDrawer } from './TraceDrawer';
import { traceRowsFor } from './traceRows';
import { dollars, errMsg, fmtMonth } from './format';
import { useFinalizeSnapshot, SNAPSHOTS_KEY } from '../../../api/hooks/useTaxEstimatorSnapshots';
import { SnapshotHistory } from '../snapshots/SnapshotHistory';
import { FinalizeDialog } from '../snapshots/FinalizeDialog';

const THIS_YEAR = new Date().getFullYear();
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export function EstimateSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { hash } = useLocation();
  const [search, setSearch] = useSearchParams();
  const taxYear = Number(search.get('year')) || THIS_YEAR;
  const through = search.get('through') || undefined;
  const taxpayer = useTaxpayer(id);
  const scope = useTaxEstimatorScope();
  const year = useYear(id, taxYear);
  const scenarios = year.data?.scenarios ?? [];
  const requested = search.get('scenario');
  const scenarioId = scenarios.find((s) => s.id === requested)?.id ?? scenarios.find((s) => s.isBase)?.id ?? scenarios[0]?.id;
  const estimate = useEstimate(id, taxYear, scenarioId, through);
  const readiness = useEstimateReadiness(id, taxYear);
  const firm = useFirmSettings();
  const [voucherTrace, setVoucherTrace] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | undefined>();
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizedMsg, setFinalizedMsg] = useState<string | undefined>();
  const finalize = useFinalizeSnapshot(id ?? '', taxYear);
  const qc = useQueryClient();
  const e = estimate.data;
  const jurisdictions = e ? [e.federalEstimates, ...e.stateEstimates] : [];
  const [selectedJ, setSelectedJ] = useJurisdictionTab(jurisdictions);

  useEffect(() => {
    if (hash === '#payments' && e) document.getElementById('payments')?.scrollIntoView?.({ behavior: 'smooth' });
  }, [hash, e]);

  const setParam = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(search);
    if (v) next.set(k, v); else next.delete(k);
    setSearch(next, { replace: true });
  };

  if (taxpayer.isLoading || year.isLoading) return <LoadingSpinner className="py-16" />;
  if (taxpayer.isError || !taxpayer.data) {
    return <ErrorMessage message={(taxpayer.error as { status?: number } | null)?.status === 404 ? 'Taxpayer not found.' : 'Could not load this taxpayer.'} onRetry={() => taxpayer.refetch()} />;
  }
  if (year.isError || !year.data) return <ErrorMessage message="Could not load this tax year." onRetry={() => year.refetch()} />;
  const tp = taxpayer.data.taxpayer;
  const canWrite = scope.data ? (scope.data.canWrite ?? scope.data.firmRole !== 'firm_readonly') : false;
  const download = async () => {
    if (!id || !scenarioId) return;
    setPdfBusy(true); setPdfError(undefined);
    try {
      await downloadEstimatePdf(id, taxYear, scenarioId, through);
      // The PDF froze a snapshot (reason 'pdf'); refresh the history.
      void qc.invalidateQueries({ queryKey: [SNAPSHOTS_KEY] });
    } catch (err) { setPdfError(errMsg(err)); } finally { setPdfBusy(false); }
  };
  const doFinalize = (note: string | null) => {
    if (!scenarioId) return;
    setFinalizedMsg(undefined);
    finalize.mutate({ scenarioId, input: { reason: 'finalize', note, ...(through ? { throughMonth: through } : {}) } }, {
      onSuccess: () => { setFinalizeOpen(false); setShowSnapshots(true); setFinalizedMsg('Snapshot saved. It is listed under Snapshots.'); },
    });
  };
  const scenarioName = scenarios.find((s) => s.id === scenarioId)?.name ?? 'Base';
  const closedMonths = (readiness.data?.entities ?? []).map((x) => x.readiness?.lastClosedMonth).filter((m): m is string => !!m);
  const lastClosed = closedMonths.length ? closedMonths.sort()[0] : undefined;
  const throughOpen = !!through && (lastClosed == null || through > lastClosed);
  const sel = jurisdictions.find((j) => j.jurisdiction === selectedJ);

  return (
    <div className="space-y-5">
      <div>
        <nav className="text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
          <Link to="/tax-estimator/taxpayers" className="hover:underline">Taxpayers</Link> &rsaquo;{' '}
          <Link to={`/tax-estimator/taxpayers/${tp.id}`} className="hover:underline">{tp.displayName}</Link> &rsaquo; Tax Estimator
        </nav>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{taxYear} Tax Estimate</h1>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-700">
            <span className="rounded-full border border-gray-300 bg-white px-2.5 py-1">{FILING_STATUS_LABELS[tp.filingStatus]}{tp.residentState ? ` · ${tp.residentState} resident` : ''}</span>
            {e && <span className="rounded-full border border-gray-300 bg-white px-2.5 py-1">{e.entities.length} linked {e.entities.length === 1 ? 'entity' : 'entities'}</span>}
          </div>
        </div>
      </div>

      <EstimateTabs taxpayerId={tp.id} taxYear={taxYear} active="summary" scenarioId={scenarioId} through={through} />

      {!year.data.exists || scenarios.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6 space-y-2" aria-label="Year not set up">
          <p className="text-sm text-gray-700">No annual settings exist for {taxYear} yet, so there is nothing to estimate.</p>
          <Link className="text-sm font-medium text-primary-700 hover:underline" to={`/tax-estimator/taxpayers/${tp.id}/annual-settings?year=${taxYear}`}>Set up {taxYear}</Link>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3" aria-label="Estimate controls">
            <div>
              <label htmlFor="es-through" className="block text-xs font-medium text-gray-500 mb-1">Actuals through</label>
              <select id="es-through" className={`${SELECT_CLASS} min-w-[12rem]`} value={through ?? ''} onChange={(ev) => setParam('through', ev.target.value || undefined)}>
                <option value="">{lastClosed ? `${fmtMonth(lastClosed)} · last closed month` : 'Last closed month (default)'}</option>
                {MONTHS.map((m) => <option key={m} value={`${taxYear}-${m}`}>{fmtMonth(`${taxYear}-${m}`)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="es-scenario" className="block text-xs font-medium text-gray-500 mb-1">Scenario</label>
              <select id="es-scenario" className={`${SELECT_CLASS} min-w-[11rem]`} value={scenarioId ?? ''} onChange={(ev) => setParam('scenario', ev.target.value)}>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isBase ? ' (base)' : ''}</option>)}
              </select>
            </div>
            {e && (
              <p className="text-xs text-gray-500 pb-2">
                {Math.max(0, ...e.entities.map((x) => x.monthsElapsed))} months of actuals &middot; run-rate on recurring items &middot; non-recurring counted once
              </p>
            )}
            {/* QA D5: the action row wraps at 375px instead of pushing the page wide. */}
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto" data-testid="estimate-actions">
              <Button variant="secondary" onClick={() => estimate.refetch()} loading={estimate.isFetching && !estimate.isLoading}>Refresh</Button>
              <Button variant="secondary" disabled={!e} loading={pdfBusy} onClick={download}>Print / Download PDF</Button>
              <Button variant="secondary" aria-expanded={showSnapshots} onClick={() => setShowSnapshots((v) => !v)}>Snapshots</Button>
              {canWrite && <Button disabled={!e} onClick={() => { finalize.reset(); setFinalizeOpen(true); }}>Finalize &amp; issue vouchers</Button>}
            </div>
            <p className="basis-full text-xs text-gray-500">
              Add to Report Pack: pick &ldquo;Tax Estimate&rdquo; (group Tax) in a pack of a linked company &mdash;{' '}
              <Link className="text-primary-700 hover:underline" to="/reports/packs">open Report Packs</Link>.
            </p>
          </div>
          {finalizedMsg && <p className="text-sm text-green-700" role="status">{finalizedMsg}</p>}
          {showSnapshots && id && <SnapshotHistory taxpayerId={id} taxYear={taxYear} />}
          <FinalizeDialog open={finalizeOpen} scenarioName={scenarioName} saving={finalize.isPending}
            error={finalize.isError ? errMsg(finalize.error) : undefined}
            onConfirm={doFinalize} onCancel={() => setFinalizeOpen(false)} />
          {throughOpen && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">{fmtMonth(through)} is after the last closed month ({lastClosed ? fmtMonth(lastClosed) : 'none'}); the estimate uses books that are not fully reconciled.</p>}
          {pdfError && <p className="text-sm text-red-600" role="alert">{pdfError}</p>}

          {estimate.isLoading ? <LoadingSpinner className="py-16" />
            : estimate.isError || !e ? <ErrorMessage message={errMsg(estimate.error) === 'Request failed' ? 'Could not compute the estimate.' : `Could not compute the estimate: ${errMsg(estimate.error)}`} onRetry={() => estimate.refetch()} />
            : e.entities.length === 0 ? (
              <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6 space-y-2" aria-label="No linked entities">
                <p className="text-sm text-gray-700">No companies are linked to this taxpayer for {taxYear}, so the estimate has no business income to project.</p>
                <Link className="text-sm font-medium text-primary-700 hover:underline" to={`/tax-estimator/taxpayers/${tp.id}`}>Link a company</Link>
              </section>
            ) : (
              <>
                <ReadinessBanner taxpayerId={tp.id} taxYear={taxYear} estimate={e} readiness={readiness.data} readinessError={readiness.isError} />
                <KeyFigures estimate={e} />
                <div className="flex flex-wrap gap-5 items-start">
                  <div className="flex-[999_1_40rem] min-w-0 space-y-5"><CalculationTable estimate={e} /></div>
                  <div className="flex-1 basis-80 min-w-0 space-y-4">
                    <SeTaxTiles persons={e.federal.persons} additionalMedicareTax={e.federal.additionalMedicareTax} />
                  </div>
                </div>

                <section id="vouchers" aria-label="Voucher schedule" className="space-y-3">
                  <h2 className="text-lg font-semibold text-gray-900">Estimated payments &amp; vouchers</h2>
                  <JurisdictionTabs items={jurisdictions} selected={selectedJ} onSelect={setSelectedJ} />
                  {sel && (
                    <div className="space-y-3">
                      <SafeHarborCard estimate={sel} rule={e.safeHarborRule} ruleSource={e.safeHarborRuleSource} />
                      <VoucherTable estimate={sel} onTrace={setVoucherTrace} />
                    </div>
                  )}
                </section>
                <SpecialCases estimate={e} />
                <PaymentsLedger taxpayerId={tp.id} taxYear={taxYear} jurisdictions={e.stateEstimates.map((s) => s.jurisdiction)} canWrite={canWrite} />
                <WarningsList warnings={e.warnings} />
                <footer className="border-t border-gray-200 pt-3 text-xs text-gray-500 space-y-1">
                  <p>{firm.data?.effectiveDisclaimerText ?? DEFAULT_ASSUMPTIONS_DISCLAIMER}</p>
                  <p>
                    Parameters: {e.parametersUsed.some((p) => p.status !== 'verified') ? 'some values are not yet verified' : 'all verified'} &middot;
                    State rules: {e.rulesUsed.length === 0 ? 'none used' : e.rulesUsed.some((p) => p.status !== 'verified') ? 'some unverified' : 'verified'} &middot; Engine {e.engineVersion}
                    {e.cached ? ' · cached result' : ''}
                  </p>
                </footer>
                {voucherTrace && <TraceDrawer title={`${voucherTrace === 'federal' ? 'Federal' : voucherTrace} vouchers`} rows={traceRowsFor(e, { kind: 'estimate', jurisdiction: voucherTrace })} onClose={() => setVoucherTrace(null)} />}
              </>
            )}
        </>
      )}
    </div>
  );
}
