// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tab 3 — what clients answered from the portal. Nothing here has posted.
// Approving runs the same primitives the rest of the app uses, so a locked
// period or a voided entry is refused rather than forced.
//
// Each row's category and payee are editable in place, prefilled with the
// client's pick. An edit is a draft: nothing posts until that row's Approve
// (or the bulk Approve, which uses every row's edits). Dismiss retires an
// answer staff already recorded by hand — no posting, no message to the client.

import { useState } from 'react';
import { AlertTriangle, Ban, Check, CircleDot, Loader2, MessageSquare, X } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { TableScroll } from '../../../components/ui/TableScroll';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { SortableTh } from '../../../components/ui/SortableTh';
import { useToast } from '../../../components/ui/Toaster';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { ContactSelector } from '../../../components/forms/ContactSelector';
import { SelectionActionBar } from './SelectionActionBar';
import {
  useSuggestions, useApproveSuggestions, useRejectSuggestions, useMarkSuggestionsReviewed,
  useDismissSuggestions,
  type SuggestionRow, type SuggestionSortKey, type SortDir,
} from '../../../api/hooks/useUncategorized';

const PAGE_SIZE = 50;

interface RowDraft { accountId?: string; contactId?: string }

const REASON_COPY: Record<string, string> = {
  drifted: 'the amount or date changed since the client answered',
  stale: 'already handled elsewhere',
  no_category: 'no category was given — override with one',
  personal_needs_account: 'marked personal — override with the owner-draw account',
  not_pending_or_not_found: 'already reviewed',
};

export function ClientSuggestedTab() {
  const [offset, setOffset] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrideId, setOverrideId] = useState('');
  // Override payee. Its picker's quick-add is how a client's free-text
  // name ("Joe the plumber") becomes a contact before approval.
  const [overrideContactId, setOverrideContactId] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  // Server-side sort: the list paginates, so ordering the visible page alone
  // would lie. '' = the endpoint's default (unread first, then newest).
  const [sortBy, setSortBy] = useState<'' | SuggestionSortKey>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  // Per-row category + payee edits, keyed by suggestion id.
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const toast = useToast();
  const query = useSuggestions({
    limit: PAGE_SIZE, offset, status: 'pending', unread: unreadOnly || undefined,
    sortBy: sortBy || undefined, sortDir: sortBy ? sortDir : undefined,
  });
  const approve = useApproveSuggestions();
  const reject = useRejectSuggestions();
  const markReviewed = useMarkSuggestionsReviewed();
  const dismiss = useDismissSuggestions();

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const busy = approve.isPending || reject.isPending || markReviewed.isPending || dismiss.isPending;

  const rowAccount = (r: SuggestionRow) => drafts[r.id]?.accountId ?? r.suggestedAccountId ?? '';
  const rowContact = (r: SuggestionRow) => drafts[r.id]?.contactId ?? r.suggestedContactId ?? '';
  const rowEdited = (r: SuggestionRow) =>
    rowAccount(r) !== (r.suggestedAccountId ?? '') || rowContact(r) !== (r.suggestedContactId ?? '');
  const patchDraft = (id: string, patch: RowDraft) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const forget = (ids: string[]) => {
    setDrafts((d) => {
      const next = { ...d };
      for (const id of ids) delete next[id];
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const changePage = (next: number) => { setOffset(next); setSelected(new Set()); };
  // First click sorts ascending; a second click on the same column flips it.
  const toggleSort = (key: SuggestionSortKey) => {
    setSortDir(sortBy === key && sortDir === 'asc' ? 'desc' : 'asc');
    setSortBy(key);
    setOffset(0);
    setSelected(new Set());
  };

  // Approve rows with their own edits. The toolbar overrides, when set, win
  // over a row's edit for that field (they are the explicit bulk choice).
  // Rows that resolve to the same account + payee go up in one call.
  const approveRows = async (ids: string[], opts: { confirmDrift: boolean; useToolbar: boolean }) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const groups = new Map<string, { accountId?: string; contactId?: string; ids: string[] }>();
    for (const id of ids) {
      const r = byId.get(id);
      if (!r) continue;
      const accountId = (opts.useToolbar && overrideId) || rowAccount(r) || undefined;
      const contactId = (opts.useToolbar && overrideContactId) || rowContact(r) || undefined;
      const key = `${accountId ?? ''}|${contactId ?? ''}`;
      const g = groups.get(key) ?? { accountId, contactId, ids: [] };
      g.ids.push(id);
      groups.set(key, g);
    }
    const approved: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    try {
      for (const g of groups.values()) {
        const res = await approve.mutateAsync({
          ids: g.ids, overrideAccountId: g.accountId, overrideContactId: g.contactId,
          confirmDrift: opts.confirmDrift,
        });
        approved.push(...res.approved);
        failed.push(...res.failed);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not approve.');
    }
    if (approved.length > 0) toast.success(`Approved and posted ${approved.length}.`);
    if (failed.length > 0) {
      const drifted = failed.filter((f) => f.reason === 'drifted').length;
      const detail = [...new Set(failed.map((f) => REASON_COPY[f.reason] ?? f.reason))].join('; ');
      toast.error(`${failed.length} not approved: ${detail}.`, {
        detail: drifted > 0
          ? 'Open the drifted rows and use "Approve anyway" once you have checked the new amount.'
          : undefined,
      });
    }
    forget(approved);
    return approved;
  };

  const runApprove = async (confirmDrift = false) => {
    if (selected.size === 0) return;
    await approveRows([...selected], { confirmDrift, useToolbar: true });
    setOverrideId('');
    setOverrideContactId('');
  };

  const approveOne = async (r: SuggestionRow) => {
    setRowBusyId(r.id);
    // The row's own button: its "Changed" badge is on screen, so pressing it
    // is the confirmation the bulk path asks for separately.
    await approveRows([r.id], { confirmDrift: r.driftedFields.length > 0, useToolbar: false });
    setRowBusyId(null);
  };

  const runDismiss = (ids: string[]) => {
    if (ids.length === 0) return;
    const what = ids.length === 1 ? 'this answer' : `these ${ids.length} answers`;
    if (!window.confirm(`Dismiss ${what}? Nothing is posted and the client is not told. Use this when you already recorded it yourself.`)) return;
    if (ids.length === 1) setRowBusyId(ids[0]!);
    dismiss.mutate({ ids }, {
      onSuccess: (res) => {
        toast.success(`Dismissed ${res.dismissed.length}. Nothing was posted.`);
        forget(res.dismissed);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not dismiss.'),
      onSettled: () => setRowBusyId(null),
    });
  };

  const runReject = () => {
    if (!reason.trim() || selected.size === 0) return;
    reject.mutate({ ids: [...selected], reason: reason.trim() }, {
      onSuccess: (res) => {
        toast.success(`Sent ${res.rejected.length} back to the client.`);
        setSelected(new Set()); setRejecting(false); setReason('');
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not reject.'),
    });
  };

  const anyDrifted = rows.some((r) => selected.has(r.id) && r.driftedFields.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setOffset(0); setSelected(new Set()); }}
          />
          Unread only
        </label>
        <Button
          variant="secondary"
          disabled={busy || total === 0}
          onClick={() => markReviewed.mutate(undefined, {
            onSuccess: (res) => toast.success(`Marked ${res.marked} as read. Nothing was posted.`),
            onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not mark reviewed.'),
          })}
        >
          Mark all read
        </Button>
      </div>

      <SelectionActionBar
        selectedCount={selected.size}
        totalCount={rows.length}
        allSelected={allSelected}
        disabled={busy}
        onToggleAll={() => setSelected(allSelected ? new Set() : new Set(pageIds))}
        onClearSelection={() => setSelected(new Set())}
      >
        <div className="w-56">
          <AccountSelector value={overrideId} onChange={setOverrideId} compact />
        </div>
        <div className="w-56" title="Override payee — applied to every approved row">
          <ContactSelector value={overrideContactId} onChange={setOverrideContactId} compact />
        </div>
        <Button onClick={() => runApprove(false)} disabled={busy || selected.size === 0}>
          {approve.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <Check className="h-4 w-4 mr-1" />
          {overrideId || overrideContactId ? 'Approve with override' : 'Approve'}
        </Button>
        {anyDrifted && (
          <Button variant="danger" onClick={() => runApprove(true)} disabled={busy}>
            Approve anyway
          </Button>
        )}
        <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy || selected.size === 0}>
          <X className="h-4 w-4 mr-1" />
          Send back
        </Button>
        <Button
          variant="secondary"
          onClick={() => runDismiss([...selected])}
          disabled={busy || selected.size === 0}
          title="Already recorded by hand — remove from this list without posting or telling the client"
        >
          <Ban className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
      </SelectionActionBar>

      {rejecting && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Why are you sending these back? The client sees this.
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. This was the other landlord — can you check the invoice?"
          />
          <div className="flex gap-2">
            <Button onClick={runReject} disabled={!reason.trim() || reject.isPending}>Send back</Button>
            <Button variant="secondary" onClick={() => { setRejecting(false); setReason(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      <TableScroll>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2" />
              <SortableTh sortKey="date" label="Date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="description" label="Description" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="amount" label="Amount" align="right" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="suggested" label="Suggested" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="payee" label="Payee" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="note" label="Note" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh sortKey="from" label="From" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {query.isError && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-red-600">
                Could not load suggestions. <button className="underline" onClick={() => query.refetch()}>Retry</button>
              </td></tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                No suggestions waiting.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'bg-indigo-50' : undefined}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select suggestion from ${r.contactName}`}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                  {r.snapshotDate}
                  {!r.reviewedAt && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500" title="Unread" />
                  )}
                </td>
                <td className="px-3 py-2 text-gray-900">
                  {r.snapshotDescription ?? '—'}
                  {r.driftedFields.length > 0 && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                      title={`Changed since the client answered: ${r.driftedFields.join(', ')}`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Changed
                    </span>
                  )}
                  {r.isStale && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      Already handled
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.snapshotAmount)}</td>
                {/* Category: the client's pick, editable in place. The client's
                    own words stay visible underneath once it is changed or
                    when they could not name an account ("Not sure"). */}
                <td className="px-3 py-2 align-top">
                  <div className="min-w-[12rem]">
                    <AccountSelector
                      value={rowAccount(r)}
                      onChange={(v) => patchDraft(r.id, { accountId: v })}
                      compact
                    />
                  </div>
                  {(rowAccount(r) !== (r.suggestedAccountId ?? '') || !r.suggestedAccountId) && r.suggestedLabel && (
                    <p className="mt-0.5 text-[11px] text-gray-500">Client said: {r.suggestedLabel}</p>
                  )}
                </td>
                {/* Payee: the client's pick, editable in place. Free text (no
                    contact id) is flagged so staff pick or quick-add the
                    contact here; a contact since merged or deleted keeps its
                    label with a note. */}
                <td className="px-3 py-2 align-top">
                  <div className="min-w-[12rem]">
                    <ContactSelector
                      value={rowContact(r)}
                      onChange={(v) => patchDraft(r.id, { contactId: v })}
                      compact
                    />
                  </div>
                  {!r.suggestedContactId && r.suggestedContactLabel && !rowContact(r) && (
                    <p
                      className="mt-0.5 text-[11px] text-amber-700"
                      title="The client typed this name. Pick or add the contact (quick-add is in the picker) to apply it."
                    >
                      Client typed: {r.suggestedContactLabel} · not in contacts
                    </p>
                  )}
                  {r.suggestedContactId && !r.suggestedContactName && rowContact(r) === r.suggestedContactId && (
                    <p className="mt-0.5 text-[11px] text-gray-500" title="That contact was removed after the client answered.">
                      {r.suggestedContactLabel ?? 'Contact'} · removed
                    </p>
                  )}
                </td>
                {/* The note gets its own column rather than grey subtext under
                    the category. When the client could not name an account,
                    the note IS the answer — it is the thing to read, not a
                    footnote to it. Wrapped, never truncated. */}
                <td className="px-3 py-2 align-top">
                  {r.clientNote ? (
                    <div className="flex max-w-xs items-start gap-1.5">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="whitespace-pre-wrap break-words text-gray-700">{r.clientNote}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {r.contactName}
                  {/* Who answered: a portal contact (default) or a tenant user
                      suggesting from Banking → Uncategorized. */}
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    r.submittedBy === 'team_member' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.submittedBy === 'team_member' ? 'Team member' : 'Client'}
                  </span>
                </td>
                <td className="px-3 py-2 align-top whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {rowEdited(r) && (
                      <>
                        <CircleDot className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                        <span className="sr-only">Edited, not posted yet</span>
                      </>
                    )}
                    {/* An answer already handled elsewhere cannot post; it can
                        only be dismissed. */}
                    {!r.isStale && (
                      <button
                        type="button"
                        onClick={() => approveOne(r)}
                        disabled={busy || rowBusyId !== null || !rowAccount(r)}
                        title={rowAccount(r) ? 'Post this row with the category and payee shown' : 'Pick a category first'}
                        aria-label={`Approve suggestion from ${r.contactName}`}
                        className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {rowBusyId === r.id && approve.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Check className="h-3.5 w-3.5" />}
                        {r.driftedFields.length > 0 ? 'Approve anyway' : 'Approve'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => runDismiss([r.id])}
                      disabled={busy || rowBusyId !== null}
                      title="Already recorded by hand — dismiss without posting or telling the client"
                      aria-label={`Dismiss suggestion from ${r.contactName}`}
                      className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={changePage} unit="answers" />
    </div>
  );
}
