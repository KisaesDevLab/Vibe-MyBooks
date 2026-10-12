// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DEFAULT_ASSUMPTIONS_DISCLAIMER, presentEngineText, type EstimateResultDTO } from '@kis-books/shared';
import { useSnapshot, useSnapshotCompare, downloadSnapshotPdf } from '../../../api/hooks/useTaxEstimatorSnapshots';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { KeyFigures } from '../estimate/KeyFigures';
import { CalculationTable } from '../estimate/CalculationTable';
import { SafeHarborCard } from '../estimate/SafeHarborCard';
import { VoucherTable, JurisdictionTabs, useJurisdictionTab } from '../estimate/VoucherTable';
import { SpecialCases } from '../estimate/SpecialCases';
import { WarningsList } from '../estimate/WarningsList';
import { errMsg, fmtMonth } from '../estimate/format';
import { SnapshotCompare } from './SnapshotCompare';
import { SNAPSHOT_REASON_LABELS, fmtTimestamp } from './labels';

function FrozenResult({ result: e }: { result: EstimateResultDTO }) {
  const jurisdictions = [e.federalEstimates, ...e.stateEstimates];
  const [selected, setSelected] = useJurisdictionTab(jurisdictions);
  const sel = jurisdictions.find((j) => j.jurisdiction === selected);
  return (
    <div className="space-y-5">
      <KeyFigures estimate={e} />
      <CalculationTable estimate={e} />
      <section aria-label="Voucher schedule" className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Estimated payments &amp; vouchers</h2>
        <JurisdictionTabs items={jurisdictions} selected={selected} onSelect={setSelected} />
        {sel && (
          <div className="space-y-3">
            <SafeHarborCard estimate={sel} rule={e.safeHarborRule} ruleSource={e.safeHarborRuleSource} />
            <VoucherTable estimate={sel} />
          </div>
        )}
      </section>
      <SpecialCases estimate={e} />
      <WarningsList warnings={e.warnings} />
    </div>
  );
}

/** Read-only view of an immutable snapshot, with "Compare with live". */
export function SnapshotViewPage() {
  const { id, snapshotId } = useParams<{ id: string; snapshotId: string }>();
  const [search, setSearch] = useSearchParams();
  const comparing = search.get('compare') === '1';
  const snap = useSnapshot(snapshotId);
  const compare = useSnapshotCompare(snapshotId, comparing);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | undefined>();

  if (snap.isLoading) return <LoadingSpinner className="py-16" />;
  if (snap.isError || !snap.data) {
    const status = (snap.error as { status?: number } | null)?.status;
    return <ErrorMessage message={status === 404 ? 'Snapshot not found, or it includes a client you can no longer reach.' : `Could not load this snapshot: ${errMsg(snap.error)}`} onRetry={() => snap.refetch()} />;
  }
  const s = snap.data;
  const r = s.payload.result;
  const assumptions = s.payload.assumptions;
  const setCompare = (on: boolean) => {
    const next = new URLSearchParams(search);
    if (on) next.set('compare', '1'); else next.delete('compare');
    setSearch(next, { replace: true });
  };
  const download = async () => {
    setPdfBusy(true); setPdfError(undefined);
    try { await downloadSnapshotPdf(s.id); } catch (err) { setPdfError(errMsg(err)); } finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <nav className="text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
          <Link to="/tax-estimator/taxpayers" className="hover:underline">Taxpayers</Link> &rsaquo;{' '}
          <Link to={`/tax-estimator/taxpayers/${id}`} className="hover:underline">{s.payload.inputs.taxpayer.displayName}</Link> &rsaquo;{' '}
          <Link to={`/tax-estimator/taxpayers/${id}/estimate?year=${s.taxYear}`} className="hover:underline">Tax Estimator</Link> &rsaquo; Snapshot
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">{s.taxYear} Tax Estimate &middot; snapshot</h1>
      </div>
      <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
        Snapshot &mdash; read only. Taken {fmtTimestamp(s.createdAt)} ({SNAPSHOT_REASON_LABELS[s.reason] ?? s.reason}), scenario &ldquo;{s.scenarioName}&rdquo;
        {s.payload.inputs.throughMonth ? `, actuals through ${fmtMonth(s.payload.inputs.throughMonth)}` : ''}, engine {s.engineVersion}.
        {s.note ? ` Note: ${s.note}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant={comparing ? 'secondary' : 'primary'} size="sm" onClick={() => setCompare(false)}>Snapshot</Button>
        <Button variant={comparing ? 'primary' : 'secondary'} size="sm" onClick={() => setCompare(true)}>Compare with live</Button>
        <Button variant="secondary" size="sm" loading={pdfBusy} onClick={download}>Download PDF</Button>
      </div>
      {pdfError && <p className="text-sm text-red-600" role="alert">{pdfError}</p>}

      {comparing ? (
        compare.isLoading ? <LoadingSpinner className="py-10" />
          : compare.isError || !compare.data ? <ErrorMessage message={`Could not compare with live: ${errMsg(compare.error)}`} onRetry={() => compare.refetch()} />
          : <SnapshotCompare compare={compare.data} />
      ) : (
        <>
          <FrozenResult result={r} />
          <section aria-label="Assumptions" className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Assumptions</h2>
            {assumptions.sections.filter((sec) => sec.id !== 'disclaimer').map((sec) => (
              <div key={sec.id}>
                <h3 className="text-sm font-semibold text-gray-800">{sec.title}</h3>
                {sec.items.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
                  <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                    {sec.items.map((it, i) => (
                      <li key={`${it.code ?? it.label}:${i}`}>
                        <span className="font-medium">{it.label}:</span> {presentEngineText(it.detail)}
                        {it.badge && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{it.badge.replace(/_/g, ' ')}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
          <footer className="border-t border-gray-200 pt-3 text-xs text-gray-500">
            <p>{s.payload.disclaimerText || assumptions.disclaimerText || DEFAULT_ASSUMPTIONS_DISCLAIMER}</p>
          </footer>
        </>
      )}
    </div>
  );
}
