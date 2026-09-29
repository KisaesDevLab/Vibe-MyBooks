// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import clsx from 'clsx';
import {
  Ban, CheckCircle2, CircleDot, Download, Eye, Flag, HelpCircle, Paperclip, Pencil,
  Printer, Send, Sparkles, Wallet, XCircle,
} from 'lucide-react';
import type { TransactionActivityEvent, TransactionActivityKind } from '@kis-books/shared';
import { useTransactionActivity } from '../../api/hooks/useTransactions';

const ICONS: Record<TransactionActivityKind, React.ComponentType<{ className?: string }>> = {
  imported: Download,
  suggested: Sparkles,
  staged: CircleDot,
  excluded: XCircle,
  created: CheckCircle2,
  edited: Pencil,
  voided: Ban,
  printed: Printer,
  sent: Send,
  viewed: Eye,
  paid: Wallet,
  attachment_added: Paperclip,
  attachment_removed: Paperclip,
  reviewed: CheckCircle2,
  unreviewed: CircleDot,
  finding: Flag,
  finding_update: Flag,
  question: HelpCircle,
  question_update: HelpCircle,
};

const TONES: Partial<Record<TransactionActivityKind, string>> = {
  created: 'text-emerald-600 bg-emerald-50',
  reviewed: 'text-emerald-600 bg-emerald-50',
  voided: 'text-rose-600 bg-rose-50',
  excluded: 'text-rose-600 bg-rose-50',
  finding: 'text-amber-600 bg-amber-50',
  suggested: 'text-amber-600 bg-amber-50',
  edited: 'text-indigo-600 bg-indigo-50',
};

// Long histories (imports touched many times) open collapsed to the newest.
const COLLAPSED_COUNT = 8;

function when(at: string): string {
  return new Date(at).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// The transaction's activity log, oldest first: where it came from, who
// posted and changed it, review marks, attachments, review findings and
// client questions. Sits at the bottom of the transaction view.
export function TransactionActivityCard({ transactionId }: { transactionId: string }) {
  const { data, isLoading, isError, refetch } = useTransactionActivity(transactionId);
  const [showAll, setShowAll] = useState(false);

  const events: TransactionActivityEvent[] = data?.events ?? [];
  const hidden = showAll ? 0 : Math.max(0, events.length - COLLAPSED_COUNT);
  const shown = hidden > 0 ? events.slice(hidden) : events;

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Activity</h2>
      {isLoading ? (
        <div className="space-y-3" aria-label="Loading activity">
          {[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-gray-100" />)}
        </div>
      ) : isError ? (
        <div className="text-sm text-gray-600">
          Couldn&apos;t load the activity.{' '}
          <button onClick={() => refetch()} className="underline text-gray-900">Retry</button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">No activity recorded for this transaction.</p>
      ) : (
        <>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mb-3 text-sm text-indigo-700 hover:underline"
            >
              Show {hidden} earlier {hidden === 1 ? 'entry' : 'entries'}
            </button>
          )}
          <ol className="relative space-y-4 border-l border-gray-200 pl-6">
            {shown.map((e, i) => {
              const Icon = ICONS[e.kind] ?? CircleDot;
              return (
                <li key={`${e.at}-${e.kind}-${i}`} className="relative">
                  <span
                    className={clsx(
                      'absolute -left-[35px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                      TONES[e.kind] ?? 'text-gray-500 bg-gray-100',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="text-sm font-medium text-gray-900">{e.title}</span>
                    <time dateTime={e.at} className="text-xs text-gray-500">{when(e.at)}</time>
                  </div>
                  {e.detail && <div className="text-sm text-gray-600 break-words">{e.detail}</div>}
                  <div className="text-xs text-gray-500">{e.actor ? `by ${e.actor}` : 'Automatic'}</div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
