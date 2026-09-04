// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tab 1 — bank lines that never reached the ledger. Two ways out: give one a
// real category, or park it in suspense so the bank reconciles now and the
// classification work moves to tab 2.

import { useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { AttachFileButton } from '../../attachments/AttachFileButton';
import { RowAttachmentsModal } from './RowAttachmentsModal';
import { formatMoney } from '../../../utils/money';
import { TableScroll } from '../../../components/ui/TableScroll';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toaster';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { useUnpostedFeed, usePostToSuspense, type UnpostedRow } from '../../../api/hooks/useUncategorized';
import { useBulkCategorize } from '../../../api/hooks/useBanking';

const PAGE_SIZE = 50;

export function NotPostedTab() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState('');
  const [confirmSuspense, setConfirmSuspense] = useState(false);
  const [viewing, setViewing] = useState<UnpostedRow | null>(null);

  const toast = useToast();
  const query = useUnpostedFeed({ limit: PAGE_SIZE, offset, search });
  const postToSuspense = usePostToSuspense();
  const bulkCategorize = useBulkCategorize();

  const rows: UnpostedRow[] = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const busy = postToSuspense.isPending || bulkCategorize.isPending;

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pageIds));
  const changePage = (next: number) => { setOffset(next); setSelected(new Set()); };

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
          <div className="w-56">
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
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Payee</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-center">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {query.isError && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-red-600">
                Could not load these lines. <button className="underline" onClick={() => query.refetch()}>Retry</button>
              </td></tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">
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
                    human-assigned contact, then the rule/AI/check-image
                    suggestion, then the payee read off the check image. */}
                <td className="px-3 py-2 text-gray-900">
                  {r.assignedContactName || r.suggestedContactName || r.payeeNameOnCheck || '—'}
                </td>
                <td className="px-3 py-2 text-gray-700">{r.description ?? '(no description)'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.amount)}</td>
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
