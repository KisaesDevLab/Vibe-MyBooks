// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { AccountTreatmentInput, TreatmentSuggestion } from '@kis-books/shared';
import { useTaxEstimatorScope } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import {
  useEntitySettings, useSaveEntitySettings, useEntityYearInputs, useSaveEntityYearInputs, useEntityTreatments,
  useSaveEntityTreatments, useTreatmentSuggestions, useEntityReadiness, useTaxBasisPl, useOwnerCandidates,
} from '../../../api/hooks/useTaxEstimatorEntities';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { SettingsPanel } from './SettingsPanel';
import { YearInputsPanel } from './YearInputsPanel';
import { SuggestionsBanner } from './SuggestionsBanner';
import { TreatmentTable } from './TreatmentTable';
import { ReadinessPanel } from './ReadinessPanel';
import { PreviewCard } from './PreviewCard';
import { buildRows } from './rows';
import { baseEntityType, baseEntityTypeOptionLabel, errMsg } from './labels';

const THIS_YEAR = new Date().getFullYear();
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Entity tax setup for one client company (MODULE.md D3/D8). Warnings never block. */
export function EntityTaxSetupPage() {
  const { tenantId = '', companyId = '' } = useParams<{ tenantId: string; companyId: string }>();
  const [search, setSearch] = useSearchParams();
  const taxYear = Number(search.get('year')) || THIS_YEAR;
  const throughRaw = search.get('through') ?? '';
  const through = MONTH_RE.test(throughRaw) ? throughRaw : '';
  const setParam = (k: string, v: string) => setSearch((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const scope = useTaxEstimatorScope();
  const canWrite = scope.data ? (scope.data.canWrite ?? scope.data.firmRole !== 'firm_readonly') : false;
  const readOnly = !!scope.data && !canWrite;

  // Q49: resolved for the selected tax year (that year's entity type override applies).
  const settings = useEntitySettings(tenantId, companyId, taxYear);
  const yearInputs = useEntityYearInputs(tenantId, companyId, taxYear);
  const treatments = useEntityTreatments(tenantId, companyId);
  const suggestions = useTreatmentSuggestions(tenantId, companyId, taxYear);
  const readiness = useEntityReadiness(tenantId, companyId, taxYear, through);
  const pl = useTaxBasisPl(tenantId, companyId, taxYear, through);
  const saveSettings = useSaveEntitySettings(tenantId, companyId, taxYear);
  const saveYear = useSaveEntityYearInputs(tenantId, companyId, taxYear);
  const saveTreatments = useSaveEntityTreatments(tenantId, companyId);
  // Q50: the person / payment pickers offer only owners linked to this business (staff / admin only).
  const owners = useOwnerCandidates(tenantId, companyId, taxYear, canWrite);

  const rows = useMemo(
    () => buildRows(pl.data?.accounts ?? [], treatments.data?.items ?? [], suggestions.data ?? []),
    [pl.data, treatments.data, suggestions.data],
  );

  const applySuggestions = (list: TreatmentSuggestion[]) => {
    const existing = new Map((treatments.data?.items ?? []).map((t) => [t.accountId, t]));
    const inputs: AccountTreatmentInput[] = list.map((s) => ({
      accountId: s.accountId, treatment: s.treatment, pct: s.treatment === 'nondeductible_pct' ? s.pct : null,
      nonRecurring: existing.get(s.accountId)?.nonRecurring ?? false,
      ...(s.treatment === 'estimated_tax_payment' ? { paymentJurisdiction: s.paymentJurisdiction } : {}),
    }));
    saveTreatments.mutate(inputs);
  };

  if (settings.isLoading) return <div className="p-6"><LoadingSpinner className="py-16" /></div>;
  if (settings.isError || !settings.data) {
    return <div className="p-6"><ErrorMessage message="Could not load entity tax setup." onRetry={() => settings.refetch()} /></div>;
  }
  const r = settings.data.resolved;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <Link to="/tax-estimator/taxpayers" className="text-sm text-primary-600 hover:underline">&larr; Taxpayers</Link>
        <h1 className="text-2xl font-semibold text-gray-900">Entity tax setup</h1>
        <p className="text-gray-600" data-testid="entity-title">{r.companyName}</p>
      </div>

      {readOnly && (
        <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-700" role="status">
          Read-only access: you can review this setup but not change it.
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-end">
        <label className="text-sm text-gray-700">Tax year
          <input aria-label="Tax year" type="number" min={2000} max={2100} value={taxYear}
            className="block w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 2000 && v <= 2100) setParam('year', String(v)); }} />
        </label>
        <label className="text-sm text-gray-700">Through month
          <input aria-label="Through month" type="month" value={through || (pl.data?.throughMonth ?? '')} placeholder="Latest"
            className="block rounded-lg border border-gray-300 px-2 py-1.5 text-sm" onChange={(e) => setParam('through', e.target.value)} />
        </label>
      </div>

      <SettingsPanel key={settings.data.settings.updatedAt ?? 'new'} data={settings.data} canWrite={canWrite}
        saving={saveSettings.isPending} error={saveSettings.isError ? errMsg(saveSettings.error) : undefined}
        onSave={(input) => saveSettings.mutate(input)} />

      {yearInputs.isLoading ? <LoadingSpinner className="py-6" />
        : yearInputs.isError || !yearInputs.data ? <ErrorMessage message="Could not load year inputs." onRetry={() => yearInputs.refetch()} />
        : (
          <YearInputsPanel key={`${taxYear}:${yearInputs.data.updatedAt ?? 'new'}`} taxYear={taxYear} inputs={yearInputs.data}
            booksW2Wages={pl.data?.w2Wages.projectedYear ?? null} entityType={r.entityType}
            baseType={baseEntityType(r)} baseTypeLabel={baseEntityTypeOptionLabel(r)} canWrite={canWrite} saving={saveYear.isPending}
            error={saveYear.isError ? errMsg(saveYear.error) : undefined} onSave={(input) => saveYear.mutate(input)} />
        )}

      <section className="space-y-3" aria-label="GL tax treatments section">
        <h2 className="text-lg font-semibold text-gray-900">GL tax treatment</h2>
        {suggestions.data && (
          <SuggestionsBanner suggestions={suggestions.data} canWrite={canWrite} saving={saveTreatments.isPending} onApply={applySuggestions}
            storageKey={`vibe:tax-estimator:dismissed-suggestions:${tenantId}:${companyId}`} />
        )}
        {treatments.isLoading || pl.isLoading ? <LoadingSpinner className="py-8" />
          : treatments.isError || pl.isError ? <ErrorMessage message="Could not load the GL treatment map." onRetry={() => { void treatments.refetch(); void pl.refetch(); }} />
          : (
            <TreatmentTable key={treatments.dataUpdatedAt} rows={rows} canWrite={canWrite} saving={saveTreatments.isPending} entityType={r.entityType}
              ownerCandidates={canWrite ? owners.data?.candidates ?? [] : undefined} taxYear={taxYear}
              error={saveTreatments.isError ? errMsg(saveTreatments.error) : undefined} onSave={(i) => saveTreatments.mutate(i)} />
          )}
      </section>

      {readiness.isLoading ? <LoadingSpinner className="py-6" />
        : readiness.isError || !readiness.data ? <ErrorMessage message="Could not load books readiness." onRetry={() => readiness.refetch()} />
        : <ReadinessPanel readiness={readiness.data} />}

      {pl.data && <PreviewCard pl={pl.data} />}
    </div>
  );
}
