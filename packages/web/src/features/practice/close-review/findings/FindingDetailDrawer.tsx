// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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

  const checkName =
    registry.find((r) => r.checkKey === finding.checkKey)?.name ?? finding.checkKey;

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
            <p className="mt-1 text-xs text-gray-500">
              Detected {new Date(finding.createdAt).toLocaleString()}
            </p>
          </section>

          {/* Payload context */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Context
            </h4>
            <PayloadView payload={finding.payload} />
            {finding.transactionId && (
              <Link
                to={`/transactions/${finding.transactionId}`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open transaction
              </Link>
            )}
          </section>

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
              placeholder="Why are you doing this?"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />

            {finding.status !== 'resolved' && (
              <div className="mt-3">
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Resolution note (high+ severity)
                </h4>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={2}
                  placeholder="Required when severity ≥ high"
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
                  Resolve
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

function PayloadView({ payload }: { payload: Record<string, unknown> | null }) {
  if (!payload || Object.keys(payload).length === 0) {
    return <p className="text-xs text-gray-500">No additional context.</p>;
  }
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
      {Object.entries(payload).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="col-span-1 truncate font-medium text-gray-500">{k}</dt>
          <dd className="col-span-2 break-words text-gray-800">{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
