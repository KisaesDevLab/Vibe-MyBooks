// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Super-admin Tax Parameters screen (features/tax-estimator/MODULE.md "Tax parameters").
import { useEffect, useMemo, useState } from 'react';
import { PARAMETER_GROUPS } from '@kis-books/shared';
import type { ParameterSource, ParameterStatus, TaxParameterRowDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useToast } from '../../../components/ui/Toaster';
import {
  useTaxParameterYears, useTaxParameters, useSetTaxParameterOverride, useRevertTaxParameter, useCreateTaxYearFromPrior,
  useVerifyTaxParameter, useVerifyAllTaxParameters,
} from '../../../api/hooks/useTaxParameters';
import { VerifyDialog, VerifiedLine } from './VerifyDialog';
import { OverrideModal } from './OverrideModal';
import { ParameterValue } from './ParameterValue';
import { DiffPanel, ChangesPanel } from './ParameterPanels';
import { shortCitation } from './format';
import { StatesView } from './StatesView';

const STATUS_STYLE: Record<ParameterStatus, string> = {
  verified: 'bg-green-100 text-green-800', unverified: 'bg-amber-100 text-amber-800', provisional: 'bg-blue-100 text-blue-800',
};
const SOURCE_STYLE: Record<ParameterSource, string> = {
  seed: 'bg-gray-100 text-gray-700', override: 'bg-purple-100 text-purple-800', provisional: 'bg-blue-100 text-blue-800', fallback: 'bg-orange-100 text-orange-800',
};
const Badge = ({ cls, children }: { cls: string; children: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>
);

function Skeleton() {
  return (
    <div className="space-y-3" aria-label="Loading tax parameters">
      {[0, 1, 2].map((i) => <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-lg" />)}
    </div>
  );
}

export function TaxParametersPage() {
  const toast = useToast();
  const yearsQ = useTaxParameterYears();
  const [selected, setSelected] = useState<number | null>(null);
  const [scope, setScope] = useState<'federal' | 'states'>('federal');
  const [overrideRow, setOverrideRow] = useState<TaxParameterRowDTO | null>(null);
  const [revertRow, setRevertRow] = useState<TaxParameterRowDTO | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showMissing, setShowMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [verifyRow, setVerifyRow] = useState<TaxParameterRowDTO | null>(null);
  const [verifyAllOpen, setVerifyAllOpen] = useState(false);

  const years = yearsQ.data?.years ?? [];
  const latest = years.length ? Math.max(...years) : null;
  useEffect(() => { if (selected == null && latest != null) setSelected(latest); }, [selected, latest]);

  const paramsQ = useTaxParameters(scope === 'federal' ? selected : null);
  const setOverride = useSetTaxParameterOverride(selected ?? 0);
  const revert = useRevertTaxParameter(selected ?? 0);
  const createYear = useCreateTaxYearFromPrior();
  const verify = useVerifyTaxParameter(selected ?? 0);
  const verifyAll = useVerifyAllTaxParameters(selected ?? 0);
  const nextYear = latest != null ? latest + 1 : null;
  const canCreateNext = nextYear != null && !years.includes(nextYear);

  const data = paramsQ.data;
  const byGroup = useMemo(() => {
    const q = search.trim().toLowerCase();
    const m = new Map<string, TaxParameterRowDTO[]>();
    for (const r of data?.parameters ?? []) {
      if (q && !r.key.toLowerCase().includes(q) && !r.label.toLowerCase().includes(q)) continue;
      (m.get(r.group) ?? m.set(r.group, []).get(r.group)!).push(r);
    }
    return m;
  }, [data, search]);

  // Fallback rows have no stored row to verify (create the year first).
  const unverified = (data?.isFallback ? [] : data?.parameters ?? []).filter((r) => r.status !== 'verified' && r.source !== 'fallback');
  const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  const doCreate = () => {
    if (nextYear == null) return;
    createYear.mutate(nextYear, {
      onSuccess: (r) => {
        setSelected(r.year);
        toast.success(`Created ${r.year} from ${r.fromYear}: ${r.created} rows${r.rolledDates.length ? `; verify ${r.rolledDates.length} rolled date(s)` : ''}`);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create the year'),
    });
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Tax parameters</h1>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Jurisdiction">
          {(['federal', 'states'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}
              className={`px-3 py-1.5 text-sm ${scope === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
              {s === 'federal' ? 'Federal' : 'States'}
            </button>
          ))}
        </div>
      </div>

      {yearsQ.isLoading ? <Skeleton /> : yearsQ.isError ? (
        <ErrorMessage message="Could not load tax parameter years" onRetry={() => yearsQ.refetch()} />
      ) : years.length === 0 ? (
        <p className="text-sm text-gray-500">No tax parameter years are available yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Tax year">
          {years.map((y) => (
            <button key={y} role="tab" aria-selected={y === selected} onClick={() => setSelected(y)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${y === selected ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-gray-300 text-gray-700'}`}>
              {y}
            </button>
          ))}
          {scope === 'federal' && canCreateNext && (
            <Button size="sm" variant="secondary" onClick={doCreate} loading={createYear.isPending}>
              Create {nextYear} from {latest}
            </Button>
          )}
        </div>
      )}

      {scope === 'states' ? (
        <StatesView year={selected} years={years} />
      ) : selected != null && (
        paramsQ.isLoading ? <Skeleton /> : paramsQ.isError ? (
          <ErrorMessage message={`Could not load ${selected} parameters`} onRetry={() => paramsQ.refetch()} />
        ) : data && (
          <>
            {data.isFallback && (
              <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 text-orange-900 px-4 py-2 text-sm">
                No {data.year} parameters shipped — showing {data.fallbackYear} as provisional.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setShowMissing((s) => !s)}
                className={`px-3 py-1 rounded-full text-sm border ${data.completeness.missing.length ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
                {data.completeness.present}/{data.completeness.total} complete
              </button>
              <input aria-label="Search parameters" placeholder="Search key or label" value={search} onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              {unverified.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setVerifyAllOpen(true)}>
                  Verify all unverified in {data.year} ({unverified.length})
                </Button>
              )}
            </div>
            {showMissing && (
              data.completeness.missing.length === 0
                ? <p className="text-sm text-gray-500">No missing keys.</p>
                : <ul className="text-xs font-mono text-red-800 bg-red-50 rounded-lg p-3 columns-2" aria-label="Missing keys">
                    {data.completeness.missing.map((k) => <li key={k}>{k}</li>)}
                  </ul>
            )}
            {data.parameters.length === 0 ? (
              <p className="text-sm text-gray-500">No parameters for {data.year}.</p>
            ) : byGroup.size === 0 ? (
              <p className="text-sm text-gray-500">No parameters match your search.</p>
            ) : PARAMETER_GROUPS.filter((g) => byGroup.has(g)).map((g) => {
              const rows = byGroup.get(g)!;
              const open = !collapsed[g];
              return (
                <section key={g} className="bg-white rounded-xl border border-gray-200" aria-label={g}>
                  <button type="button" className="w-full flex justify-between px-4 py-3 text-left font-semibold text-gray-900"
                    onClick={() => setCollapsed((c) => ({ ...c, [g]: open }))} aria-expanded={open}>
                    <span>{g}</span><span className="text-xs font-normal text-gray-500">{rows.length} keys</span>
                  </button>
                  {open && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-gray-500 border-t border-gray-100">
                          <th className="px-4 py-2">Parameter</th><th>Value</th><th>Status</th><th>Source</th><th>Citation</th><th />
                        </tr></thead>
                        <tbody>
                          {rows.map((r) => {
                            const changed = r.shippedValue !== undefined;
                            return (
                              <tr key={r.key} className="border-t border-gray-100 align-top">
                                <td className="px-4 py-2">{r.label}<div className="text-xs font-mono text-gray-500">{r.key}</div></td>
                                <td className="py-2 pr-2">
                                  <ParameterValue type={r.type} value={r.value} />
                                  {changed && <div className="text-xs text-gray-500">Shipped: <ParameterValue type={r.type} value={r.shippedValue} /></div>}
                                  {r.reason && <div className="text-xs text-gray-500">Reason: {r.reason}</div>}
                                </td>
                                <td className="py-2"><Badge cls={STATUS_STYLE[r.status]}>{r.status}</Badge><VerifiedLine row={r} /></td>
                                <td className="py-2"><Badge cls={SOURCE_STYLE[r.source]}>{r.source}</Badge></td>
                                <td className="py-2 pr-2 max-w-xs text-gray-600" title={r.citation}>{shortCitation(r.citation)}</td>
                                <td className="py-2 pr-4 whitespace-nowrap text-right">
                                  {r.status !== 'verified' && r.source !== 'fallback' && (
                                    <Button size="sm" variant="ghost" onClick={() => setVerifyRow(r)} aria-label={`Mark ${r.key} verified`}>Mark verified</Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => setOverrideRow(r)} aria-label={`Override ${r.key}`}>Override</Button>
                                  {(r.source === 'override' || r.source === 'provisional') && (
                                    <Button size="sm" variant="ghost" onClick={() => setRevertRow(r)} aria-label={`Revert ${r.key}`}>Revert</Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
            <DiffPanel year={selected} />
            <ChangesPanel year={selected} />
          </>
        )
      )}

      {overrideRow && (
        <OverrideModal
          row={overrideRow}
          saving={setOverride.isPending}
          serverError={setOverride.isError ? (setOverride.error instanceof Error ? setOverride.error.message : 'Save failed') : null}
          onClose={() => { setOverride.reset(); setOverrideRow(null); }}
          onSave={(value, reason) => setOverride.mutate({ key: overrideRow.key, value, reason }, {
            onSuccess: () => { toast.success('Override saved'); setOverrideRow(null); },
          })}
        />
      )}
      {verifyRow && (
        <VerifyDialog
          title={`Mark ${verifyRow.key} verified`}
          message={`Records that you checked the current ${selected} value of ${verifyRow.label} against its source. Only the status changes; the value can still be overridden with a reason later.`}
          confirmLabel="Mark verified"
          saving={verify.isPending}
          serverError={verify.isError ? errText(verify.error, 'Verify failed') : null}
          onClose={() => { verify.reset(); setVerifyRow(null); }}
          onConfirm={(note) => verify.mutate({ key: verifyRow.key, note }, {
            onSuccess: () => { toast.success('Marked verified'); setVerifyRow(null); },
          })}
        />
      )}
      {verifyAllOpen && (
        <VerifyDialog
          title={`Verify all unverified in ${selected}`}
          message={`Marks all ${unverified.length} federal parameter(s) of ${selected} that are not verified (unverified, provisional or override) as verified by you. Only do this after checking every value against its source.`}
          confirmLabel={`Verify ${unverified.length}`}
          saving={verifyAll.isPending}
          serverError={verifyAll.isError ? errText(verifyAll.error, 'Verify failed') : null}
          onClose={() => { verifyAll.reset(); setVerifyAllOpen(false); }}
          onConfirm={(note) => verifyAll.mutate(note, {
            onSuccess: (r) => { toast.success(`Verified ${r.verified.length} parameter(s)`); setVerifyAllOpen(false); },
          })}
        />
      )}
      <ConfirmDialog
        open={!!revertRow}
        title="Revert parameter"
        message={revertRow ? `Revert ${revertRow.key} to the shipped value? The override is removed and the change is audited.` : undefined}
        confirmLabel="Revert"
        variant="danger"
        onCancel={() => setRevertRow(null)}
        onConfirm={() => {
          const key = revertRow!.key;
          revert.mutate(key, {
            onSuccess: () => toast.success('Reverted'),
            onError: (e) => toast.error(e instanceof Error ? e.message : 'Revert failed'),
          });
          setRevertRow(null);
        }}
      />
    </div>
  );
}
