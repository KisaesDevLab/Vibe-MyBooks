// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tab 1 — bank lines that never reached the ledger. Two ways out: give one a
// real category, or park it in suspense so the bank reconciles now and the
// classification work moves to tab 2.

import { useState } from 'react';
import { CircleDot, Loader2, Paperclip, UserPen } from 'lucide-react';
import { AttachFileButton } from '../../attachments/AttachFileButton';
import { RowAttachmentsModal } from './RowAttachmentsModal';
import { formatMoney } from '../../../utils/money';
import { TableScroll } from '../../../components/ui/TableScroll';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toaster';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { ContactSelector } from '../../../components/forms/ContactSelector';
import { SortableTh } from '../../../components/ui/SortableTh';
import { RowCategoryCell } from './RowCategoryCell';
import { RowPayeeCell } from './RowPayeeCell';
import {
  useUnpostedFeed, usePostToSuspense, useSetFeedItemPayee, useBulkSetFeedPayee,
  type UnpostedRow, type UnpostedSortKey, type SortDir,
} from '../../../api/hooks/useUncategorized';
import { useBulkCategorize } from '../../../api/hooks/useBanking';

const PAGE_SIZE = 50;

/**
 * One row's unsaved picks. `accountId` is set once a category is picked;
 * `contactId` is set once the payee picker has been touched ('' = cleared),
 * and counts as dirty only when it differs from what the line already has.
 */
interface RowDraft { accountId?: string; contactId?: string }

/** The contact the line shows today: the human-assigned one, else the rule/AI suggestion. */
const currentContactId = (r: UnpostedRow) => r.assignedContactId || r.suggestedContactId || '';

export function NotPostedTab() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  // Server-side sort: the list paginates, so ordering the visible page alone
  // would lie. '' = the endpoint's default (newest first).
  const [sortBy, setSortBy] = useState<'' | UnpostedSortKey>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmSuspense, setConfirmSuspense] = useState(false);
  const [viewing, setViewing] = useState<UnpostedRow | null>(null);
  // Per-row payee + category drafts, keyed by feed item id. Nothing in a
  // draft is written until that row's Save is pressed — see RowCategoryCell.
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const toast = useToast();
  const query = useUnpostedFeed({
    limit: PAGE_SIZE, offset, search,
    sortBy: sortBy || undefined, sortDir: sortBy ? sortDir : undefined,
  });
  const postToSuspense = usePostToSuspense();
  const bulkCategorize = useBulkCategorize();
  const setPayee = useSetFeedItemPayee();
  const bulkSetPayee = useBulkSetFeedPayee();

  const rows: UnpostedRow[] = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const busy = postToSuspense.isPending || bulkCategorize.isPending || setPayee.isPending || bulkSetPayee.isPending;

  const payeeDirty = (r: UnpostedRow) => {
    const d = drafts[r.id]?.contactId;
    return d !== undefined && d !== currentContactId(r);
  };
  const anyDirty = rows.some((r) => payeeDirty(r) || !!drafts[r.id]?.accountId);

  const patchDraft = (id: string, patch: RowDraft) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const dropDraft = (id: string) => setDrafts((d) => {
    const next = { ...d };
    delete next[id];
    return next;
  });

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pageIds));
  const changePage = (next: number) => { setOffset(next); setSelected(new Set()); };
  // First click sorts ascending; a second click on the same column flips it.
  const toggleSort = (key: UnpostedSortKey) => {
    setSortDir(sortBy === key && sortDir === 'asc' ? 'desc' : 'asc');
    setSortBy(key);
    setOffset(0);
    setSelected(new Set());
  };

  // Save ONE row: the payee first — written onto the feed line the way the
  // Bank Feeds editor does, so the line stays pending and stays here — then
  // the category through the same endpoint as the bulk action, with one id,
  // so a row already handled elsewhere is reported rather than silently
  // dropped (bulkCategorize ignores anything not still 'pending'). The
  // posted transaction carries the contact the line has at that moment.
  const saveRow = (r: UnpostedRow) => {
    const feedItemId = r.id;
    const draft = drafts[feedItemId] ?? {};
    const accountId = draft.accountId;
    const wantsPayee = payeeDirty(r);
    if (!accountId && !wantsPayee) return;
    setSavingId(feedItemId);

    const finish = () => setSavingId(null);

    const saveCategory = () => {
      if (!accountId) {
        toast.success('Payee saved.');
        dropDraft(feedItemId);
        finish();
        return;
      }
      bulkCategorize.mutate(
        { feedItemIds: [feedItemId], accountId, ...(draft.contactId ? { contactId: draft.contactId } : {}) },
        {
          onSuccess: (res) => {
            const categorized = (res as { categorized?: number } | undefined)?.categorized ?? 0;
            if (categorized === 0) {
              // Keeps the draft: nothing posted, so the picker must not clear.
              toast.error('Not posted — this bank line was already handled. Refresh the list.');
              return;
            }
            toast.success('Category saved. The line has posted.');
            dropDraft(feedItemId);
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(feedItemId);
              return next;
            });
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save the category.'),
          onSettled: finish,
        },
      );
    };

    if (!wantsPayee) { saveCategory(); return; }
    setPayee.mutate(
      { feedItemId, contactId: draft.contactId || null },
      {
        onSuccess: () => {
          // The payee is on the line; only the category (if any) is still a draft.
          patchDraft(feedItemId, { contactId: undefined });
          saveCategory();
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : 'Could not save the payee.');
          finish();
        },
      },
    );
  };

  const applyCategory = () => {
    if (!categoryId || selected.size === 0) return;
    bulkCategorize.mutate(
      { feedItemIds: [...selected], accountId: categoryId },
      {
        onSuccess: (res) => {
          const categorized = (res as { categorized?: number } | undefined)?.categorized ?? 0;
          toast.success(`Categorized ${categorized} line(s).`);
          setSelected(new Set());
          setCategoryId('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not categorize.'),
      },
    );
  };

  // Toolbar "Set payee": one contact onto every ticked line. Written the way
  // the row-level save is — no staging — so the lines stay on this list.
  const applyPayee = () => {
    if (!payeeId || selected.size === 0) return;
    bulkSetPayee.mutate(
      { feedItemIds: [...selected], contactId: payeeId },
      {
        onSuccess: (res) => {
          const parts = [`Payee set on ${res.updated} line(s).`];
          if (res.skipped.length > 0) parts.push(`${res.skipped.length} already handled.`);
          toast.success(parts.join(' '));
          setSelected(new Set());
          setPayeeId('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not set the payee.'),
      },
    );
  };

  const doPostToSuspense = () => {
    setConfirmSuspense(false);
    postToSuspense.mutate([...selected], {
      onSuccess: (res) => {
        // bulkCategorize ignores rows that are not pending without reporting
        // them; the server counts those separately so the message is honest.
        const parts = [`Posted ${res.posted} line(s) to suspense.`];
        if (res.skipped.length > 0) parts.push(`${res.skipped.length} already handled.`);
        if (res.failures.length > 0) parts.push(`${res.failures.length} failed.`);
        toast.success(parts.join(' '));
        setSelected(new Set());
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not post to suspense.'),
    });
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOffset(0); setSelected(new Set()); }}
        placeholder="Search description, payee, or check #"
        className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      {anyDirty && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <CircleDot className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          A payee or category you pick is not saved until you press <strong>Save</strong> on that row.
          Saving a category posts it and removes the row from this list; a payee on its own keeps the row here.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={toggleAll}
            disabled={busy || pageIds.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 disabled:text-gray-400"
          >
            <span className={`inline-block h-4 w-4 rounded border ${
              allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
            }`} />
            {allSelected ? 'Deselect all' : 'Select all on this page'}
          </button>
          <span className="text-xs text-gray-500">{selected.size} of {rows.length} selected</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-64">
            <ContactSelector value={payeeId} onChange={setPayeeId} compact />
          </div>
          <Button variant="secondary" onClick={applyPayee} disabled={busy || !payeeId || selected.size === 0}>
            {bulkSetPayee.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPen className="h-4 w-4 mr-1" />}
            Set payee
          </Button>
          <div className="w-72">
            <AccountSelector value={categoryId} onChange={setCategoryId} compact />
          </div>
          <Button onClick={applyCategory} disabled={busy || !categoryId || selected.size === 0}>
            {bulkCategorize.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Categorize
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmSuspense(true)}
            disabled={busy || selected.size === 0}
          >
            Post to suspense
          </Button>
        </div>
      </div>

      <TableScroll>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2" />
              <SortableTh sortKey="feedDate" label="Date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="checkNumber" label="Ref" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              {/* The two pickers take the width the fixed columns leave;
                  Description wraps. Percentages are hints to the auto
                  layout, the min widths keep a picker usable when narrow. */}
              <SortableTh sortKey="payee" label="Payee" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} className="w-[22%] min-w-[12rem]" />
              <SortableTh sortKey="description" label="Description" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="amount" label="Amount" align="right" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <th className="w-[28%] min-w-[14rem] px-3 py-2">Category</th>
              <th className="px-3 py-2 text-center">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {query.isError && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-red-600">
                Could not load these lines. <button className="underline" onClick={() => query.refetch()}>Retry</button>
              </td></tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                Nothing waiting. Every bank line has been dealt with.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'bg-indigo-50' : undefined}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.description ?? 'line'}`}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.feedDate}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-600">
                  {r.checkNumber ?? '—'}
                </td>
                {/* Same precedence the Bank Feeds NAME column uses: the
                    human-assigned contact, then the rule/AI suggestion, with
                    the payee read off the check image as a hint under an
                    empty picker. Picking a contact with a default expense
                    account prefills an empty Category draft. */}
                <td className="px-3 py-2">
                  <RowPayeeCell
                    value={drafts[r.id]?.contactId ?? currentContactId(r)}
                    onChange={(next) => patchDraft(r.id, { contactId: next })}
                    onSelect={(c) => {
                      if (c?.defaultExpenseAccountId && !drafts[r.id]?.accountId) {
                        patchDraft(r.id, { accountId: c.defaultExpenseAccountId });
                      }
                    }}
                    checkPayee={r.payeeNameOnCheck}
                  />
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {/* Same as the In-suspense tab: the cleaned name shows, the
                      raw bank text is one hover away. */}
                  <span
                    title={r.originalDescription ? `On the statement: ${r.originalDescription}` : undefined}
                    className={r.originalDescription ? 'decoration-dotted underline-offset-4 hover:underline' : undefined}
                  >
                    {r.description ?? '(no description)'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.amount)}</td>
                <td className="px-3 py-2">
                  <RowCategoryCell
                    value={drafts[r.id]?.accountId ?? ''}
                    onChange={(next) => patchDraft(r.id, { accountId: next })}
                    onSave={() => saveRow(r)}
                    saving={savingId === r.id}
                    disabled={busy && savingId !== r.id}
                    payeeDirty={payeeDirty(r)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {r.attachmentCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setViewing(r)}
                        title={`${r.attachmentCount} file(s) attached — click to view`}
                        className="inline-flex items-center gap-1 rounded border border-primary-200 bg-primary-50 px-1.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="tabular-nums">{r.attachmentCount}</span>
                      </button>
                    ) : (
                      <AttachFileButton
                        attachableType="bank_feed_items"
                        attachableId={r.id}
                        invalidateKeys={[['uncategorized'], ['bank-feed']]}
                        compact
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={changePage} unit="lines" />

      <RowAttachmentsModal
        open={viewing !== null}
        title={viewing?.description || 'Bank line'}
        subtitle={viewing ? `${viewing.feedDate} · ${formatMoney(viewing.amount)}` : undefined}
        attachableType="bank_feed_items"
        attachableId={viewing?.id ?? ''}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={confirmSuspense}
        title="Post to suspense?"
        message={`${selected.size} line(s) will post to the suspense account. The bank will reconcile, and they move to the "In suspense" tab until you give them a real category.`}
        confirmLabel="Post to suspense"
        onConfirm={doPostToSuspense}
        onCancel={() => setConfirmSuspense(false)}
      />
    </div>
  );
}
