// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Needs a category" — the suggest-only twin of Practice → In suspense.
// Same rows, but the category cell is the portal's sanitized picker
// (expense / revenue / cost of sales, plus Personal and Not sure) and a note,
// and the action is SEND, not save: the row stays until a reviewer approves.
//
// Picks and notes are drafts in local state. "Send N answers" submits the
// whole batch in one request so the reviewer gets one notification, not one
// per row. A row that already carries a live suggestion shows who answered
// and lets only that person withdraw it.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Paperclip, Scissors, Send, Undo2 } from 'lucide-react';
import { AttachFileButton } from '../../attachments/AttachFileButton';
import { RowAttachmentsModal } from '../../practice/uncategorized/RowAttachmentsModal';
import { formatMoney } from '../../../utils/money';
import { TableScroll } from '../../../components/ui/TableScroll';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import { isApiError } from '../../../api/client';
import { useMe } from '../../../api/hooks/useAuth';
import {
  useInSuspense, useTeamCategories, useSubmitTeamSuggestions, useWithdrawTeamSuggestion,
  type SuspenseRow, type UncategorizedMode,
} from '../../../api/hooks/useUncategorized';

const PAGE_SIZE = 50;

// The two answers that are not an account. Resolved server-side so a team
// member never has to know the owner-draw account exists, and "not sure"
// routes a note to a human.
export const PERSONAL = 'personal';
export const NOT_SURE = 'not_sure';

// Why the server turned a row down, in words a team member can act on.
export const FAILURE_COPY: Record<string, string> = {
  not_found: 'one is no longer in suspense',
  invalid_category: 'a category is no longer available',
  note_required: 'a note is needed',
  already_answered: 'one was already answered by someone else',
  write_failed: 'one could not be saved',
};

export function TeamSuspenseTab({ mode }: { mode: UncategorizedMode }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SuspenseRow | null>(null);

  const toast = useToast();
  const { data: meData } = useMe();
  const myUserId = meData?.user?.id;
  const query = useInSuspense({ limit: PAGE_SIZE, offset, search, includeSuggestions: true });
  const categories = useTeamCategories();
  const submit = useSubmitTeamSuggestions();
  const withdraw = useWithdrawTeamSuggestion();

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const groups = groupCategories(categories.data?.categories ?? []);

  // A row is ready to send if it has a pick OR a note. A note on its own is
  // sent as "not sure" — that is what that answer means.
  const readyIds = [...new Set([
    ...Object.entries(picks).filter(([, v]) => v).map(([k]) => k),
    ...Object.entries(notes).filter(([, v]) => v.trim()).map(([k]) => k),
  ])].filter((id) => rows.some((r) => r.transactionId === id && !r.pendingSuggestion));

  const sendAll = () => {
    setNotice(null);
    const payload = readyIds.map((targetId) => ({
      targetId,
      categoryId: picks[targetId] || NOT_SURE,
      note: notes[targetId]?.trim() || undefined,
    }));
    // The server refuses "not sure" without a note. Say so here instead, so
    // the whole batch is not sent only to have those rows bounce.
    const needsNote = payload.filter((p) => p.categoryId === NOT_SURE && !p.note);
    if (needsNote.length > 0) {
      setNotice(needsNote.length === 1
        ? 'One answer says "Not sure" — add a note saying what you do know.'
        : `${needsNote.length} answers say "Not sure" — add a note to each saying what you do know.`);
      return;
    }
    if (payload.length === 0) return;
    submit.mutate({ items: payload }, {
      onSuccess: (res) => {
        // Rejected rows KEEP their picks and notes so nothing is lost.
        setPicks((p) => { const n = { ...p }; for (const id of res.accepted) delete n[id]; return n; });
        setNotes((p) => { const n = { ...p }; for (const id of res.accepted) delete n[id]; return n; });
        const sent = res.accepted.length;
        if (res.failed.length > 0) {
          const why = [...new Set(res.failed.map((f) => FAILURE_COPY[f.reason] ?? f.reason))].join('; ');
          setNotice(`Sent ${sent} answer${sent === 1 ? '' : 's'}. ${res.failed.length} not sent: ${why}.`);
        } else {
          toast.success(mode.managedByFirm
            ? `Sent ${sent} answer${sent === 1 ? '' : 's'} to ${mode.firmName ?? 'your accounting firm'} for review.`
            : `Sent ${sent} answer${sent === 1 ? '' : 's'} for review.`);
        }
      },
      onError: (e) => toast.error(isApiError(e) && e.code === 'SUGGEST_ONLY_MODE'
        ? e.message
        : (e instanceof Error ? e.message : 'Could not send your answers.')),
    });
  };

  const withdrawRow = (suggestionId: string) => {
    withdraw.mutate(suggestionId, {
      onSuccess: () => toast.success('Answer withdrawn. You can answer again.'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not withdraw the answer.'),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Search memo, payee, or check #"
          className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <Button onClick={sendAll} disabled={submit.isPending || readyIds.length === 0}>
          <Send className="h-4 w-4 mr-1" />
          {submit.isPending ? 'Sending…' : `Send ${readyIds.length} answer${readyIds.length === 1 ? '' : 's'}`}
        </Button>
      </div>

      {notice && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{notice}</p>
      )}

      <TableScroll>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Payee</th>
              <th className="px-3 py-2">Memo</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-center">Docs</th>
              <th className="px-3 py-2">What was this?</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {query.isError && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-red-600">
                Could not load suspense. <button className="underline" onClick={() => query.refetch()}>Retry</button>
              </td></tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                Nothing is waiting on a category.
              </td></tr>
            )}
            {rows.map((r) => {
              const pending = r.pendingSuggestion ?? null;
              const mine = !!pending && pending.submittedByUserId === myUserId;
              return (
                <tr key={r.transactionId} className={pending ? 'bg-gray-50' : undefined}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.txnDate}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-600">{r.checkNumber ?? r.txnNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-900">{r.contactName ?? r.payeeNameOnCheck ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {r.memo ?? '—'}
                    {r.isSplit && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800" title="This entry is split; every suspense line on it will get the same category.">
                        <Scissors className="h-3 w-3" /> Split
                      </span>
                    )}
                  </td>
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
                          attachableType={r.attachableType}
                          attachableId={r.transactionId}
                          invalidateKeys={[['uncategorized']]}
                          compact
                        />
                      )}
                    </div>
                  </td>
                  {pending ? (
                    <td className="px-3 py-2" colSpan={2}>
                      <div className="flex items-start gap-1.5 text-xs text-gray-700">
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        <div>
                          <div>
                            <span className="font-medium">Sent · awaiting review</span>
                            {pending.label && <> — {pending.label}</>}
                          </div>
                          {pending.note && <div className="whitespace-pre-wrap text-gray-600">{pending.note}</div>}
                          {!mine && <div className="text-gray-500">Answered by {pending.submittedByName}</div>}
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <select
                          value={picks[r.transactionId] ?? ''}
                          onChange={(e) => setPicks((p) => ({ ...p, [r.transactionId]: e.target.value }))}
                          aria-label={`Category for ${r.memo ?? r.contactName ?? 'transaction'}`}
                          className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          disabled={submit.isPending}
                        >
                          <option value="">Choose…</option>
                          {groups.map((g) => (
                            <optgroup key={g.group} label={g.group}>
                              {g.items.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </optgroup>
                          ))}
                          <optgroup label="Other">
                            <option value={PERSONAL}>Personal / not business</option>
                            <option value={NOT_SURE}>Not sure — see note</option>
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={notes[r.transactionId] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [r.transactionId]: e.target.value }))}
                          placeholder="Anything that helps"
                          aria-label={`Note for ${r.memo ?? r.contactName ?? 'transaction'}`}
                          className="w-44 rounded-md border border-gray-300 px-2 py-1 text-sm"
                          disabled={submit.isPending}
                          maxLength={2000}
                        />
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {pending && mine && (
                      <button
                        type="button"
                        onClick={() => withdrawRow(pending.id)}
                        disabled={withdraw.isPending}
                        className="mr-2 inline-flex items-center gap-1 text-xs text-gray-600 underline"
                        title="Take your answer back so you can answer again"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Withdraw
                      </button>
                    )}
                    <Link to={`/transactions/${r.transactionId}`} className="text-xs text-primary-700 underline">Open</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="transactions" />

      <RowAttachmentsModal
        open={viewing !== null}
        title={viewing?.memo || viewing?.contactName || 'Transaction'}
        subtitle={viewing ? `${viewing.txnDate} · ${formatMoney(viewing.amount)} in suspense` : undefined}
        attachableType={viewing?.attachableType ?? ''}
        attachableId={viewing?.transactionId ?? ''}
        secondary={viewing?.bankFeedItemId
          ? { label: 'Attached to the bank line before it posted', attachableType: 'bank_feed_items', attachableId: viewing.bankFeedItemId }
          : null}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

function groupCategories(cats: Array<{ id: string; label: string; group: string }>) {
  const order = ['Money out', 'Cost of sales', 'Money in'];
  const byGroup = new Map<string, Array<{ id: string; label: string }>>();
  for (const c of cats) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, []);
    byGroup.get(c.group)!.push({ id: c.id, label: c.label });
  }
  return [...byGroup.entries()]
    .sort((a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])))
    .map(([group, items]) => ({ group, items }));
}
