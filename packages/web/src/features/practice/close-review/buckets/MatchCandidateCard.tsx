// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import clsx from 'clsx';
import { Receipt, FileText, BookOpen, ArrowLeftRight, Repeat, Check, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MatchCandidate } from '@kis-books/shared';
import { useApplyMatch, useNotAMatch } from '../../../../api/hooks/useMatchActions';

const KIND_META: Record<MatchCandidate['kind'], { label: string; icon: LucideIcon; tone: string }> = {
  invoice: { label: 'Invoice', icon: FileText, tone: 'bg-emerald-50 text-emerald-700' },
  bill: { label: 'Bill', icon: Receipt, tone: 'bg-rose-50 text-rose-700' },
  journal_entry: { label: 'Journal Entry', icon: BookOpen, tone: 'bg-slate-100 text-slate-700' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, tone: 'bg-indigo-50 text-indigo-700' },
  recurring: { label: 'Recurring', icon: Repeat, tone: 'bg-amber-50 text-amber-700' },
};

interface Props {
  stateId: string;
  candidateIndex: number;
  candidate: MatchCandidate;
  feedAmount: number;
  duplicateWarning?: boolean;
}

// Per build plan §3.4 + §3.5: shows kind icon, target details
// (vendor/customer + reason text), composite score breakdown,
// Apply / Not a match buttons. Surfaces the partial-payment
// indicator when the feed amount is less than the candidate
// amount, and a duplicate-warning banner when the parent decides
// (multiple candidates within DUPLICATE_WARNING_DELTA of this
// score).
export function MatchCandidateCard({
  stateId,
  candidateIndex,
  candidate,
  feedAmount,
  duplicateWarning,
}: Props) {
  const meta = KIND_META[candidate.kind];
  const Icon = meta.icon;
  const apply = useApplyMatch();
  const notAMatch = useNotAMatch();

  const candidateAmount = parseFloat(candidate.amount);
  const isPartial = Math.abs(feedAmount) < candidateAmount;
  const remainder = candidateAmount - Math.abs(feedAmount);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 flex flex-col gap-2">
      {duplicateWarning && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-800">
          ⚠ Two close matches — verify before applying.
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.tone)}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          {isPartial && (
            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
              Partial payment
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-gray-600">
          {Math.round(candidate.score * 100)}% match
        </span>
      </div>
      <div className="text-sm text-gray-900">{candidate.reason}</div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span>Amount: <span className="font-mono">{fmt.format(candidateAmount)}</span></span>
        {candidate.date && <span>Date: <span className="font-mono">{candidate.date}</span></span>}
        {candidate.contactName && <span>Party: {candidate.contactName}</span>}
      </div>
      {isPartial && (
        <div className="text-xs text-amber-700">
          Remainder after match: <span className="font-mono">{fmt.format(remainder)}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
        <span>amt {candidate.amountScore.toFixed(2)}</span>
        <span>·</span>
        <span>date {candidate.dateScore.toFixed(2)}</span>
        <span>·</span>
        <span>name {candidate.nameScore.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => apply.mutate({ stateId, candidateIndex })}
          disabled={apply.isPending}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Apply match
        </button>
        <button
          type="button"
          onClick={() => notAMatch.mutate({ stateId, candidateIndex })}
          disabled={notAMatch.isPending}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Not a match
        </button>
      </div>
    </div>
  );
}
