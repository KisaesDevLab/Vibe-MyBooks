// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Close Review → Bank feed, the reviewer pass. Lists the period's bank-feed
// items that are already categorized, matched or excluded — usually done on
// the Banking screen before the close — grouped by how each one got its
// category, so a reviewer can confirm ("Looks right") or fix
// ("Recategorize") the coding. Progress is "X of N reviewed".

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ExternalLink, Pencil, Undo2 } from 'lucide-react';
import {
  useFeedReviewList,
  useMarkFeedReviewed,
  useRecategorizeFeedItems,
  type FeedReviewMethod,
  type FeedReviewRow,
  type FeedReviewStatus,
  type FeedReviewSummary,
} from '../../../api/hooks/useClassificationState';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { ContactSelector } from '../../../components/forms/ContactSelector';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useToast } from '../../../components/ui/Toaster';
import type { ClosePeriod } from './ClosePeriodSelector';

export const METHOD_LABELS: Record<FeedReviewMethod, string> = {
  rule: 'Bank rule',
  ai: 'AI suggestion',
  history: 'Payee history',
  check_image: 'Check image',
  manual: 'By hand',
  matched: 'Matched',
  excluded: 'Excluded',
};

const METHOD_HINTS: Record<FeedReviewMethod, string> = {
  rule: 'A bank rule set the category and it was posted unchanged.',
  ai: 'The AI suggested the category and it was accepted unchanged.',
  history: "Suggested from this payee's past categories and accepted unchanged.",
  check_image: 'Suggested from the payee read off the check image and accepted unchanged.',
  manual: 'A person picked the category (no suggestion, or they changed it).',
  matched: 'Matched to a transaction already in the books.',
  excluded: 'Excluded from the books (not posted).',
};

const METHOD_TONES: Record<FeedReviewMethod, string> = {
  rule: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ai: 'bg-amber-50 text-amber-700 border-amber-200',
  history: 'bg-sky-50 text-sky-700 border-sky-200',
  check_image: 'bg-sky-50 text-sky-700 border-sky-200',
  manual: 'bg-violet-50 text-violet-700 border-violet-200',
  matched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  excluded: 'bg-gray-50 text-gray-600 border-gray-200',
};

const METHOD_ORDER: FeedReviewMethod[] = ['rule', 'ai', 'history', 'check_image', 'manual', 'matched', 'excluded'];

const SKIP_REASONS: Record<string, string> = {
  split: 'split across several categories — edit it on the transaction',
  no_category_line: 'no category line to change (a transfer or payment) — edit it on the transaction',
  locked: 'dated in a locked period',
  void: 'voided',
  aje: 'an adjusting entry',
  excluded: 'excluded, so nothing was posted',
  not_posted: 'not posted',
  not_found: 'no longer found',
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface Props {
  companyId: string | null;
  period: ClosePeriod;
  summary: FeedReviewSummary;
}

export function FeedReviewSection({ companyId, period, summary }: Props) {
  const [method, setMethod] = useState<FeedReviewMethod | undefined>(undefined);
  const [status, setStatus] = useState<FeedReviewStatus>('todo');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Recategorize editor: one row id, or 'bulk' for the selection.
  const [editing, setEditing] = useState<string | null>(null);
  const toast = useToast();

  const query = useFeedReviewList({
    companyId, periodStart: period.periodStart, periodEnd: period.periodEnd, method, status,
  });
  const mark = useMarkFeedReviewed();
  const recategorize = useRecategorizeFeedItems();

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    setSelected(new Set());
    setEditing(null);
  }, [companyId, period.periodStart, method, status]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.feedItemId));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const markReviewed = (ids: string[], reviewed: boolean) => {
    mark.mutate(
      { feedItemIds: ids, reviewed, companyId },
      {
        onSuccess: () => setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        }),
        onError: (err: Error) => toast.error(err.message || 'Could not update the review marks.'),
      },
    );
  };

  const applyRecategorize = (ids: string[], accountId: string, contactId: string) => {
    recategorize.mutate(
      {
        feedItemIds: ids,
        ...(accountId ? { accountId } : {}),
        ...(contactId ? { contactId } : {}),
        companyId,
      },
      {
        onSuccess: (res) => {
          setEditing(null);
          setSelected(new Set());
          if (res.skipped.length === 0) {
            toast.success(`Updated ${res.updated} transaction${res.updated === 1 ? '' : 's'} and marked ${res.updated === 1 ? 'it' : 'them'} reviewed.`);
          } else {
            const first = res.skipped[0]!;
            const why = SKIP_REASONS[first.reason] ?? first.reason;
            toast.error(
              `Updated ${res.updated}; skipped ${res.skipped.length} (${why}${res.skipped.length > 1 ? ', …' : ''}).`,
            );
          }
        },
        onError: (err: Error) => toast.error(err.message || 'Could not recategorize.'),
      },
    );
  };

  const chips = METHOD_ORDER.filter((m) => summary.byMethod[m].total > 0);
  const left = summary.doneTotal - summary.reviewed;

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Review what was categorized</h3>
          <p className="text-xs text-gray-500">
            Bank transactions for {period.label} that are already categorized, matched or excluded. Confirm each
            one looks right, or fix it — a fix updates the posted transaction and teaches the payee history.
          </p>
        </div>
        <div className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{summary.reviewed} of {summary.doneTotal}</span> reviewed
          {left > 0 && <span className="text-gray-500"> · {left} to go</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <MethodChip
          label="All"
          count={`${summary.reviewed}/${summary.doneTotal}`}
          active={method === undefined}
          onClick={() => setMethod(undefined)}
        />
        {chips.map((m) => (
          <MethodChip
            key={m}
            label={METHOD_LABELS[m]}
            title={METHOD_HINTS[m]}
            count={`${summary.byMethod[m].reviewed}/${summary.byMethod[m].total}`}
            active={method === m}
            onClick={() => setMethod(m)}
          />
        ))}
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-gray-200 text-xs">
          {(['todo', 'reviewed', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={clsx(
                'px-3 py-1.5 font-medium',
                status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {s === 'todo' ? 'To review' : s === 'reviewed' ? 'Reviewed' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y border-indigo-100 bg-indigo-50 px-4 py-2 text-sm">
          <span className="font-medium text-indigo-900">{selected.size} selected</span>
          <Button size="sm" onClick={() => markReviewed([...selected], true)} loading={mark.isPending}>
            <Check className="mr-1 h-4 w-4" /> Looks right
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing('bulk')}>
            <Pencil className="mr-1 h-4 w-4" /> Recategorize…
          </Button>
          {status !== 'todo' && (
            <Button size="sm" variant="secondary" onClick={() => markReviewed([...selected], false)}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo review
            </Button>
          )}
          <button type="button" className="ml-auto text-xs text-indigo-700 hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}
      {editing === 'bulk' && (
        <RecategorizeEditor
          count={selected.size}
          saving={recategorize.isPending}
          onCancel={() => setEditing(null)}
          onApply={(a, c) => applyRecategorize([...selected], a, c)}
        />
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
      ) : query.isError ? (
        <div className="p-4"><ErrorMessage message="Couldn't load the categorized transactions." onRetry={() => query.refetch()} /></div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          {status === 'todo'
            ? summary.doneTotal === 0
              ? `Nothing has been categorized for ${period.label} yet.`
              : 'Everything here has been reviewed.'
            : 'No transactions match this filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all loaded rows"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.feedItemId)))}
                  />
                </th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Payee</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">How</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <FeedReviewTableRow
                  key={row.feedItemId}
                  row={row}
                  selected={selected.has(row.feedItemId)}
                  onToggle={() => toggle(row.feedItemId)}
                  editing={editing === row.feedItemId}
                  onEdit={() => setEditing(editing === row.feedItemId ? null : row.feedItemId)}
                  onLooksRight={() => markReviewed([row.feedItemId], true)}
                  onUndo={() => markReviewed([row.feedItemId], false)}
                  saving={recategorize.isPending}
                  onApply={(a, c) => applyRecategorize([row.feedItemId], a, c)}
                  busy={mark.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.hasNextPage && (
        <div className="flex items-center justify-center gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Showing {rows.length} of {total}
          <Button size="sm" variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}

function MethodChip({ label, count, active, onClick, title }: {
  label: string; count: string; active: boolean; onClick: () => void; title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {label}
      <span className={clsx('tabular-nums', active ? 'text-gray-300' : 'text-gray-400')}>{count}</span>
    </button>
  );
}

function categoryCell(row: FeedReviewRow) {
  if (row.status === 'excluded') return <span className="text-gray-400">Not posted</span>;
  if (row.categoryCount > 1) return <span className="text-gray-700">Split ({row.categoryCount} lines)</span>;
  if (!row.categoryAccountName) return <span className="text-gray-400">—</span>;
  return <span className="text-gray-900">{row.categoryAccountName}</span>;
}

function FeedReviewTableRow({
  row, selected, onToggle, editing, onEdit, onLooksRight, onUndo, saving, onApply, busy,
}: {
  row: FeedReviewRow;
  selected: boolean;
  onToggle: () => void;
  editing: boolean;
  onEdit: () => void;
  onLooksRight: () => void;
  onUndo: () => void;
  saving: boolean;
  onApply: (accountId: string, contactId: string) => void;
  busy: boolean;
}) {
  // Feed amounts are positive for money out; show money in as positive.
  const amount = -Number(row.amount);
  const canRecategorize = row.status !== 'excluded' && !!row.transactionId && !row.txnVoid;
  const bank = row.bankAccountName ?? row.institutionName;
  return (
    <>
      <tr className={clsx(selected && 'bg-indigo-50/50')}>
        <td className="px-3 py-2 align-top">
          <input type="checkbox" aria-label={`Select ${row.description ?? 'transaction'}`} checked={selected} onChange={onToggle} />
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">{row.feedDate}</td>
        <td className="px-3 py-2 align-top">
          <div className="text-gray-900">{row.description ?? '—'}</div>
          {bank && <div className="text-xs text-gray-500">{bank}{row.mask ? ` ••${row.mask}` : ''}</div>}
        </td>
        <td className="px-3 py-2 align-top">
          {row.payeeName ?? <span className="text-amber-700">No payee</span>}
        </td>
        <td className="px-3 py-2 align-top">
          {categoryCell(row)}
          {row.suggestedAccountName && (
            <div className="text-xs text-gray-500">Changed from suggestion: {row.suggestedAccountName}</div>
          )}
          {row.txnVoid && <div className="text-xs text-rose-700">Transaction is void</div>}
        </td>
        <td className="px-3 py-2 align-top">
          <span
            title={METHOD_HINTS[row.method]}
            className={clsx('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', METHOD_TONES[row.method])}
          >
            {METHOD_LABELS[row.method]}
          </span>
        </td>
        <td className={clsx('whitespace-nowrap px-3 py-2 text-right align-top tabular-nums', amount > 0 ? 'text-emerald-700' : 'text-gray-900')}>
          {money.format(amount)}
        </td>
        <td className="px-3 py-2 align-top">
          <div className="flex items-center justify-end gap-1.5">
            {row.reviewedAt ? (
              <button
                type="button"
                onClick={onUndo}
                disabled={busy}
                title="Undo the review mark"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Check className="h-3.5 w-3.5" /> Reviewed
              </button>
            ) : (
              <button
                type="button"
                onClick={onLooksRight}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Check className="h-3.5 w-3.5" /> Looks right
              </button>
            )}
            {canRecategorize && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Recategorize
              </button>
            )}
            {row.transactionId && (
              <Link
                to={`/transactions/${row.transactionId}`}
                title="Open the transaction"
                aria-label="Open the transaction"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={8} className="p-0">
            <RecategorizeEditor
              count={1}
              initialAccountId={row.categoryCount === 1 ? (row.categoryAccountId ?? '') : ''}
              initialContactId={row.payeeContactId ?? ''}
              saving={saving}
              onCancel={onEdit}
              onApply={onApply}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function RecategorizeEditor({
  count, initialAccountId = '', initialContactId = '', saving, onCancel, onApply,
}: {
  count: number;
  initialAccountId?: string;
  initialContactId?: string;
  saving: boolean;
  onCancel: () => void;
  onApply: (accountId: string, contactId: string) => void;
}) {
  const [accountId, setAccountId] = useState(initialAccountId);
  const [contactId, setContactId] = useState(initialContactId);
  const changed = (accountId && accountId !== initialAccountId) || (contactId && contactId !== initialContactId);
  return (
    <div className="flex flex-wrap items-end gap-3 border-y border-gray-100 bg-gray-50 px-4 py-3">
      <div className="min-w-[240px] flex-1">
        <AccountSelector label="Category" value={accountId} onChange={setAccountId} compact />
      </div>
      <div className="min-w-[220px] flex-1">
        <ContactSelector label="Payee (optional)" value={contactId} onChange={setContactId} compact />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          disabled={!changed}
          loading={saving}
          onClick={() => onApply(
            accountId !== initialAccountId ? accountId : '',
            contactId !== initialContactId ? contactId : '',
          )}
        >
          Save{count > 1 ? ` (${count})` : ''} and mark reviewed
        </Button>
      </div>
    </div>
  );
}
