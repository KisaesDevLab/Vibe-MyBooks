// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { CheckCircle2, Circle, Undo2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import { useCloseRecord, useSignClose, useUndoCloseSignoff } from '../../../api/hooks/useReviewChecks';
import type { ClosePeriod } from './ClosePeriodSelector';

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Not started', cls: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In progress', cls: 'bg-amber-100 text-amber-800' },
  prepared: { label: 'Ready for review', cls: 'bg-blue-100 text-blue-800' },
  closed: { label: 'Closed', cls: 'bg-emerald-100 text-emerald-800' },
};

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : '';
}

// Month-end sign-off chain: the preparer signs once the work is done, then a
// reviewer signs to close the month. Each step can be undone, newest first.
export function CloseSignoffCard({ companyId, period }: { companyId: string | null; period: ClosePeriod }) {
  const ps = period.periodStart.slice(0, 10);
  const pe = period.periodEnd.slice(0, 10);
  const q = useCloseRecord(companyId, ps, pe);
  const sign = useSignClose();
  const undo = useUndoCloseSignoff();
  const toast = useToast();
  const [note, setNote] = useState('');
  const close = q.data?.close;
  if (!close) return null;
  const status = STATUS_COPY[close.status] ?? STATUS_COPY['not_started']!;
  const month = period.label.replace(' (current)', '');

  const doSign = (role: 'preparer' | 'reviewer') => sign.mutate(
    { companyId, periodStart: ps, periodEnd: pe, role, note: note.trim() || undefined },
    {
      onSuccess: () => { setNote(''); toast.success(role === 'preparer' ? `${month} is ready for review.` : `${month} is closed.`); },
      onError: (e: Error) => toast.error(e.message || 'Could not sign off.'),
    },
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="Close sign-off">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{month} close</h3>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>
        <span className="text-xs text-gray-500">
          {close.hasRun
            ? `${close.openFindings} review item${close.openFindings === 1 ? '' : 's'} still open`
            : 'Checks not run for this month yet'}
        </span>
      </div>

      <ol className="mt-3 space-y-2 text-sm">
        <li className="flex items-start gap-2">
          {close.preparedAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-gray-300" />}
          <div>
            <div className="font-medium text-gray-900">Preparer sign-off</div>
            {close.preparedAt
              ? <div className="text-xs text-gray-600">{close.preparedByName ?? 'Someone'} · {when(close.preparedAt)}{close.preparedNote ? ` — ${close.preparedNote}` : ''}</div>
              : <div className="text-xs text-gray-500">The person who did the work confirms the month is ready.</div>}
          </div>
        </li>
        <li className="flex items-start gap-2">
          {close.reviewedAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 text-gray-300" />}
          <div>
            <div className="font-medium text-gray-900">Reviewer sign-off</div>
            {close.reviewedAt
              ? <div className="text-xs text-gray-600">{close.reviewedByName ?? 'Someone'} · {when(close.reviewedAt)}{close.reviewedNote ? ` — ${close.reviewedNote}` : ''}</div>
              : <div className="text-xs text-gray-500">A second person reviews and closes the month.</div>}
          </div>
        </li>
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {close.status !== 'closed' && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the record (optional)"
            aria-label="Sign-off note"
            className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        )}
        {(close.status === 'not_started' || close.status === 'in_progress') && (
          <Button size="sm" onClick={() => doSign('preparer')} loading={sign.isPending} disabled={!close.hasRun}
            title={close.hasRun ? undefined : 'Run the checks for this month first'}>
            Sign off as preparer
          </Button>
        )}
        {close.status === 'prepared' && (
          <Button size="sm" onClick={() => doSign('reviewer')} loading={sign.isPending}>
            Sign off as reviewer and close
          </Button>
        )}
        {(close.status === 'prepared' || close.status === 'closed') && (
          <Button size="sm" variant="secondary" loading={undo.isPending}
            onClick={() => undo.mutate(
              { companyId, periodStart: ps, periodEnd: pe },
              { onError: (e: Error) => toast.error(e.message || 'Could not undo.') },
            )}>
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            Undo {close.status === 'closed' ? 'reviewer' : 'preparer'} sign-off
          </Button>
        )}
      </div>
      {close.hasRun && close.openFindings > 0 && close.status !== 'closed' && (
        <p className="mt-2 text-xs text-amber-700">
          {close.openFindings} item{close.openFindings === 1 ? ' is' : 's are'} still open in Review. You can still sign off; the open items stay on record.
        </p>
      )}
    </section>
  );
}
