// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The Checklist tab — the ordered month-end close workflow, worked top
// to bottom: reconcile every bank/credit-card account, clear the
// bank-feed backlog, clear the findings queue, final-review the
// statements. Auto tasks derive their state from the books; any task
// can be manually signed off (with a note) when it was satisfied
// outside the app, and a sign-off can be withdrawn.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ExternalLink, Loader2, Play, Undo2 } from 'lucide-react';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import {
  useCloseChecklist,
  useCompleteChecklistTask,
  useReopenChecklistTask,
  useRunChecks,
  type CloseChecklistTask,
} from '../../../api/hooks/useReviewChecks';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useToast } from '../../../components/ui/Toaster';
import { CloseSignoffCard } from './CloseSignoffCard';
import type { ClosePeriod } from './ClosePeriodSelector';

const SECTIONS: Array<{ key: CloseChecklistTask['section']; title: string; blurb: string }> = [
  { key: 'reconciliations', title: '1 · Reconcile the accounts', blurb: 'Every bank and credit-card account should be reconciled through the period end before anything else is trusted.' },
  { key: 'transactions', title: '2 · Catch up the transactions', blurb: 'Everything the bank reported should be categorized (or excluded) so the books are complete — then a reviewer confirms how it was coded.' },
  { key: 'review', title: '3 · Review the checks', blurb: 'Run the review checks for the period and work every finding to resolved or ignored.' },
  { key: 'final', title: '4 · Final review', blurb: 'Read the statements the way the client (or their CPA) will.' },
];

// Where each task's work actually happens.
function taskLink(
  task: CloseChecklistTask,
  onOpenFindings: () => void,
  onOpenBankFeed?: () => void,
): { to?: string; onClick?: () => void; label: string } | null {
  if (task.key.startsWith('reconcile:')) return { to: '/banking/reconcile', label: 'Open reconciliation' };
  if (task.key === 'bank_feed') return { to: '/banking/feed', label: 'Open bank feed' };
  if (task.key === 'bank_feed_review') {
    return onOpenBankFeed ? { onClick: onOpenBankFeed, label: 'Review categorized' } : null;
  }
  if (task.key === 'findings') return { onClick: onOpenFindings, label: 'Open findings' };
  if (task.key === 'final_review') return { to: '/reports', label: 'Open reports' };
  return null;
}

export function ChecklistTab({
  period, onOpenFindings, onOpenBankFeed,
}: {
  period: ClosePeriod;
  onOpenFindings: () => void;
  /** Switches to the Bank feed tab; absent when that workflow is off. */
  onOpenBankFeed?: () => void;
}) {
  const { activeCompanyId } = useCompanyContext();
  const periodStart = period.periodStart.slice(0, 10);
  const periodEnd = period.periodEnd.slice(0, 10);
  const checklistQ = useCloseChecklist(activeCompanyId ?? null, periodStart, periodEnd);
  const complete = useCompleteChecklistTask();
  const reopen = useReopenChecklistTask();
  const runChecks = useRunChecks();
  const toast = useToast();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (checklistQ.isLoading) {
    return <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>;
  }
  if (checklistQ.isError) {
    return <ErrorMessage message="Couldn't load the close checklist." onRetry={() => checklistQ.refetch()} />;
  }
  const tasks = checklistQ.data?.tasks ?? [];
  const doneCount = tasks.filter((t) => t.done).length;
  // Checks never run on their own — say so up front, with the button here,
  // rather than only in the findings task's small print.
  const checksNotRun = tasks.some((t) => t.key === 'findings' && t.needsRun && !t.manuallyCompleted);

  const signOff = (task: CloseChecklistTask, withNote: string | null) => {
    complete.mutate(
      {
        companyId: activeCompanyId ?? null,
        periodStart,
        taskKey: task.key,
        note: withNote,
      },
      {
        // Close the note row only on success — a failed sign-off keeps
        // the typed note so the user can retry instead of retyping.
        onSuccess: () => { setNoteFor(null); setNote(''); },
        onError: (err: Error) => toast.error(err.message || 'Could not sign off the task.'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <CloseSignoffCard companyId={activeCompanyId ?? null} period={period} />
      {checksNotRun && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm text-amber-900">
            <div className="font-semibold">Review checks have not been run for {period.label.replace(' (current)', '')}</div>
            <div className="text-xs text-amber-800">
              Checks only run when you start them. They look for large or duplicate transactions, missing payees
              and attachments, unusual categories, 1099 gaps and more — then list anything to look at on the Review tab.
            </div>
          </div>
          <Button
            size="sm"
            disabled={runChecks.isPending}
            onClick={() => runChecks.mutate(
              {
                companyId: activeCompanyId ?? undefined,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
              },
              {
                onSuccess: (res) => {
                  const found = res.runs.reduce((n, r) => n + r.findingsCreated, 0);
                  toast.success(found === 0 ? 'Checks finished — nothing new to review.' : `Checks finished — ${found} finding${found === 1 ? '' : 's'} to review.`);
                },
                onError: (err: Error) => toast.error(err.message || 'Could not run the checks.'),
              },
            )}
          >
            {runChecks.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
            Run checks now
          </Button>
        </div>
      )}
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{doneCount} of {tasks.length}</span> close tasks done for {period.label}.
      </p>
      {SECTIONS.map((section) => {
        const sectionTasks = tasks.filter((t) => t.section === section.key);
        if (sectionTasks.length === 0) return null;
        return (
          <section key={section.key} className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              <p className="text-xs text-gray-500">{section.blurb}</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {sectionTasks.map((task) => {
                const link = taskLink(task, onOpenFindings, onOpenBankFeed);
                return (
                  <li key={task.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {task.done
                      ? <CheckCircle2 role="img" className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Done" />
                      : <Circle role="img" className="h-5 w-5 shrink-0 text-gray-300" aria-label="Not done" />}
                    <div className="min-w-[220px] flex-1">
                      <div className="text-sm font-medium text-gray-900">{task.label}</div>
                      {task.detail && <div className="text-xs text-gray-500">{task.detail}</div>}
                      {task.manuallyCompleted && (
                        <div className="text-xs text-emerald-700">
                          Signed off{task.note ? ` — ${task.note}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {link && (link.to ? (
                        <Link
                          to={link.to}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {link.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={link.onClick}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {link.label}
                        </button>
                      ))}
                      {task.manuallyCompleted ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => reopen.mutate(
                            { companyId: activeCompanyId ?? null, periodStart, taskKey: task.key },
                            { onError: (err: Error) => toast.error(err.message || 'Could not reopen the task.') },
                          )}
                          loading={reopen.isPending && reopen.variables?.taskKey === task.key}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" />
                          Reopen
                        </Button>
                      ) : !task.done ? (
                        <Button size="sm" variant="secondary" onClick={() => { setNoteFor(task.key); setNote(''); }}>
                          Sign off
                        </Button>
                      ) : null}
                    </div>
                    {noteFor === task.key && (
                      <div className="flex w-full items-center gap-2 pl-8">
                        <input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder={task.auto
                            ? 'Why is this OK without the in-app step? (e.g. reconciled outside the app)'
                            : 'Optional note for the record…'}
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          aria-label={`Sign-off note for ${task.label}`}
                        />
                        <Button size="sm" onClick={() => signOff(task, note.trim() || null)} loading={complete.isPending}>
                          Mark done
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setNoteFor(null); setNote(''); }}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
