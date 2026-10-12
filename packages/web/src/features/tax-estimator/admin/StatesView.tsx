// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// States view of the super-admin Tax Parameters screen (MODULE.md "State rule keys").
import { useMemo, useState } from 'react';
import { STATE_INSTALLMENT_PAIRS, installmentPartnerKey } from '@kis-books/shared';
import type { ParameterSource, ParameterStatus, StateRuleRowDTO, StateRuleSetStatus, StateRuleSummaryDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useToast } from '../../../components/ui/Toaster';
import {
  useStateRuleSummaries, useStateRules, useSetStateRuleOverride, useRevertStateRule, useCreateStateYearFromPrior,
  useVerifyStateRule, useVerifyAllStateRules,
} from '../../../api/hooks/useTaxStateRules';
import { VerifyDialog, VerifiedLine } from './VerifyDialog';
import { StateRuleModal } from './StateRuleModal';
import { StateRuleValue } from './StateRuleValue';
import { StateDiffPanel, StateChangesPanel } from './StatePanels';
import { shortCitation } from './format';

const STATUS_STYLE: Record<ParameterStatus, string> = {
  verified: 'bg-green-100 text-green-800', unverified: 'bg-amber-100 text-amber-800', provisional: 'bg-blue-100 text-blue-800',
};
const SOURCE_STYLE: Record<ParameterSource, string> = {
  seed: 'bg-gray-100 text-gray-700', override: 'bg-purple-100 text-purple-800', provisional: 'bg-blue-100 text-blue-800', fallback: 'bg-orange-100 text-orange-800',
};
const SET_STYLE: Record<StateRuleSetStatus, string> = {
  complete: 'bg-green-100 text-green-800', partial: 'bg-amber-100 text-amber-800', missing: 'bg-red-100 text-red-800', fallback: 'bg-orange-100 text-orange-800',
};
const Badge = ({ cls, children }: { cls: string; children: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>
);
const Skeleton = ({ label }: { label: string }) => (
  <div className="space-y-3" aria-label={label}>
    {[0, 1, 2].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />)}
  </div>
);

function CountsText({ c }: { c: StateRuleSummaryDTO['counts'] }) {
  const parts = [`${c.verified} verified`, `${c.unverified} unverified`, `${c.provisional} provisional`, `${c.override} override`];
  return <span className="text-xs text-gray-600 tabular-nums">{parts.join(' · ')}</span>;
}

function StateDetail({ year, state, onBack }: { year: number; state: StateRuleSummaryDTO; onBack: () => void }) {
  const toast = useToast();
  const q = useStateRules(year, state.state);
  const setOverride = useSetStateRuleOverride(year);
  const revert = useRevertStateRule(year);
  const [overrideRow, setOverrideRow] = useState<StateRuleRowDTO | null>(null);
  const [revertRow, setRevertRow] = useState<StateRuleRowDTO | null>(null);
  const verify = useVerifyStateRule(year);
  const verifyAll = useVerifyAllStateRules(year);
  const [verifyRow, setVerifyRow] = useState<StateRuleRowDTO | null>(null);
  const [verifyAllOpen, setVerifyAllOpen] = useState(false);
  const data = q.data;
  const unverified = (data?.isFallback ? [] : data?.rules ?? []).filter((r) => r.status !== 'verified' && r.source !== 'fallback');
  const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
  const partnerRow = (key: string): StateRuleRowDTO | undefined => {
    const other = installmentPartnerKey(STATE_INSTALLMENT_PAIRS, key);
    return other ? data?.rules.find((r) => r.key === other) : undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={onBack}>All states</Button>
        <h2 className="text-lg font-semibold text-gray-900">{state.name} <span className="text-gray-500 font-mono text-sm">{state.state}</span></h2>
        {data && !data.hasIncomeTax && <Badge cls="bg-gray-100 text-gray-700">No income tax</Badge>}
        {unverified.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setVerifyAllOpen(true)}>
            Verify all unverified in {state.state} {year} ({unverified.length})
          </Button>
        )}
      </div>
      {q.isLoading ? <Skeleton label="Loading state rules" /> : q.isError ? (
        <ErrorMessage message={`Could not load ${state.name} rules`} onRetry={() => q.refetch()} />
      ) : data && (
        <>
          {data.isFallback && (
            <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 text-orange-900 px-4 py-2 text-sm">
              No {data.year} rules for {state.name} — showing {data.fallbackYear} as provisional.
            </div>
          )}
          {!data.complete && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-4 py-2 text-sm">
              Incomplete: the estimator uses the federal pattern for {state.name}, flagged verify.
              {data.missing.length > 0 && <ul aria-label="Missing keys" className="mt-1 text-xs font-mono columns-2">{data.missing.map((k) => <li key={k}>{k}</li>)}</ul>}
            </div>
          )}
          {data.rules.length === 0 ? (
            <p className="text-sm text-gray-500">No rules for {state.name} in {data.year}.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500">
                  <th className="px-4 py-2">Rule</th><th>Value</th><th>Status</th><th>Source</th><th>Citation</th><th />
                </tr></thead>
                <tbody>
                  {data.rules.map((r) => (
                    <tr key={r.key} className="border-t border-gray-100 align-top">
                      <td className="px-4 py-2">{r.label}<div className="text-xs font-mono text-gray-500">{r.key}</div></td>
                      <td className="py-2 pr-2">
                        <StateRuleValue type={r.type} value={r.value} />
                        {r.shippedValue !== undefined && <div className="text-xs text-gray-500">Shipped: <StateRuleValue type={r.type} value={r.shippedValue} /></div>}
                        {r.reason && <div className="text-xs text-gray-500">Reason: {r.reason}</div>}
                      </td>
                      <td className="py-2"><Badge cls={STATUS_STYLE[r.status]}>{r.status}</Badge><VerifiedLine row={r} /></td>
                      <td className="py-2"><Badge cls={SOURCE_STYLE[r.source]}>{r.source}</Badge></td>
                      <td className="py-2 pr-2 max-w-xs text-gray-600" title={r.citation}>{shortCitation(r.citation)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-right">
                        {r.status !== 'verified' && r.source !== 'fallback' && (
                          <Button size="sm" variant="ghost" onClick={() => setVerifyRow(r)} aria-label={`Mark ${r.key} verified`}>Mark verified</Button>
                        )}
                        {r.source === 'fallback' ? (
                          <span className="text-xs text-gray-500">Create {year} from prior to edit</span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setOverrideRow(r)} aria-label={`Override ${r.key}`}>Override</Button>
                        )}
                        {(r.source === 'override' || r.source === 'provisional') && (
                          <Button size="sm" variant="ghost" onClick={() => setRevertRow(r)} aria-label={`Revert ${r.key}`}>Revert</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {overrideRow && (
        <StateRuleModal
          row={overrideRow}
          partner={partnerRow(overrideRow.key)}
          saving={setOverride.isPending}
          serverError={setOverride.isError ? (setOverride.error instanceof Error ? setOverride.error.message : 'Save failed') : null}
          onClose={() => { setOverride.reset(); setOverrideRow(null); }}
          onSave={(value, reason, companion) => setOverride.mutate({ state: state.state, key: overrideRow.key, value, reason, ...(companion ? { companion } : {}) }, {
            onSuccess: () => { toast.success('Override saved'); setOverrideRow(null); },
          })}
        />
      )}
      {verifyRow && (
        <VerifyDialog
          title={`Mark ${state.state} ${verifyRow.key} verified`}
          message={`Records that you checked the current ${year} ${state.name} value of ${verifyRow.label} against its source. Only the status changes; the rule can still be overridden with a reason later.`}
          confirmLabel="Mark verified"
          saving={verify.isPending}
          serverError={verify.isError ? errText(verify.error, 'Verify failed') : null}
          onClose={() => { verify.reset(); setVerifyRow(null); }}
          onConfirm={(note) => verify.mutate({ state: state.state, key: verifyRow.key, note, expectedValue: verifyRow.value }, {
            onSuccess: () => { toast.success('Marked verified'); setVerifyRow(null); },
          })}
        />
      )}
      {verifyAllOpen && (
        <VerifyDialog
          title={`Verify all unverified in ${state.state} ${year}`}
          message={`Marks all ${unverified.length} ${state.name} rule(s) for ${year} that are not verified as verified by you. Only do this after checking every rule against its source.`}
          confirmLabel={`Verify ${unverified.length}`}
          saving={verifyAll.isPending}
          serverError={verifyAll.isError ? errText(verifyAll.error, 'Verify failed') : null}
          onClose={() => { verifyAll.reset(); setVerifyAllOpen(false); }}
          onConfirm={(note) => verifyAll.mutate({ state: state.state, note }, {
            onSuccess: (r) => { toast.success(`Verified ${r.verified.length} rule(s)`); setVerifyAllOpen(false); },
          })}
        />
      )}
      <ConfirmDialog
        open={!!revertRow}
        title="Revert state rule"
        message={revertRow ? (revertRow.hasShipped === false
          ? `Remove ${state.state} ${revertRow.key} from ${year}? There is no shipped value underneath: the rule would be missing, so the server allows this only when it is the state-year's last row (edit the value instead). The change is audited.`
          : `Revert ${state.state} ${revertRow.key} to the shipped value? The override is removed and the change is audited.`) : undefined}
        confirmLabel="Revert"
        variant="danger"
        onCancel={() => setRevertRow(null)}
        onConfirm={() => {
          const key = revertRow!.key;
          revert.mutate({ state: state.state, key }, {
            onSuccess: () => toast.success('Reverted'),
            onError: (e) => toast.error(e instanceof Error ? e.message : 'Revert failed'),
          });
          setRevertRow(null);
        }}
      />
    </div>
  );
}

export function StatesView({ year, years }: { year: number | null; years: number[] }) {
  const toast = useToast();
  const q = useStateRuleSummaries(year);
  const createYear = useCreateStateYearFromPrior();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | StateRuleSetStatus>('all');

  const list = q.data ?? [];
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return list.filter((r) => (filter === 'all' || r.status === filter)
      && (!s || r.name.toLowerCase().includes(s) || r.state.toLowerCase() === s));
  }, [list, search, filter]);
  const totals = useMemo(() => ({
    complete: list.filter((r) => r.status === 'complete').length,
    partial: list.filter((r) => r.status === 'partial').length,
    missing: list.filter((r) => r.status === 'missing').length,
    fallback: list.filter((r) => r.status === 'fallback').length,
  }), [list]);
  const priorYear = year == null ? null : Math.max(-1, ...years.filter((y) => y < year));
  // R6-02: create is per state — offered while any jurisdiction is still served from an earlier year.
  const canCreate = year != null && priorYear != null && priorYear > 0 && totals.fallback > 0;

  if (year == null) return <p className="text-sm text-gray-500">Select a tax year.</p>;
  const current = selected ? list.find((s) => s.state === selected) : undefined;
  if (current) return <StateDetail year={year} state={current} onBack={() => setSelected(null)} />;

  const doCreate = () => createYear.mutate(year, {
    onSuccess: (r) => toast.success(`Created ${r.year} from ${r.fromYear}: ${r.created} rows across ${r.states} state(s)${r.skipped.length ? `; ${r.skipped.length} already had ${r.year} rows (${r.skipped.join(', ')})` : ''}; verify ${r.rolledDates.length} rolled date rule(s)`),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create the year'),
  });

  return (
    <div className="space-y-4">
      {q.isLoading ? <Skeleton label="Loading states" /> : q.isError ? (
        <ErrorMessage message={`Could not load ${year} state rules`} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-500">No jurisdictions are available.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-700">{totals.complete} complete · {totals.partial} partial · {totals.fallback} fallback · {totals.missing} missing</span>
            <input aria-label="Search states" placeholder="Search state" value={search} onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="all">All statuses</option><option value="complete">Complete</option>
              <option value="partial">Partial</option><option value="fallback">Fallback</option><option value="missing">Missing</option>
            </select>
            {canCreate && (
              <Button size="sm" variant="secondary" onClick={doCreate} loading={createYear.isPending}>
                Create {year} state rules from {priorYear}
              </Button>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-gray-500">No states match your filter.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm" aria-label="States">
                <thead><tr className="text-left text-gray-500"><th className="px-4 py-2">State</th><th>Status</th><th>Rules</th><th>Estimator</th></tr></thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.state} className="border-t border-gray-100">
                      <td className="px-4 py-2">
                        <button type="button" className="text-primary-600 hover:underline text-left" onClick={() => setSelected(s.state)} aria-label={`Open ${s.name}`}>
                          {s.name}
                        </button>
                        <span className="ml-2 font-mono text-xs text-gray-500">{s.state}</span>
                      </td>
                      <td className="py-2"><Badge cls={SET_STYLE[s.status]}>{s.status}</Badge></td>
                      <td className="py-2"><CountsText c={s.counts} /></td>
                      <td className="py-2 space-x-1">
                        {!s.hasIncomeTax && <Badge cls="bg-gray-100 text-gray-700">No income tax</Badge>}
                        {s.status === 'fallback' && <Badge cls="bg-orange-100 text-orange-800">{`Using ${s.fallbackYear} rules · verify`}</Badge>}
                        {s.usesFederalFallback && <Badge cls="bg-orange-100 text-orange-800">Federal fallback · verify</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <StateDiffPanel year={year} />
          <StateChangesPanel year={year} />
        </>
      )}
    </div>
  );
}
