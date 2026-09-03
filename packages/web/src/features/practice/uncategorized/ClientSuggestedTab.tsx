// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tab 3 — what clients answered from the portal. Nothing here has posted.
// Approving runs the same primitives the rest of the app uses, so a locked
// period or a voided entry is refused rather than forced.

import { useState } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { TableScroll } from '../../../components/ui/TableScroll';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { SelectionActionBar } from './SelectionActionBar';
import {
  useSuggestions, useApproveSuggestions, useRejectSuggestions, useMarkSuggestionsReviewed,
} from '../../../api/hooks/useUncategorized';

const PAGE_SIZE = 50;

const REASON_COPY: Record<string, string> = {
  drifted: 'the amount or date changed since the client answered',
  stale: 'already handled elsewhere',
  no_category: 'the client was not sure — override with a category',
  personal_needs_account: 'marked personal — override with the owner-draw account',
  not_pending_or_not_found: 'already reviewed',
};

export function ClientSuggestedTab() {
  const [offset, setOffset] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrideId, setOverrideId] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const toast = useToast();
  const query = useSuggestions({
    limit: PAGE_SIZE, offset, status: 'pending', unread: unreadOnly || undefined,
  });
  const approve = useApproveSuggestions();
  const reject = useRejectSuggestions();
  const markReviewed = useMarkSuggestionsReviewed();

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const busy = approve.isPending || reject.isPending || markReviewed.isPending;

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const changePage = (next: number) => { setOffset(next); setSelected(new Set()); };

  const runApprove = (confirmDrift = false) => {
    if (selected.size === 0) return;
    approve.mutate(
      { ids: [...selected], overrideAccountId: overrideId || undefined, confirmDrift },
      {
        onSuccess: (res) => {
          if (res.approved.length > 0) toast.success(`Approved and posted ${res.approved.length}.`);
          if (res.failed.length > 0) {
            const drifted = res.failed.filter((f) => f.reason === 'drifted').length;
            const detail = [...new Set(res.failed.map((f) => REASON_COPY[f.reason] ?? f.reason))].join('; ');
            toast.error(`${res.failed.length} not approved: ${detail}.`, {
              detail: drifted > 0
                ? 'Open the drifted rows and use "Approve anyway" once you have checked the new amount.'
                : undefined,
            });
          }
          setSelected(new Set());
          setOverrideId('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not approve.'),
      },
    );
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
        <Button onClick={() => runApprove(false)} disabled={busy || selected.size === 0}>
          {approve.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <Check className="h-4 w-4 mr-1" />
          {overrideId ? 'Approve with override' : 'Approve'}
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
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Client said</th>
              <th className="px-3 py-2">From</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {query.isError && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-red-600">
                Could not load suggestions. <button className="underline" onClick={() => query.refetch()}>Retry</button>
              </td></tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                No client answers waiting.
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
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900">{r.suggestedLabel ?? '—'}</div>
                  {r.clientNote && <div className="text-xs text-gray-500">{r.clientNote}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.contactName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={changePage} unit="answers" />
    </div>
  );
}
