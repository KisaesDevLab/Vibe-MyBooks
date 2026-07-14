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
} from 'lucide-react';
import type { CheckRegistryEntry, Finding, FindingStatus } from '@kis-books/shared';
import {
  useFindingEvents,
  useTransitionFinding,
  useCreateSuppression,
} from '../../../../api/hooks/useReviewChecks';
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
export function FindingDetailDrawer({ finding, registry, onClose }: Props) {
  const eventsQ = useFindingEvents(finding?.id ?? null);
  const transition = useTransitionFinding();
  const createSuppression = useCreateSuppression();
  const [note, setNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  // Reset note state when switching findings.
  useEffect(() => {
    setNote('');
    setResolutionNote('');
  }, [finding?.id]);

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
      onClick={onClose}
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
