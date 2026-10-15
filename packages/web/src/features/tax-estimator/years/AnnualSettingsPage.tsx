// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTaxpayer, useTaxEstimatorScope, useTaxpayerLinks } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import {
  useYear, useYearList, useSaveYear, useCreateScenario, useCloneScenario, useRenameScenario, useDeleteScenario, useScenarioPortalShare,
  useAdjustments, useCreateAdjustment, useUpdateAdjustment, useDeleteAdjustment, useAdjustmentTypes,
  useStateRows, useReplaceStateRows, useFirmSettings, useSaveFirmSettings,
} from '../../../api/hooks/useTaxEstimatorYears';
import { useEstimate } from '../../../api/hooks/useTaxEstimatorEstimate';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { ScenarioTabs } from './ScenarioTabs';
import { YearInputsForm } from './YearInputsForm';
import { AdjustmentsSection } from './AdjustmentsSection';
import { StateRowsEditor } from './StateRowsEditor';
import { FirmSettingsDialog } from './FirmSettingsDialog';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');
const THIS_YEAR = new Date().getFullYear();

function ScenarioPanels({ taxpayerId, scenarioId, taxYear, canWrite, persons, residentState }: {
  taxpayerId: string; scenarioId: string; taxYear: number; canWrite: boolean; persons: import('@kis-books/shared').PersonDTO[]; residentState: string | null;
}) {
  const links = useTaxpayerLinks(taxpayerId, taxYear);
  const adjustments = useAdjustments(scenarioId);
  const types = useAdjustmentTypes();
  const stateRows = useStateRows(scenarioId);
  const create = useCreateAdjustment(scenarioId);
  const update = useUpdateAdjustment();
  const remove = useDeleteAdjustment();
  const replace = useReplaceStateRows(scenarioId);
  // QA2-04: a GL-linked adjustment's months are actuals + run-rate, which only the estimate
  // computes; read them from the (cached) estimate, and only when the scenario has one.
  const hasGl = (adjustments.data?.data ?? []).some((a) => a.glLinked);
  const estimate = useEstimate(taxpayerId, taxYear, hasGl ? scenarioId : undefined);
  const computed = useMemo(() => ({
    loading: hasGl && estimate.isLoading,
    byId: Object.fromEntries((estimate.data?.adjustments ?? []).map((a) => [a.id, { fullYearAmount: a.fullYearAmount, monthly: a.monthly }])),
  }), [hasGl, estimate.isLoading, estimate.data]);
  const qc = useQueryClient();
  const recompute = { onSuccess: () => { void qc.invalidateQueries({ queryKey: ['tax-estimator-estimate'] }); } };
  return (
    <>
      <section className="space-y-2" aria-label="States">
        <h2 className="text-lg font-semibold text-gray-900">States</h2>
        {stateRows.isLoading ? <LoadingSpinner className="py-6" />
          : stateRows.isError ? <ErrorMessage message="Could not load state rows." onRetry={() => stateRows.refetch()} />
          : (
            <StateRowsEditor key={`${scenarioId}:${(stateRows.data ?? []).map((r) => r.id).join(',')}`} rows={stateRows.data ?? []}
              canWrite={canWrite} saving={replace.isPending} defaultResidentState={residentState}
              error={replace.isError ? errMsg(replace.error) : undefined} onSave={(input) => replace.mutate(input)} />
          )}
      </section>
      <section className="space-y-2" aria-label="Adjustments section">
        <h2 className="text-lg font-semibold text-gray-900">Adjustments</h2>
        {adjustments.isLoading || types.isLoading ? <LoadingSpinner className="py-6" />
          : adjustments.isError || types.isError ? <ErrorMessage message="Could not load adjustments." onRetry={() => { void adjustments.refetch(); void types.refetch(); }} />
          : (
            <AdjustmentsSection taxYear={taxYear} adjustments={adjustments.data?.data ?? []} total={adjustments.data?.total ?? 0}
              types={types.data ?? []} persons={persons} links={links.data?.data ?? []} canWrite={canWrite}
              saving={create.isPending || update.isPending}
              error={create.isError ? errMsg(create.error) : update.isError ? errMsg(update.error) : remove.isError ? errMsg(remove.error) : undefined}
              computed={computed}
              onCreate={(input) => create.mutate(input, recompute)} onUpdate={(id, input) => update.mutate({ id, input }, recompute)} onDelete={(id) => remove.mutate(id, recompute)} />
          )}
      </section>
    </>
  );
}

export function AnnualSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  const taxYear = Number(search.get('year')) || THIS_YEAR;
  const taxpayer = useTaxpayer(id);
  const scope = useTaxEstimatorScope();
  const years = useYearList(id);
  const year = useYear(id, taxYear);
  const save = useSaveYear(id ?? '', taxYear);
  const createScenario = useCreateScenario(id ?? '', taxYear);
  const clone = useCloneScenario();
  const rename = useRenameScenario();
  const share = useScenarioPortalShare();
  const del = useDeleteScenario();
  const [selected, setSelected] = useState<string | undefined>();
  const [firmOpen, setFirmOpen] = useState(false);
  const firm = useFirmSettings();
  const saveFirm = useSaveFirmSettings();
  const [yearDraft, setYearDraft] = useState(String(taxYear));

  const scenarios = year.data?.scenarios ?? [];
  useEffect(() => {
    if (scenarios.length > 0 && !scenarios.some((s) => s.id === selected)) setSelected(scenarios.find((s) => s.isBase)?.id ?? scenarios[0]!.id);
  }, [scenarios, selected]);
  useEffect(() => setYearDraft(String(taxYear)), [taxYear]);

  const canWrite = scope.data ? (scope.data.canWrite ?? scope.data.firmRole !== 'firm_readonly') : false;
  const isAdmin = scope.data?.firmRole === 'firm_admin';
  const setYear = (y: number) => { setSelected(undefined); setSearch({ year: String(y) }); };

  if (taxpayer.isLoading || year.isLoading) return <LoadingSpinner className="py-16" />;
  if (taxpayer.isError || !taxpayer.data) {
    return <ErrorMessage message={(taxpayer.error as { status?: number } | null)?.status === 404 ? 'Taxpayer not found.' : 'Could not load this taxpayer.'} onRetry={() => taxpayer.refetch()} />;
  }
  if (year.isError || !year.data) return <ErrorMessage message="Could not load this tax year." onRetry={() => year.refetch()} />;

  const { taxpayer: tp, persons } = taxpayer.data;
  const detail = year.data;
  const scenarioError = [createScenario, clone, rename, del, share].find((m) => m.isError);
  const savedYears = (years.data ?? []).map((y) => y.taxYear);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
          <Link to="/tax-estimator/taxpayers" className="hover:underline">Taxpayers</Link> &rsaquo;{' '}
          <Link to={`/tax-estimator/taxpayers/${tp.id}`} className="hover:underline">{tp.displayName}</Link> &rsaquo; Annual settings
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Annual settings · {taxYear}</h1>
          <div className="flex items-center gap-2">
            <label htmlFor="as-year" className="text-sm text-gray-700">Tax year</label>
            <input id="as-year" type="number" min={2000} max={2100} className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" value={yearDraft}
              onChange={(e) => setYearDraft(e.target.value)}
              onBlur={() => { const n = Number(yearDraft); if (n >= 2000 && n <= 2100 && n !== taxYear) setYear(n); else setYearDraft(String(taxYear)); }} />
            {savedYears.filter((y) => y !== taxYear).slice(-4).map((y) => <Button key={y} size="sm" variant="ghost" onClick={() => setYear(y)}>{y}</Button>)}
            {isAdmin && <Button size="sm" variant="secondary" onClick={() => setFirmOpen(true)}>Firm settings</Button>}
          </div>
        </div>
      </div>

      {!detail.exists ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6 space-y-3" aria-label="Year not set up">
          <p className="text-sm text-gray-700">No annual settings exist for {taxYear} yet.{canWrite ? ' Setting up the year creates the Base scenario.' : ' Ask a firm staff member to set it up.'}</p>
          {save.isError && <p className="text-sm text-red-600" role="alert">{errMsg(save.error)}</p>}
          {canWrite && <Button loading={save.isPending} onClick={() => save.mutate({})}>Set up {taxYear}</Button>}
        </section>
      ) : (
        <>
          <ScenarioTabs scenarios={scenarios} selectedId={selected} canWrite={canWrite}
            busy={createScenario.isPending || clone.isPending || rename.isPending || del.isPending || share.isPending}
            error={scenarioError ? errMsg(scenarioError.error) : undefined}
            onSelect={setSelected}
            onClone={(sid, name) => clone.mutate({ id: sid, name }, { onSuccess: (s) => setSelected(s.id) })}
            onRename={(sid, name) => rename.mutate({ id: sid, name })}
            onShareInPortal={(sid, on) => share.mutate({ id: sid, showInPortal: on })}
            // QA D22: leave the scenario BEFORE deleting it, so no mounted adjustments / state-rows
            // query re-creates and refetches the deleted id (404) while the year list reloads.
            onDelete={(sid) => { if (sid === selected) setSelected(scenarios.find((s) => s.isBase)?.id); del.mutate(sid); }} />
          <YearInputsForm key={detail.year.updatedAt} detail={detail} persons={persons} filingStatus={tp.filingStatus} canWrite={canWrite} saving={save.isPending}
            saved={save.isSuccess} error={save.isError ? errMsg(save.error) : undefined} onSave={(input) => save.mutate(input)} />
          {selected && <ScenarioPanels taxpayerId={tp.id} scenarioId={selected} taxYear={taxYear} canWrite={canWrite} persons={persons} residentState={tp.residentState} />}
        </>
      )}

      {isAdmin && (
        <FirmSettingsDialog open={firmOpen} settings={firm.data} loading={firm.isLoading} saving={saveFirm.isPending}
          error={saveFirm.isError ? errMsg(saveFirm.error) : firm.isError ? 'Could not load firm settings.' : undefined}
          onClose={() => setFirmOpen(false)} onSave={(input) => saveFirm.mutate(input, { onSuccess: () => setFirmOpen(false) })} />
      )}
    </div>
  );
}
