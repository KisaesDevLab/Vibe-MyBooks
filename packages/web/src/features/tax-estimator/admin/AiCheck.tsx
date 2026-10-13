// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// AI parameter check UI (OPEN-QUESTIONS Q48): per-row verdict badge + Check button, the
// "AI check unverified" run bar with progress / cancel, the detail drawer and the Apply dialog.
// Advisory only: nothing here marks a row verified; Apply writes an audited, unverified override.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AiCheckAvailabilityDTO, AiCheckDTO, AiCheckRunDTO, AiCheckVerdict, StateCode } from '@kis-books/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import {
  useAiCheckRuns, useStartAiCheckRun, useCancelAiCheckRun, useApplyAiCheck, isActiveRun,
} from '../../../api/hooks/useTaxParamAiChecks';

const VERDICT_STYLE: Record<AiCheckVerdict, string> = {
  matches: 'bg-green-100 text-green-800',
  differs: 'bg-red-100 text-red-800',
  unconfirmed: 'bg-gray-100 text-gray-700',
  error: 'bg-orange-100 text-orange-800',
};
const VERDICT_LABEL: Record<AiCheckVerdict, string> = {
  matches: 'AI: matches', differs: 'AI: differs', unconfirmed: 'AI: unconfirmed', error: 'AI: error',
};

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString();

/** Scope of the run bar / row buttons: federal parameters, or one state's rules. */
export type AiCheckScope = { kind: 'federal' } | { kind: 'state'; state: StateCode };

const runMatchesRow = (r: AiCheckRunDTO, scope: AiCheckScope, key: string) =>
  r.scope === 'single' && r.key === key && (scope.kind === 'federal' ? r.state == null : r.state === scope.state);
const runMatchesScope = (r: AiCheckRunDTO, scope: AiCheckScope) =>
  scope.kind === 'federal' ? r.scope === 'federal' || r.scope === 'all' : (r.scope === 'state' && r.state === scope.state) || r.scope === 'all';

/**
 * Refreshes the latest-results query when a run of this year finishes (the runs list polls while
 * one is active). Returns the year's runs.
 */
function useRunsWithRefresh(year: number) {
  const qc = useQueryClient();
  const runs = useAiCheckRuns(year);
  const activeIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set((runs.data ?? []).filter(isActiveRun).map((r) => r.id));
    const finished = [...activeIds.current].some((id) => !now.has(id));
    activeIds.current = now;
    if (finished) void qc.invalidateQueries({ queryKey: ['tax-param-ai-checks', 'latest'] });
  }, [runs.data, qc]);
  return runs.data ?? [];
}

/** Per-row cell: latest verdict (click → drawer) and a Check button. */
export function AiCheckCell({ year, scope, rowKey, check, availability, onOpen }: {
  year: number;
  scope: AiCheckScope;
  rowKey: string;
  check: AiCheckDTO | undefined;
  availability: AiCheckAvailabilityDTO | undefined;
  onOpen: (check: AiCheckDTO) => void;
}) {
  const toast = useToast();
  const runs = useRunsWithRefresh(year);
  const start = useStartAiCheckRun();
  const checking = runs.some((r) => isActiveRun(r) && runMatchesRow(r, scope, rowKey));
  const disabledReason = availability && !availability.available ? availability.reason ?? 'AI check unavailable' : null;
  return (
    <div className="flex flex-col items-start gap-1">
      {check && (
        <button type="button" onClick={() => onOpen(check)} aria-label={`AI check result for ${rowKey}`}
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${VERDICT_STYLE[check.verdict]}`}>
          {VERDICT_LABEL[check.verdict]}
        </button>
      )}
      {check && (
        <span className="text-xs text-gray-500">
          {shortDate(check.createdAt)}
          {check.stale && <span className="ml-1 text-amber-700" title="The value changed after this check ran">· stale</span>}
          {check.appliedAt && <span className="ml-1 text-purple-700">· applied</span>}
        </span>
      )}
      <Button size="sm" variant="ghost" loading={checking || start.isPending} disabled={!!disabledReason || checking}
        title={disabledReason ?? 'Ask Claude to confirm this value from government sources'}
        aria-label={`AI check ${rowKey}`}
        onClick={() => start.mutate(
          { scope: 'single', year, key: rowKey, ...(scope.kind === 'state' ? { state: scope.state } : {}) },
          { onError: (e) => toast.error(errText(e, 'Could not start the check')) },
        )}>
        {checking ? 'Checking…' : check ? 'Re-check' : 'Check'}
      </Button>
    </div>
  );
}

/** "AI check unverified" for the year (federal or one state) with progress, counts and cancel. */
export function AiCheckRunBar({ year, scope, unverifiedCount, availability }: {
  year: number;
  scope: AiCheckScope;
  unverifiedCount: number;
  availability: AiCheckAvailabilityDTO | undefined;
}) {
  const toast = useToast();
  const runs = useRunsWithRefresh(year).filter((r) => runMatchesScope(r, scope));
  const start = useStartAiCheckRun();
  const cancel = useCancelAiCheckRun();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = runs.find(isActiveRun);
  const last = active ?? runs[0];
  const disabledReason = availability && !availability.available ? availability.reason ?? 'AI check unavailable' : null;
  const label = scope.kind === 'federal' ? `federal ${year}` : `${scope.state} ${year}`;
  return (
    <div className="flex flex-wrap items-center gap-3" aria-label="AI check">
      {!active && unverifiedCount > 0 && (
        <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)} disabled={!!disabledReason}
          title={disabledReason ?? undefined}>
          AI check unverified in {label} ({unverifiedCount})
        </Button>
      )}
      {disabledReason && <span className="text-xs text-gray-500">{disabledReason}</span>}
      {last && (
        <div className="flex items-center gap-2 text-xs text-gray-700" role="status" aria-live="polite">
          {isActiveRun(last) ? (
            <>
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden" aria-hidden="true">
                <div className="h-2 bg-primary-600" style={{ width: `${last.total ? Math.round((last.done / last.total) * 100) : 0}%` }} />
              </div>
              <span className="tabular-nums">AI check {last.done}/{last.total}{last.cancelRequested ? ' · cancelling…' : ''}</span>
              <Button size="sm" variant="ghost" onClick={() => cancel.mutate(last.id)} disabled={last.cancelRequested} loading={cancel.isPending}>Cancel</Button>
            </>
          ) : (
            <span>
              Last AI check {shortDate(last.finishedAt ?? last.createdAt)}: {last.status} · {last.counts.matches} match · {last.counts.differs} differ ·{' '}
              {last.counts.unconfirmed} unconfirmed · {last.counts.error} error{last.error ? ` — ${last.error}` : ''}
            </span>
          )}
        </div>
      )}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="Start AI check" className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900">AI check {unverifiedCount} unverified row(s) in {label}?</h2>
            <p className="text-sm text-gray-700 mt-2">
              Claude ({availability?.model ?? 'configured model'}) searches only government sources for each row (up to {availability?.maxSearchesPerCheck ?? 5} searches per row,
              {` ${availability?.concurrency ?? 2}`} rows at a time). Each row costs Anthropic usage on your API key. Results are advisory: nothing is changed or marked verified.
              You can cancel while it runs.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button loading={start.isPending} onClick={() => start.mutate(
                scope.kind === 'federal' ? { scope: 'federal', year } : { scope: 'state', year, state: scope.state },
                {
                  onSuccess: (r) => { toast.success(`AI check started: ${r.total} row(s)`); setConfirmOpen(false); },
                  onError: (e) => toast.error(errText(e, 'Could not start the check')),
                },
              )}>Start AI check</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm text-gray-900 break-words">{children}</div>
    </div>
  );
}

const safeHref = (url: string | null): string | null => (url && /^https?:\/\//i.test(url) ? url : null);

/** Right-hand drawer with the full result and the Apply button. */
export function AiCheckDrawer({ check, label, currentValue, renderValue, onClose }: {
  check: AiCheckDTO;
  label: string;
  currentValue: unknown;
  renderValue: (value: unknown) => ReactNode;
  onClose: () => void;
}) {
  const toast = useToast();
  const apply = useApplyAiCheck();
  const [applyOpen, setApplyOpen] = useState(false);
  const [useCitation, setUseCitation] = useState(true);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !applyOpen) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, applyOpen]);
  const href = safeHref(check.sourceUrl);
  const canApply = check.verdict === 'differs' && !check.appliedAt && !check.stale;
  const notes = check.details.notes ?? [];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`AI check: ${check.key}`} onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-xl bg-white shadow-xl overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
            <div className="text-xs font-mono text-gray-500">{check.jurisdiction === 'US' ? '' : `${check.jurisdiction} · `}{check.key} · {check.taxYear}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">Close</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${VERDICT_STYLE[check.verdict]}`}>{VERDICT_LABEL[check.verdict]}</span>
          {check.confidence && <span className="text-xs text-gray-600">confidence {check.confidence}</span>}
          <span className="text-xs text-gray-500">checked {new Date(check.createdAt).toLocaleString()}{check.model ? ` · ${check.model}` : ''}</span>
        </div>
        {check.stale && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
            The value changed after this check ran. Run the check again before applying.
          </div>
        )}
        {check.appliedAt && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 text-purple-900 px-3 py-2 text-sm">
            AI value applied on {new Date(check.appliedAt).toLocaleString()} (unverified until a super admin marks it verified).
          </div>
        )}
        <p className="text-xs text-gray-500">Advisory: the AI never changes a value or marks it verified. Confirm against the source before you Mark verified.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Value when checked">{renderValue(check.storedValue)}</Field>
          <Field label="Value the source states">{check.verdict === 'matches' || check.verdict === 'differs' ? renderValue(check.foundValue) : '—'}</Field>
        </div>
        {check.quote && (
          <Field label="Quoted passage">
            <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-800 whitespace-pre-wrap">{check.quote}</blockquote>
          </Field>
        )}
        {(check.sourceUrl || check.sourceTitle) && (
          <Field label="Source">
            {check.sourceTitle && <div>{check.sourceTitle}</div>}
            {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary-600 hover:underline break-all">{check.sourceUrl}</a> : check.sourceUrl}
            <div className="text-xs text-gray-500">
              {[check.sourceDate ? `dated ${check.sourceDate}` : null, check.sourceTaxYear ? `tax year ${check.sourceTaxYear}` : null,
                check.details.sourceKind ? check.details.sourceKind.replace(/_/g, ' ') : null, check.details.governingAuthority ?? null].filter(Boolean).join(' · ')}
            </div>
          </Field>
        )}
        {check.rationale && <Field label="Rationale">{check.rationale}</Field>}
        {check.error && <Field label="Error"><span className="text-orange-800">{check.error}</span></Field>}
        {notes.length > 0 && (
          <Field label="Server checks">
            <ul className="list-disc pl-5 text-sm text-gray-700">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </Field>
        )}
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer">Raw values and usage</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all bg-gray-50 rounded p-2">{JSON.stringify({
            stored: check.storedValue, found: check.foundValue, current: currentValue, usage: check.usage,
            retrievedUrls: check.details.retrievedUrls, allowedDomains: check.details.allowedDomains,
          }, null, 2)}</pre>
        </details>
        {canApply && (
          <div className="pt-2 border-t border-gray-200">
            <Button onClick={() => setApplyOpen(true)}>Apply AI value</Button>
          </div>
        )}
      </aside>
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.stopPropagation()}>
          <div role="dialog" aria-modal="true" aria-label="Apply AI value" className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Apply the AI value to {check.key}?</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Current value">{renderValue(currentValue)}</Field>
              <Field label="New value">{renderValue(check.foundValue)}</Field>
            </div>
            <Field label="Source">{check.sourceTitle ? `${check.sourceTitle} — ` : ''}{check.sourceUrl}</Field>
            <p className="text-sm text-gray-700">
              Saved as an override with an audited reason (AI check id and source). The row stays <strong>unverified</strong> until a super admin uses Mark verified.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={useCitation} onChange={(e) => setUseCitation(e.target.checked)} />
              Use the AI source as the citation
            </label>
            {apply.isError && <p role="alert" className="text-xs text-red-600">{errText(apply.error, 'Apply failed')}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { apply.reset(); setApplyOpen(false); }}>Cancel</Button>
              <Button loading={apply.isPending} onClick={() => apply.mutate({ id: check.id, expectedValue: currentValue, updateCitation: useCitation }, {
                onSuccess: () => { toast.success('AI value applied (unverified)'); setApplyOpen(false); onClose(); },
              })}>Apply</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
