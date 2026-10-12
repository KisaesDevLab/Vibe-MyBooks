// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FILING_STATUSES, SAFE_HARBOR_OVERRIDES, PORTAL_SHOWS,
  type FilingStatus, type PersonRole, type SafeHarborOverride, type PortalShows, type TaxpayerDTO,
} from '@kis-books/shared';
import {
  useTaxpayer, useUpdateTaxpayer, useArchiveTaxpayer, useUpsertPerson, useRemovePerson, useTaxEstimatorScope,
} from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PersonsEditor } from './PersonsEditor';
import { LinksSection } from './LinksSection';
import { ContactsPanel } from './ContactsPanel';
import { FILING_STATUS_LABELS, SAFE_HARBOR_LABELS, SELECT_CLASS } from './labels';
import { useYear } from '../../../api/hooks/useTaxEstimatorYears';
import { downloadEstimatePdf } from '../../../api/hooks/useTaxEstimatorEstimate';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');

function CoreForm({ taxpayer, canWrite }: { taxpayer: TaxpayerDTO; canWrite: boolean }) {
  const update = useUpdateTaxpayer(taxpayer.id);
  const [name, setName] = useState(taxpayer.displayName);
  const [filing, setFiling] = useState<FilingStatus>(taxpayer.filingStatus);
  const [state, setState] = useState(taxpayer.residentState ?? '');
  const [harbor, setHarbor] = useState<SafeHarborOverride | ''>(taxpayer.safeHarborOverride ?? '');
  const [portal, setPortal] = useState<PortalShows | ''>(taxpayer.portalShows ?? '');
  const stateInvalid = state !== '' && !/^[A-Za-z]{2}$/.test(state);
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3" aria-label="Taxpayer details">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Display name" value={name} disabled={!canWrite} onChange={(e) => setName(e.target.value)} />
        <div>
          <label htmlFor="tp-filing" className="block text-sm font-medium text-gray-700 mb-1">Filing status</label>
          <select id="tp-filing" className={SELECT_CLASS} value={filing} disabled={!canWrite} onChange={(e) => setFiling(e.target.value as FilingStatus)}>
            {FILING_STATUSES.map((f) => <option key={f} value={f}>{FILING_STATUS_LABELS[f]}</option>)}
          </select>
        </div>
        <Input label="Resident state" maxLength={2} placeholder="MO" value={state} disabled={!canWrite}
          error={stateInvalid ? 'Use a two-letter state code' : undefined} onChange={(e) => setState(e.target.value.toUpperCase())} />
        <div>
          <label htmlFor="tp-harbor" className="block text-sm font-medium text-gray-700 mb-1">Safe-harbor rule</label>
          <select id="tp-harbor" className={SELECT_CLASS} value={harbor} disabled={!canWrite} onChange={(e) => setHarbor(e.target.value as SafeHarborOverride | '')}>
            <option value="">Firm default</option>
            {SAFE_HARBOR_OVERRIDES.map((s) => <option key={s} value={s}>{SAFE_HARBOR_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tp-portal" className="block text-sm font-medium text-gray-700 mb-1">Client portal shows</label>
          <select id="tp-portal" className={SELECT_CLASS} value={portal} disabled={!canWrite} onChange={(e) => setPortal(e.target.value as PortalShows | '')}>
            <option value="">Firm default</option>
            {PORTAL_SHOWS.map((s) => <option key={s} value={s}>{s === 'live' ? 'Live estimate' : 'Latest snapshot'}</option>)}
          </select>
        </div>
      </div>
      {update.isError && <p className="text-sm text-red-600" role="alert">{errMsg(update.error)}</p>}
      {update.isSuccess && <p className="text-sm text-green-700" role="status">Saved.</p>}
      {canWrite && (
        <Button size="sm" disabled={!name.trim() || stateInvalid} loading={update.isPending}
          onClick={() => update.mutate({
            displayName: name.trim(), filingStatus: filing, residentState: state === '' ? null : state,
            safeHarborOverride: harbor === '' ? null : harbor, portalShows: portal === '' ? null : portal,
          })}>Save details</Button>
      )}
    </section>
  );
}

/**
 * D15: the standalone Print / Download of the current year's Base scenario — the same PDF
 * the estimate screen and the Report Pack section produce (the server freezes a snapshot).
 */
function DownloadPdfButton({ taxpayerId }: { taxpayerId: string }) {
  const taxYear = new Date().getFullYear();
  const year = useYear(taxpayerId, taxYear);
  const base = year.data?.exists ? (year.data.scenarios.find((s) => s.isBase) ?? year.data.scenarios[0]) : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const hint = year.isLoading ? undefined : !base ? `Set up ${taxYear} annual settings to print an estimate.` : undefined;
  const run = async () => {
    if (!base) return;
    setBusy(true); setError(undefined);
    try { await downloadEstimatePdf(taxpayerId, taxYear, base.id); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col items-end">
      <Button variant="secondary" size="sm" disabled={!base} loading={busy} onClick={run} title={hint}>Print / Download PDF</Button>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
    </div>
  );
}

export function TaxpayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useTaxpayer(id);
  const scope = useTaxEstimatorScope();
  const upsertPerson = useUpsertPerson(id ?? '');
  const removePerson = useRemovePerson(id ?? '');
  const archive = useArchiveTaxpayer();
  const [confirmArchive, setConfirmArchive] = useState(false);
  // UX only; the server enforces firm_admin / firm_staff on every mutation.
  const canWrite = scope.data ? scope.data.firmRole !== 'firm_readonly' : false;

  if (isLoading) return <LoadingSpinner className="py-16" />;
  if (isError || !data) {
    return <ErrorMessage message={(error as { status?: number } | null)?.status === 404 ? 'Taxpayer not found.' : 'Could not load this taxpayer.'} onRetry={() => refetch()} />;
  }
  const { taxpayer, persons } = data;

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500 mb-1" aria-label="Breadcrumb"><Link to="/tax-estimator/taxpayers" className="hover:underline">Taxpayers</Link> &rsaquo; {taxpayer.displayName}</nav>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{taxpayer.displayName}{!taxpayer.isActive && <span className="ml-2 text-sm font-normal text-gray-500">(archived)</span>}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/tax-estimator/taxpayers/${taxpayer.id}/estimate`} className="text-sm font-medium text-primary-700 hover:underline">Tax estimate</Link>
            <Link to={`/tax-estimator/taxpayers/${taxpayer.id}/scenarios`} className="text-sm font-medium text-primary-700 hover:underline">Scenarios</Link>
            <Link to={`/tax-estimator/taxpayers/${taxpayer.id}/annual-settings`} className="text-sm font-medium text-primary-700 hover:underline">Annual settings</Link>
            <DownloadPdfButton taxpayerId={taxpayer.id} />
            {canWrite && taxpayer.isActive && <Button variant="secondary" size="sm" onClick={() => setConfirmArchive(true)}>Archive</Button>}
          </div>
        </div>
      </div>
      <CoreForm key={taxpayer.updatedAt} taxpayer={taxpayer} canWrite={canWrite} />
      <section aria-label="Persons" className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Persons</h2>
        <PersonsEditor persons={persons} canWrite={canWrite} saving={upsertPerson.isPending || removePerson.isPending}
          error={upsertPerson.isError ? errMsg(upsertPerson.error) : removePerson.isError ? errMsg(removePerson.error) : undefined}
          onSave={(role: PersonRole, input) => upsertPerson.mutate({ role, input })}
          onRemove={(role: PersonRole) => removePerson.mutate(role)} />
      </section>
      <LinksSection taxpayerId={taxpayer.id} persons={persons} canWrite={canWrite} />
      <ContactsPanel taxpayerId={taxpayer.id} canWrite={canWrite} />
      <ConfirmDialog open={confirmArchive} title="Archive this taxpayer?" variant="danger" confirmLabel="Archive"
        message="The taxpayer, persons and links are kept but hidden from the default list."
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => archive.mutate(taxpayer.id, { onSuccess: () => navigate('/tax-estimator/taxpayers') })} />
    </div>
  );
}
