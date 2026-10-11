// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { LinkDTO, PersonDTO } from '@kis-books/shared';
import { useTaxpayerLinks, useUpsertLink, useRemoveLink } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LinkForm } from './LinkForm';
import { ACTIVITY_LABELS, SE_STATUS_LABELS } from './labels';

const DEFAULT_YEAR = new Date().getFullYear();
const YEAR_SPAN = 3;
const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');

/** Entity links for one tax year: a table plus add/edit form. Names of out-of-scope clients are never shown. */
export function LinksSection({ taxpayerId, persons, canWrite }: { taxpayerId: string; persons: PersonDTO[]; canWrite: boolean }) {
  const [taxYear, setTaxYear] = useState(DEFAULT_YEAR);
  const [editing, setEditing] = useState<LinkDTO | 'new' | null>(null);
  const { data, isLoading, isError, refetch } = useTaxpayerLinks(taxpayerId, taxYear);
  const upsert = useUpsertLink(taxpayerId);
  const remove = useRemoveLink(taxpayerId);
  const years = Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => DEFAULT_YEAR - YEAR_SPAN + i);
  const links = data?.data ?? [];

  return (
    <section className="space-y-3" aria-label="Entity links">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Entity links</h2>
          <label className="text-sm text-gray-600 flex items-center gap-1">
            Tax year
            <select aria-label="Tax year" value={taxYear} onChange={(e) => { setTaxYear(Number(e.target.value)); setEditing(null); }}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        {canWrite && persons.length > 0 && editing === null && <Button size="sm" onClick={() => setEditing('new')}>Link a company</Button>}
      </div>

      {canWrite && persons.length === 0 && <p className="text-sm text-gray-500">Add a person above before linking companies.</p>}

      {editing !== null && (
        <LinkForm persons={persons} links={links} initial={editing === 'new' ? null : editing} taxYear={taxYear}
          saving={upsert.isPending} error={upsert.isError ? errMsg(upsert.error) : undefined}
          onCancel={() => { setEditing(null); upsert.reset(); }}
          onSave={(input) => upsert.mutate(input, { onSuccess: () => setEditing(null) })} />
      )}

      {upsert.data?.warnings.map((w) => <p key={w.code + w.companyId} className="text-sm text-amber-700" role="status">{w.message}</p>)}

      {isLoading ? <LoadingSpinner className="py-8" />
        : isError ? <ErrorMessage message="Could not load links." onRetry={() => refetch()} />
        : links.length === 0 ? <p className="text-sm text-gray-500 py-6 text-center border border-dashed rounded-lg">No companies linked for {taxYear}.</p>
        : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Client &mdash; Company</th><th className="px-3 py-2 text-left">Person</th>
                  <th className="px-3 py-2 text-right">Profit</th><th className="px-3 py-2 text-right">Loss</th>
                  <th className="px-3 py-2 text-left">Activity</th><th className="px-3 py-2 text-left">QBI</th>
                  <th className="px-3 py-2 text-left">Notes</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-b last:border-0" data-testid="link-row">
                    <td className="px-3 py-2">
                      {l.outOfScope
                        ? <span className="text-amber-700">Client no longer managed by your firm <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">Excluded</span></span>
                        : <>{l.tenantName} &mdash; {l.companyName}</>}
                    </td>
                    <td className="px-3 py-2 capitalize">{l.personRole}</td>
                    <td className="px-3 py-2 text-right font-mono">{pct(l.profitPct)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pct(l.lossPct)}</td>
                    <td className="px-3 py-2">{ACTIVITY_LABELS[l.activityType]}</td>
                    <td className="px-3 py-2">{l.qbiEligible == null ? 'Default' : l.qbiEligible ? 'Eligible' : 'Not eligible'}{l.qbiOverrideReason ? ' (override)' : ''}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {[l.partnerSeStatus && SE_STATUS_LABELS[l.partnerSeStatus], l.isOfficer && 'Officer', l.allowedLossOverride != null && 'Loss override'].filter(Boolean).join(', ')}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {canWrite && !l.outOfScope && <Button variant="ghost" size="sm" onClick={() => setEditing(l)}>Edit</Button>}
                      {canWrite && <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(l.id)}>Remove</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {remove.isError && <p className="text-sm text-red-600" role="alert">{errMsg(remove.error)}</p>}
      {data?.warnings.map((w) => <p key={`${w.code}:${w.companyId}`} className="text-sm text-amber-700" role="status">{w.message}</p>)}
    </section>
  );
}
