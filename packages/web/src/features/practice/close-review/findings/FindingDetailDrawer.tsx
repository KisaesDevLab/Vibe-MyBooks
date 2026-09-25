// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  CheckCircle2,
  EyeOff,
  UserPlus,
  ExternalLink,
  Clock,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import type { CheckRegistryEntry, Finding, FindingStatus } from '@kis-books/shared';
import {
  useFinding,
  useFindingEvents,
  useTransitionFinding,
  usePayeeHistory,
  useFindingAi,
  useExplainFinding,
  useCreateSuppression,
} from '../../../../api/hooks/useReviewChecks';
import { useBulkUpdateTransactions } from '../../../../api/hooks/useTransactions';
import { useMergeContacts } from '../../../../api/hooks/useContacts';
import { useFeatureFlag } from '../../../../api/hooks/useFeatureFlag';
import { apiClient } from '../../../../api/client';
import { ContactSelector } from '../../../../components/forms/ContactSelector';
import { useToast } from '../../../../components/ui/Toaster';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge, STATUS_LABELS } from './StatusBadge';

interface Props {
  finding: Finding | null;
  registry: CheckRegistryEntry[];
  onClose: () => void;
}

// Per-check task framing so the reviewer knows what decision they're
// being asked to make, plus an outcome-shaped Resolve label where the
// generic word would be ambiguous.
const CHECK_GUIDANCE: Record<string, { verify: string; resolveLabel?: string }> = {
  auto_posted_by_rule_sampling: {
    verify: 'Spot-check: confirm the automation rule categorized this transaction correctly.',
    resolveLabel: 'Looks correct',
  },
  parent_account_posting: { verify: 'Decide whether this posting should move to a specific sub-account.' },
  missing_attachment_above_threshold: { verify: 'Attach the missing documentation for this transaction.' },
  uncategorized_stale: { verify: 'Categorize (or exclude) this stale bank-feed line.' },
  tag_inconsistency_vs_history: { verify: 'Confirm the unusual tag on this entry is intentional — or fix it.' },
  transaction_above_materiality: { verify: 'Give this material transaction a second look: amount, category, and support.' },
  duplicate_candidate: { verify: 'Compare the two transactions and decide whether one is a duplicate.' },
  round_dollar_above_threshold: { verify: 'Confirm this round amount matches the actual invoice or receipt.' },
  weekend_holiday_posting: { verify: 'Confirm the weekend date is the real activity date.' },
  negative_non_liability: { verify: 'Find the entry that flipped this account the wrong direction.' },
  closed_period_posting: { verify: 'Verify the closed period still ties after this late entry.' },
  vendor_1099_threshold_no_w9: { verify: 'Collect a W-9 (or record an exclusion) for this vendor before 1099 season.' },
  missing_required_customer: { verify: 'Add the missing customer to this transaction.' },
  receipt_amount_mismatch: { verify: 'Reconcile the receipt total against the bank charge.' },
  ai_personal_expense_review: { verify: 'Decide whether this expense is business or personal.' },
  plaid_connection_health: { verify: 'Restore this bank connection so transactions keep importing.' },
  expense_without_payee: { verify: 'Assign the missing vendor to this expense.' },
  account_inconsistency_vs_history: { verify: 'Confirm the unusual category for this vendor is intentional — or fix it.' },
  journal_entry_without_attachment: { verify: 'Attach the document that supports this journal entry.' },
  new_entities_review: { verify: 'Verify this newly added record is set up correctly and not a duplicate.', resolveLabel: 'Looks correct' },
  posted_into_reconciled_range: { verify: 'Verify this backdated entry belongs in the already-reconciled window.' },
  flux_variance: { verify: 'Explain the unusual swing in this account — real change or coding error?' },
  duplicate_entity_names: { verify: 'Decide whether these two contacts are the same — merge if so.' },
};

// Build plan §7.3 detail drawer. Slide-in panel with:
//   - finding header (severity + check + status)
//   - payload context (every key-value the handler attached)
//   - inline state-transition actions (assign / resolve / ignore)
//   - "Ignore similar" → POST a suppression scoped to this
//     transaction or vendor so subsequent runs skip it
//   - history pane reading finding_events
//   - "Open transaction" deep link when the finding is
//     transaction-scoped
export function FindingDetailDrawer({ finding: findingProp, registry, onClose }: Props) {
  const eventsQ = useFindingEvents(findingProp?.id ?? null);
  // The prop is the row object captured at click time; transitions
  // invalidate the finding query, so prefer the live copy — otherwise
  // the drawer keeps showing the old status (and offering Resolve
  // again) after a successful transition.
  const liveQ = useFinding(findingProp?.id ?? null);
  const transition = useTransitionFinding();
  const createSuppression = useCreateSuppression();
  const [note, setNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  // Reset note state when switching findings.
  useEffect(() => {
    setNote('');
    setResolutionNote('');
  }, [findingProp?.id]);

  // Minimal modal keyboard support: Escape closes. (The drawer is
  // aria-modal; without this, keyboard users had no way out.)
  useEffect(() => {
    if (!findingProp) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [findingProp, onClose]);

  const finding = liveQ.data ?? findingProp;
  if (!finding) return null;

  const registryEntry = registry.find((r) => r.checkKey === finding.checkKey);
  const checkName = registryEntry?.name ?? finding.checkKey;
  // Task framing: what decision is the reviewer being asked to make.
  // Checks without a curated line fall back to the registry description.
  const framing = CHECK_GUIDANCE[finding.checkKey]?.verify ?? registryEntry?.description ?? null;

  const doTransition = (status: FindingStatus, opts?: { resolutionNote?: string }) => {
    transition.mutate({
      id: finding.id,
      status,
      note: note || undefined,
      resolutionNote: opts?.resolutionNote,
    });
    setNote('');
  };

  const ignoreSimilar = () => {
    // Pattern picks the most specific available identifier.
    const matchPattern: { transactionId?: string; vendorId?: string } = {};
    if (finding.transactionId) matchPattern.transactionId = finding.transactionId;
    else if (finding.vendorId) matchPattern.vendorId = finding.vendorId;
    if (!matchPattern.transactionId && !matchPattern.vendorId) return;
    createSuppression.mutate({
      checkKey: finding.checkKey,
      companyId: finding.companyId,
      matchPattern,
      reason: note || 'Ignored from finding drawer',
    });
    setNote('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Finding detail: ${checkName}`}
    >
      <div
        className="absolute inset-0 bg-black/30"
        aria-hidden="true"
      />
      <div
        className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <StatusBadge status={finding.status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <section>
            <h3 className="text-base font-semibold text-gray-900">{checkName}</h3>
            {framing && <p className="mt-1 text-sm text-gray-700">{framing}</p>}
            <p className="mt-1 text-xs text-gray-500">
              Detected {new Date(finding.createdAt).toLocaleString()}
            </p>
          </section>

          {/* What's under review + why + what to do */}
          <PayloadHighlights payload={finding.payload} />

          {/* Deep links to the records involved */}
          <FindingLinks finding={finding} />

          {/* Fix-in-place: payee/customer-missing findings get an inline
              assignment so the correction happens without leaving the
              review. */}
          <InlineContactFix finding={finding} />

          {/* How this payee is usually coded — the baseline for judging
              an inconsistency before recoding. */}
          <FindingAiPanel finding={finding} />

          <PayeeCodingHistory findingId={finding.id} />

          {/* Duplicate names: merge right here (moves every transaction onto
              the kept contact, then deactivates the other). */}
          <DuplicateMerge finding={finding} />

          {/* Remaining payload context, humanized; ids collapse into
              a technical-details disclosure. */}
          <PayloadView payload={finding.payload} />

          {/* Resolution note when resolved */}
          {finding.status === 'resolved' && finding.resolutionNote && (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="text-xs font-medium uppercase tracking-wider mb-1">
                Resolution note
              </div>
              <p className="whitespace-pre-wrap">{finding.resolutionNote}</p>
            </section>
          )}

          {/* Action area */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Add a note (optional)
            </h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add context for the audit trail — what you checked, what you found…"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />

            {/* Only high/critical findings require a resolution note —
                don't show the field (and its "required" hint) on
                findings that will never enforce it. */}
            {finding.status !== 'resolved' &&
              (finding.severity === 'high' || finding.severity === 'critical') && (
              <div className="mt-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Resolution note
                </h4>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={2}
                  placeholder="Required for high/critical findings — how was this resolved?"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {finding.status !== 'in_review' && finding.status !== 'resolved' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => doTransition('in_review')}
                  disabled={transition.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Mark in review
                </Button>
              )}
              {finding.status !== 'resolved' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const requiresNote =
                      finding.severity === 'high' || finding.severity === 'critical';
                    if (requiresNote && !resolutionNote.trim()) {
                      // Inline guard — the build plan requires a
                      // resolution note for high+ severities.
                      alert('A resolution note is required for high or critical findings.');
                      return;
                    }
                    doTransition('resolved', {
                      resolutionNote: resolutionNote.trim() || undefined,
                    });
                  }}
                  disabled={transition.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {CHECK_GUIDANCE[finding.checkKey]?.resolveLabel ?? 'Resolve'}
                </Button>
              )}
              {finding.status !== 'ignored' && finding.status !== 'resolved' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => doTransition('ignored')}
                  disabled={transition.isPending}
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Ignore
                </Button>
              )}
              {(finding.transactionId || finding.vendorId) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={ignoreSimilar}
                  disabled={createSuppression.isPending}
                  title={
                    finding.transactionId
                      ? 'Suppress this transaction from future runs'
                      : 'Suppress this vendor from future runs'
                  }
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Ignore similar
                </Button>
              )}
            </div>
          </section>

          {/* History */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Activity
            </h4>
            {eventsQ.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : eventsQ.data?.events && eventsQ.data.events.length > 0 ? (
              <ol className="space-y-2">
                {eventsQ.data.events.map((ev) => (
                  <li key={ev.id} className="flex gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 mt-0.5 text-gray-400 shrink-0" />
                    <div>
                      <div className="text-gray-700">
                        <span className="text-gray-500">
                          {ev.fromStatus
                            ? `${STATUS_LABELS[ev.fromStatus]} → `
                            : 'Created → '}
                        </span>
                        <span className="font-medium">{STATUS_LABELS[ev.toStatus]}</span>
                      </div>
                      {ev.note && (
                        <div className="mt-0.5 inline-flex items-start gap-1 text-gray-600">
                          <MessageSquare className="h-3 w-3 mt-0.5 text-gray-400" />
                          {ev.note}
                        </div>
                      )}
                      <div className="text-gray-400">
                        {new Date(ev.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-500">
                No activity yet — this finding was just detected.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Keys rendered in the highlight sections (not repeated below).
const HIGHLIGHT_KEYS = new Set(['summary', 'reason', 'suggestion']);
// Machine identifiers: real context for support/debugging, noise for a
// reviewer — collapsed behind a "Technical details" disclosure.
const TECHNICAL_KEY = /(Id|Ids)$|^dedupe_key$/;
const CURRENCY_KEYS = new Set([
  'total', 'amount', 'balance', 'threshold', 'bankAmount', 'receiptTotal',
  'variance', 'totalPaidYTD', 'minAmountDollars', 'toleranceDollars',
]);
const PERCENT_KEYS = new Set(['samplePercent', 'tolerancePercent', 'dominantShare', 'confidence']);
const TIMESTAMP_KEYS = new Set(['matchedAt', 'createdAt', 'lastSyncAt']);

/** camelCase / snake_case key → "Sentence case" label. */
function labelFor(key: string): string {
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(key: string, v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (CURRENCY_KEYS.has(key)) {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (Number.isFinite(n)) {
      return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }
  }
  if (PERCENT_KEYS.has(key) && typeof v === 'number') {
    return `${Math.round(v * 100)}%`;
  }
  if (TIMESTAMP_KEYS.has(key) && typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Checks whose fix is "assign the missing contact" — those get an
// inline selector so the correction happens inside the review flow.
const CONTACT_FIX_CHECKS: Record<string, { label: string; filter: 'vendor' | 'customer' }> = {
  expense_without_payee: { label: 'Assign vendor', filter: 'vendor' },
  missing_required_customer: { label: 'Assign customer', filter: 'customer' },
};

function InlineContactFix({ finding }: { finding: Finding }) {
  const fix = CONTACT_FIX_CHECKS[finding.checkKey];
  const bulkUpdate = useBulkUpdateTransactions();
  const toast = useToast();
  const [contactId, setContactId] = useState('');
  if (!fix || !finding.transactionId) return null;
  const apply = () => {
    if (!contactId) return;
    bulkUpdate.mutate(
      { txnIds: [finding.transactionId!], setPayeeContactId: contactId },
      {
        onSuccess: () => {
          toast.success('Contact assigned — mark the finding resolved when you’re done.');
          setContactId('');
        },
        onError: (err: Error) => toast.error(err.message || 'Could not assign the contact.'),
      },
    );
  };
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Fix it here
      </h4>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <ContactSelector value={contactId} onChange={setContactId} contactTypeFilter={fix.filter} compact />
        </div>
        <Button size="sm" onClick={apply} disabled={!contactId} loading={bulkUpdate.isPending}>
          {fix.label}
        </Button>
      </div>
    </section>
  );
}

// The three reviewer-facing payload fields, rendered prominently:
// what's under review, why it was flagged, and what to do about it.
function PayloadHighlights({ payload }: { payload: Record<string, unknown> | null }) {
  const p = payload ?? {};
  const summary = typeof p['summary'] === 'string' ? (p['summary'] as string) : null;
  const reason = typeof p['reason'] === 'string' ? (p['reason'] as string) : null;
  const suggestion = typeof p['suggestion'] === 'string' ? (p['suggestion'] as string) : null;
  if (!summary && !reason && !suggestion) return null;
  return (
    <section className="space-y-2">
      {summary && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
          {summary}
        </div>
      )}
      {reason && <p className="text-sm text-gray-700">{reason}</p>}
      {suggestion && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span className="font-semibold">Suggested action: </span>
          {suggestion}
        </div>
      )}
    </section>
  );
}

// Deep links to every record the finding references, so the reviewer
// can verify without hunting: the transaction, its duplicate partner,
// the bank feed, the rules page, or the bank-connections page.
function FindingLinks({ finding }: { finding: Finding }) {
  const p = (finding.payload ?? {}) as Record<string, unknown>;
  const links: Array<{ to: string; label: string }> = [];
  if (finding.transactionId) links.push({ to: `/transactions/${finding.transactionId}`, label: 'Open transaction' });
  if (typeof p['partnerTransactionId'] === 'string') {
    links.push({ to: `/transactions/${p['partnerTransactionId']}`, label: 'Open possible duplicate' });
  }
  if (typeof p['bankFeedItemId'] === 'string') links.push({ to: '/banking/feed', label: 'Open bank feed' });
  if (typeof p['ruleId'] === 'string') links.push({ to: '/practice/rules', label: 'View rules' });
  if (typeof p['plaidItemId'] === 'string') links.push({ to: '/banking', label: 'Open bank connections' });
  if (links.length === 0) return null;
  return (
    <section className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.label}
          to={l.to}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {l.label}
        </Link>
      ))}
    </section>
  );
}

function PayloadView({ payload }: { payload: Record<string, unknown> | null }) {
  const entries = Object.entries(payload ?? {}).filter(([k]) => !HIGHLIGHT_KEYS.has(k));
  const context = entries.filter(([k]) => !TECHNICAL_KEY.test(k));
  const technical = entries.filter(([k]) => TECHNICAL_KEY.test(k));
  if (entries.length === 0) {
    return <p className="text-xs text-gray-500">No additional context.</p>;
  }
  return (
    <section>
      {context.length > 0 && (
        <>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Details
          </h4>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
            {context.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="col-span-1 truncate font-medium text-gray-500">{labelFor(k)}</dt>
                <dd className="col-span-2 break-words text-gray-800">{formatValue(k, v)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {technical.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
            Technical details
          </summary>
          <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
            {technical.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="col-span-1 truncate font-medium text-gray-400">{k}</dt>
                <dd className="col-span-2 break-words text-gray-500">{formatValue(k, v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

function PayeeCodingHistory({ findingId }: { findingId: string }) {
  const q = usePayeeHistory(findingId);
  const data = q.data;
  if (!data || !data.payeeId) return null;
  const total = data.rows.reduce((a, r) => a + r.count, 0);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        How {data.payeeName ?? 'this payee'} was coded (prior 12 months)
      </h4>
      {data.rows.length === 0 ? (
        <p className="text-sm text-gray-500">No earlier transactions with this payee.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <li key={r.accountId} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-gray-800">{r.accountName}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                    {r.count} of {total} · {fmt.format(Math.abs(Number(r.total)))}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 rounded bg-gray-100" aria-hidden="true">
                  <div className="h-1.5 rounded bg-indigo-400" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DuplicateMerge({ finding }: { finding: Finding }) {
  const merge = useMergeContacts();
  const transition = useTransitionFinding();
  const toast = useToast();
  const p = (finding.payload ?? {}) as Record<string, unknown>;
  if (finding.checkKey !== 'duplicate_entity_names' || finding.status === 'resolved') return null;
  const a = { id: p['contactIdA'] as string | undefined, name: p['nameA'] as string | undefined };
  const b = { id: p['contactIdB'] as string | undefined, name: p['nameB'] as string | undefined };
  if (!a.id || !b.id) return null;
  const keep = (target: typeof a, source: typeof a) => {
    merge.mutate({ sourceId: source.id!, targetId: target.id! }, {
      onSuccess: () => {
        transition.mutate({ id: finding.id, status: 'resolved', resolutionNote: `Merged "${source.name}" into "${target.name}"` });
        toast.success(`Merged "${source.name}" into "${target.name}". Its transactions now belong to "${target.name}".`);
      },
      onError: (e: Error) => toast.error(e.message || 'Could not merge.'),
    });
  };
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Merge the duplicates</h4>
      <p className="mb-2 text-xs text-gray-600">Keeps one, moves every transaction from the other onto it, and deactivates the other.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={merge.isPending} onClick={() => keep(a, b)}>Keep “{a.name}”</Button>
        <Button size="sm" variant="secondary" loading={merge.isPending} onClick={() => keep(b, a)}>Keep “{b.name}”</Button>
      </div>
    </section>
  );
}

// On-request AI review of one row: why it may be wrong, a likely fix, and a
// question for the client. Stored on the finding; flagged "out of date" when
// the underlying books change, with Re-run.
function FindingAiPanel({ finding }: { finding: Finding }) {
  const enabled = useFeatureFlag('AI_JUDGMENT_CHECKS_V1') === true;
  const portalOn = useFeatureFlag('CLIENT_PORTAL_V1') === true;
  const q = useFindingAi(enabled ? finding.id : null);
  const explain = useExplainFinding();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  if (!enabled) return null;
  const ai = q.data?.ai ?? null;
  const run = () => explain.mutate(finding.id, { onError: (e: Error) => toast.error(e.message || 'The AI could not explain this item.') });
  const ask = async () => {
    if (!ai?.clientQuestion || !finding.transactionId || !finding.companyId) return;
    setAsking(true);
    try {
      await apiClient('/practice/portal/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ companyId: finding.companyId, body: ai.clientQuestion, transactionIds: [finding.transactionId] }),
      });
      toast.success('Question saved for the client. They get it in their next reminder.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not ask the client.');
    } finally {
      setAsking(false);
    }
  };
  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-3" aria-label="AI review">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-800">
          <Sparkles className="h-3.5 w-3.5" /> AI review
        </h4>
        <Button size="sm" variant="secondary" onClick={run} loading={explain.isPending}>
          {ai ? 'Re-run' : 'Explain this'}
        </Button>
      </div>
      {!ai ? (
        <p className="text-xs text-gray-600">Ask the AI why this may be wrong, what to fix, and what to ask the client. Uses AI credits.</p>
      ) : (
        <div className="space-y-2 text-sm text-gray-800">
          {q.data?.stale && (
            <p className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Out of date: the books changed since this was written. Re-run for a fresh read.</p>
          )}
          <p>{ai.explanation}</p>
          {ai.suggestedFix && <p><span className="font-medium">Suggested fix:</span> {ai.suggestedFix}</p>}
          {ai.clientQuestion && (
            <div className="rounded border border-violet-200 bg-white p-2">
              <div className="text-xs text-gray-500">Question for the client</div>
              <p className="text-sm">{ai.clientQuestion}</p>
              {portalOn && finding.transactionId && finding.companyId && (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => void ask()} loading={asking}>Ask the client this</Button>
              )}
            </div>
          )}
          <p className="text-[11px] text-gray-500">{ai.provider} · {ai.model} · {new Date(ai.at).toLocaleString()}. Check it before acting on it.</p>
        </div>
      )}
    </section>
  );
}
