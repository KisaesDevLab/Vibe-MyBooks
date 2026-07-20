// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, useEffect } from 'react';
import type { BankFeedStatus, BankFeedItem } from '@kis-books/shared';
import { useBankFeed, useBankConnections, useAssignFeedItem, useApproveFeedItem, useBulkAssign, useExcludeFeedItem, useBulkApprove, useBulkExclude, useBulkRecleanse, useBulkReprocessRules, useBulkSetTag, useBulkSetName, useMatchFeedItem, useMatchCandidates, usePayrollOverlapCheck } from '../../api/hooks/useBanking';
import type { ReprocessRulesResultDto } from '../../api/hooks/useBanking';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { useSessionState } from '../../hooks/useSessionState';
import { useDebouncedValue, useDebouncedDate } from '../../hooks/useDebouncedValue';
import { useAiConfig, useAiCategorize, useAiBatchCategorize } from '../../api/hooks/useAi';
import { AiBannerForTask } from '../../components/ui/AiBannerForTask';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { BulkSetNameInput } from './BulkSetNameInput';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toaster';
import { Check, X, CheckCheck, Brain, Sparkles, ChevronDown, ChevronUp, Save, Trash2, FolderInput, Search, ArrowUpDown, RefreshCw, Link2, Wand2 } from 'lucide-react';
import { apiClient } from '../../api/client';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  // Staged but not yet posted — a distinct "ready to approve" treatment.
  assigned: 'bg-purple-100 text-purple-700',
  matched: 'bg-green-100 text-green-700',
  categorized: 'bg-blue-100 text-blue-700',
  excluded: 'bg-gray-100 text-gray-500',
};

// Human-facing pill labels (the raw status is a terse enum value).
const statusLabels: Record<string, string> = {
  assigned: 'Assigned',
};

// Default categorization confidence threshold (ai_config, FIX 5). Suggestions
// below this are surfaced for review rather than auto-post-eligible, so we
// flag them with an amber "Review" treatment instead of a neutral "Low".
const REVIEW_THRESHOLD = 0.5;

function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 0.9) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">High</span>;
  if (score >= 0.7) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">Medium</span>;
  if (score >= REVIEW_THRESHOLD) return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">Low</span>;
  // Below threshold — needs a human look before it's posted.
  return <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium" title="Low confidence — review before approving">Review</span>;
}

interface EditState {
  feedDate: string;
  description: string;
  memo: string;
  contactId: string;
}

type SortKey = 'feedDate' | 'description' | 'category' | 'status' | 'amount';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, align }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir;
  onSort: (key: SortKey) => void; align?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 ${align || 'text-left'}`}
      onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-gray-300" />
        )}
      </span>
    </th>
  );
}

export function BankFeedPage() {
  // Feed filters persist for the tab session (sessionStorage).
  const [statusFilter, setStatusFilter] = useSessionState<BankFeedStatus | ''>('vibe:bank-feed:status', '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ feedDate: '', description: '', memo: '', contactId: '' });
  const [catAccountId, setCatAccountId] = useState('');
  // Tag for the expanded single-item categorize row. Initialized from the
  // item's rule-staged suggested tag when the row is expanded, so a
  // rule-set tag is pre-selected and posts on categorize.
  const [catTagId, setCatTagId] = useState<string | null>(null);
  const [batchCatAccountId, setBatchCatAccountId] = useState('');
  const [showBatchCategorize, setShowBatchCategorize] = useState(false);
  const [search, setSearch] = useSessionState('vibe:bank-feed:search', '');
  const [startDate, setStartDate] = useSessionState('vibe:bank-feed:startDate', '');
  const [endDate, setEndDate] = useSessionState('vibe:bank-feed:endDate', '');
  const [connectionFilter, setConnectionFilter] = useSessionState('vibe:bank-feed:connection', '');
  const [actionableOnly, setActionableOnly] = useSessionState('vibe:bank-feed:actionableOnly', false);
  const [sortKey, setSortKey] = useState<SortKey>('feedDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [matchModalFor, setMatchModalFor] = useState<string | null>(null);
  const [showExcludeConfirm, setShowExcludeConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showReprocessConfirm, setShowReprocessConfirm] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const debStartDate = useDebouncedDate(startDate);
  const debEndDate = useDebouncedDate(endDate);

  // Pagination: the page previously requested a fixed limit of 200 with
  // no next/prev, silently truncating imports larger than that.
  const PAGE_SIZE = 100;
  const [offset, setOffset] = useState(0);
  // Any filter or sort change invalidates the current offset — otherwise
  // the user sits on page 3 of a smaller/reordered set and sees nothing.
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, connectionFilter, debouncedSearch, debStartDate, debEndDate, actionableOnly, sortKey, sortDir]);

  const { data, isLoading, isError, isFetching, refetch } = useBankFeed({
    status: statusFilter || undefined,
    bankConnectionId: connectionFilter || undefined,
    startDate: debStartDate || undefined,
    endDate: debEndDate || undefined,
    search: debouncedSearch || undefined,
    actionableOnly: actionableOnly || undefined,
    // Sort is server-side: with pagination, sorting the loaded page only
    // ordered 100 of N rows (the reported bug).
    sortBy: sortKey,
    sortDir,
    limit: PAGE_SIZE,
    offset,
  });
  const { data: connectionsData } = useBankConnections();
  const { data: aiConfig } = useAiConfig();
  const assign = useAssignFeedItem();
  const approve = useApproveFeedItem();
  const exclude = useExcludeFeedItem();
  const bulkApprove = useBulkApprove();
  const bulkAssign = useBulkAssign();
  const bulkExclude = useBulkExclude();
  const bulkRecleanse = useBulkRecleanse();
  const bulkReprocessRules = useBulkReprocessRules();
  const toast = useToast();
  const bulkSetTag = useBulkSetTag();
  const [showBatchSetTag, setShowBatchSetTag] = useState(false);
  const [batchSetTagId, setBatchSetTagId] = useState<string | null>(null);
  const bulkSetName = useBulkSetName();
  const [showBatchSetName, setShowBatchSetName] = useState(false);
  const [batchSetName, setBatchSetName] = useState('');
  const aiCategorize = useAiCategorize();
  const aiBatch = useAiBatchCategorize();
  const matchFeedItem = useMatchFeedItem();

  const aiEnabled = aiConfig?.isEnabled === true;
  const firstLoad = isLoading && !data;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'feedDate' ? 'desc' : 'asc');
    }
  };

  // Rows arrive server-sorted (sortBy/sortDir are query params) so the
  // order spans the whole dataset, not just this page.
  const items = data?.data || [];

  // Selectable rows are the actionable ones: pending (assign/exclude) and
  // assigned (approve/re-assign/exclude). Posted/excluded rows aren't.
  const isSelectable = (i: BankFeedItem) => i.status === 'pending' || i.status === 'assigned';

  // Selection survives bulk actions so a multi-step workflow (categorize →
  // set tag → approve) doesn't force re-checking the same rows. This prune
  // only removes ids whose row is on this page but no longer actionable
  // (posted/excluded by the last action); ids on other pages are left alone.
  // NOTE: must stay ABOVE the loading/error early returns — a hook after a
  // conditional return changes the hook order between renders (React #310).
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const gone = items.filter((i) => prev.has(i.id) && !isSelectable(i));
      if (gone.length === 0) return prev;
      const next = new Set(prev);
      for (const i of gone) next.delete(i.id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // A filter change redefines what the user is looking at — rows selected
  // under the old filter may be invisible under the new one, and a bulk
  // action would silently hit them. Selection persists across ACTIONS and
  // pagination, not across a change of view.
  useEffect(() => {
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, startDate, endDate, connectionFilter, actionableOnly]);

  if (firstLoad) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage message="Couldn't load the bank feed." onRetry={() => refetch()} />;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Header checkbox works on THIS page's rows only, additively — it must
  // not silently discard ids selected on other pages (the previous
  // replace-the-set behavior did exactly that).
  const selectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) if (isSelectable(i)) next.add(i.id);
      return next;
    });
  };
  const deselectPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) next.delete(i.id);
      return next;
    });
  };

  const expandItem = (item: BankFeedItem) => {
    if (expandedId === item.id) { setExpandedId(null); return; }
    setExpandedId(item.id);
    setEditState({
      feedDate: item.feedDate,
      description: item.description || '',
      // Prefill from the STAGED assignment when present (re-assigning an
      // 'assigned' row), else the feed item's memo (Plaid's raw payee text).
      memo: item.assignedMemo || item.memo || '',
      contactId: item.assignedContactId || item.suggestedContactId || '',
    });
    // Prefer the staged assignment over the AI suggestion so re-opening an
    // 'assigned' row shows what was staged.
    setCatAccountId(item.assignedAccountId || item.suggestedAccountId || '');
    setCatTagId(item.assignedTagId || item.suggestedTagId || null);
  };

  // Expanded-editor save action: persist the row edits, then STAGE the
  // category via assign() — no ledger post happens here (that's Approve).
  const handleAssign = async (itemId: string) => {
    await apiClient(`/banking/feed/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        feedDate: editState.feedDate, description: editState.description,
        memo: editState.memo, contactId: editState.contactId || undefined,
      }),
    });
    if (catAccountId) {
      assign.mutate({
        id: itemId, accountId: catAccountId,
        contactId: editState.contactId || null, memo: editState.memo || null,
        // Explicit id or null (picker pre-seeded), never undefined.
        tagId: catTagId || null,
      }, { onSuccess: () => { setExpandedId(null); } });
    } else {
      refetch();
      setExpandedId(null);
    }
  };

  // Per-row Approve — posts a staged ('assigned') item to the ledger.
  const handleApprove = (itemId: string) => {
    approve.mutate(itemId);
  };

  // "Accept suggestion" now STAGES the AI guess as an assignment (no post),
  // consistent with the two-phase workflow. Approve is a separate step.
  const handleAcceptSuggestion = async (item: BankFeedItem) => {
    if (!item.suggestedAccountId) return;
    assign.mutate({ id: item.id, accountId: item.suggestedAccountId, contactId: item.suggestedContactId || null, tagId: item.suggestedTagId || null }, {
      onSuccess: () => {
        // Fire-and-forget AI-learning telemetry (the "accepted" signal).
        apiClient('/ai/categorize/accept', {
          method: 'POST',
          body: JSON.stringify({ feedItemId: item.id, accountId: item.suggestedAccountId, contactId: item.suggestedContactId, accepted: true, modified: false }),
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[BankFeedPage] AI-accept telemetry failed:', err);
        });
      },
    });
  };

  const handleAiBatchCategorize = () => {
    // FIX 4: categorize ALL pending-without-suggestion rows across the whole
    // dataset (server-side enumeration), not just the page currently loaded.
    // Respects the active connection filter so a scoped view scopes the run.
    aiBatch.mutate(
      { allPending: true, bankConnectionId: connectionFilter || undefined },
      { onSuccess: () => refetch() },
    );
  };

  const pendingWithoutSuggestion = items.filter((i) => i.status === 'pending' && !i.suggestedAccountId).length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  // Rows eligible for selection/bulk actions: pending + assigned.
  const selectableCount = items.filter(isSelectable).length;
  const connections = connectionsData?.connections || [];
  const hasFilters = search || startDate || endDate || connectionFilter || actionableOnly;

  // Result toast for "Reprocess Rules" — built from the server counts so
  // the message reflects what actually happened, not what was requested.
  const showReprocessToast = (r: ReprocessRulesResultDto) => {
    if (r.matched === 0) {
      toast.info(`No rules matched — ${r.processed} pending item${r.processed === 1 ? '' : 's'} checked.`);
      return;
    }
    toast.success(
      `Rules matched ${r.matched} of ${r.processed} — ${r.autoCategorized} auto-categorized, ` +
      `${r.suggestionsUpdated} suggestion${r.suggestionsUpdated === 1 ? '' : 's'} updated.`,
    );
  };

  // Honest N for the "reprocess all pending" confirm: the server-side
  // total is only the count of what will be reprocessed when the pending
  // filter is active with no search/date narrowing (the connection filter
  // is fine — it's passed to the mutation). Otherwise skip the number.
  const allPendingCount =
    statusFilter === 'pending' && !debouncedSearch && !debStartDate && !debEndDate
      ? data?.total ?? null
      : null;

  return (
    <div>
      <ConfirmDialog
        open={showExcludeConfirm}
        title={`Exclude ${selected.size} item${selected.size > 1 ? 's' : ''}?`}
        message="Excluded items are hidden from the ledger. You can restore them later from the Excluded filter."
        confirmLabel="Exclude"
        variant="danger"
        onCancel={() => setShowExcludeConfirm(false)}
        onConfirm={() => {
          // Excluded rows leave the feed — drop exactly the acted ids so a
          // selection built on another page (if any) survives.
          const ids = [...selected];
          bulkExclude.mutate(ids, {
            onSuccess: () => setSelected((prev) => {
              const next = new Set(prev);
              for (const id of ids) next.delete(id);
              return next;
            }),
          });
          setShowExcludeConfirm(false);
        }}
      />
      <ConfirmDialog
        open={showApproveConfirm}
        title={`Approve ${selected.size} item${selected.size > 1 ? 's' : ''}?`}
        message={(() => {
          const offPage = [...selected].filter((id) => !items.some((i) => i.id === id)).length;
          return offPage > 0
            ? `Posts every selected item that has a category to the ledger. ${offPage} selected item${offPage === 1 ? ' is' : 's are'} on other pages and not currently visible.`
            : 'Posts every selected item that has a category to the ledger. Items without a category are skipped.';
        })()}
        confirmLabel="Approve"
        onCancel={() => setShowApproveConfirm(false)}
        onConfirm={() => {
          setShowApproveConfirm(false);
          // Ids that will post (mirror of the server's bulk-approve
          // rule): staged assignments and pending rows with a
          // suggestion. These leave the actionable list, so uncheck
          // them; skipped/failed rows stay checked for the next pass.
          // Off-page ids are unchecked too — the server posts or skips
          // them and we can't see their status from here.
          const skippedOnPage = new Set(
            items.filter((i) => selected.has(i.id) && i.status === 'pending' && !i.suggestedAccountId).map((i) => i.id),
          );
          bulkApprove.mutate([...selected], {
            onSuccess: (r) => {
              const failedIds = new Set((r.failures ?? []).map((f) => f.id));
              setSelected((prev) => new Set([...prev].filter((id) => skippedOnPage.has(id) || failedIds.has(id))));
              const parts = [`${r.approved} approved`];
              if (r.skipped) parts.push(`${r.skipped} skipped (no category)`);
              if (r.failed) parts.push(`${r.failed} failed`);
              if (r.failed) toast.error(parts.join(' · '));
              else toast.success(parts.join(' · '));
            },
          });
        }}
      />
      <ConfirmDialog
        open={showReprocessConfirm}
        title={allPendingCount !== null
          ? `Reprocess rules for all ${allPendingCount} pending item${allPendingCount === 1 ? '' : 's'}?`
          : 'Reprocess rules for all pending items?'}
        message="Re-runs your bank rules over the pending backlog. Matching rules refresh the suggested category; auto-confirm rules post transactions. Items no rule matches are left unchanged."
        confirmLabel="Reprocess"
        onCancel={() => setShowReprocessConfirm(false)}
        onConfirm={() => {
          setShowReprocessConfirm(false);
          bulkReprocessRules.mutate(
            { allPending: true, bankConnectionId: connectionFilter || undefined },
            { onSuccess: showReprocessToast },
          );
        }}
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Bank Feed</h1>
          <AiBannerForTask task="categorization" />
        </div>
        <div className="flex gap-2">
          {aiEnabled && pendingWithoutSuggestion > 0 && selected.size === 0 && (
            <Button size="sm" variant="secondary" onClick={handleAiBatchCategorize} loading={aiBatch.isPending}>
              {/* The action covers every pending-without-suggestion row across
                  the dataset (not just this page), so label it "all pending"
                  rather than the page-local count. */}
              <Brain className="h-4 w-4 mr-1" /> AI Categorize (all pending)
            </Button>
          )}
          {pendingCount > 0 && selected.size === 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowReprocessConfirm(true)} loading={bulkReprocessRules.isPending}>
              <Wand2 className="h-4 w-4 mr-1" /> Reprocess Rules
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 mb-4">
        <div className="flex gap-3 items-end flex-wrap">
          {connections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
              <select value={connectionFilter} onChange={(e) => setConnectionFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">All Accounts</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.accountName || c.institutionName || 'Bank Account'}{c.mask ? ` (****${c.mask})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <label htmlFor="bank-feed-search" className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search aria-hidden="true" className="absolute left-3 bottom-2.5 h-4 w-4 text-gray-400" />
            <input
              id="bank-feed-search"
              placeholder="Search name, memo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            {(['', 'pending', 'assigned', 'categorized', 'matched', 'excluded'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer select-none pb-2">
            <input type="checkbox" checked={actionableOnly}
              onChange={(e) => setActionableOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 h-[15px] w-[15px]" />
            Hide processed
          </label>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setConnectionFilter(''); setActionableOnly(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 pb-2">Clear</button>
          )}
          {isFetching && <span className="text-xs text-gray-400 pb-2.5">Loading...</span>}
        </div>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-primary-800">{selected.size} selected</span>
          <div className="h-4 w-px bg-primary-200" />
          {showBatchCategorize ? (
            <div className="flex items-center gap-2">
              <div className="w-64">
                <AccountSelector value={batchCatAccountId} onChange={setBatchCatAccountId} />
              </div>
              <Button size="sm" disabled={!batchCatAccountId} loading={bulkAssign.isPending}
                onClick={() => bulkAssign.mutate(
                  { feedItemIds: [...selected], accountId: batchCatAccountId },
                  { onSuccess: () => { setShowBatchCategorize(false); setBatchCatAccountId(''); } },
                )}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowBatchCategorize(false); setBatchCatAccountId(''); }}>Cancel</Button>
            </div>
          ) : showBatchSetTag ? (
            <div className="flex items-center gap-2">
              <div className="w-56">
                <LineTagPicker value={batchSetTagId} onChange={(t) => setBatchSetTagId(t)} />
              </div>
              <Button size="sm" loading={bulkSetTag.isPending}
                onClick={() => bulkSetTag.mutate(
                  { feedItemIds: [...selected], tagId: batchSetTagId },
                  { onSuccess: (r) => {
                    setShowBatchSetTag(false); setBatchSetTagId(null);
                    const failed = r.failures?.length ?? 0;
                    if (r.updated > 0) toast.success(`Tagged ${r.updated} item${r.updated === 1 ? '' : 's'}${failed ? ` · ${failed} skipped` : ''}.`);
                    else toast.error(failed ? `Couldn’t tag ${failed} item${failed === 1 ? '' : 's'} — they may already be posted or excluded.` : 'No items tagged.');
                  } },
                )}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowBatchSetTag(false); setBatchSetTagId(null); }}>Cancel</Button>
            </div>
          ) : showBatchSetName ? (
            <div className="flex items-center gap-2">
              <BulkSetNameInput
                value={batchSetName}
                onChange={setBatchSetName}
                onEnter={() => bulkSetName.mutate({ feedItemIds: [...selected], name: batchSetName.trim() }, { onSuccess: () => { setShowBatchSetName(false); setBatchSetName(''); } })}
              />
              <Button size="sm" loading={bulkSetName.isPending} disabled={!batchSetName.trim()}
                onClick={() => bulkSetName.mutate(
                  { feedItemIds: [...selected], name: batchSetName.trim() },
                  { onSuccess: () => { setShowBatchSetName(false); setBatchSetName(''); } },
                )}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowBatchSetName(false); setBatchSetName(''); }}>Cancel</Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setShowBatchCategorize(true)}>
                <FolderInput className="h-4 w-4 mr-1" /> Categorize
              </Button>
              {aiEnabled && (
                <Button size="sm" variant="secondary" onClick={() => aiBatch.mutate([...selected], { onSuccess: () => { refetch(); } })} loading={aiBatch.isPending}>
                  <Brain className="h-4 w-4 mr-1" /> AI Categorize
                </Button>
              )}
              <Button size="sm" onClick={() => setShowApproveConfirm(true)} loading={bulkApprove.isPending}>
                <CheckCheck className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkRecleanse.mutate([...selected], {
                  onSuccess: (data) => {
                    // Subtle degradation warning — the re-cleanse ran, but the
                    // AI step failed and regex-only cleaning was used.
                    if ((data.cleansing?.aiFailed ?? 0) > 0) {
                      const n = data.cleansing!.aiFailed;
                      toast.info(
                        `AI cleanup unavailable — ${n} description${n === 1 ? '' : 's'} kept regex-only cleaning.`,
                        { detail: data.cleansing!.firstError },
                      );
                    }
                  },
                })}
                loading={bulkRecleanse.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Re-cleanse
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkReprocessRules.mutate(
                  { feedItemIds: [...selected] },
                  { onSuccess: (r) => { showReprocessToast(r); } },
                )}
                loading={bulkReprocessRules.isPending}
              >
                <Wand2 className="h-4 w-4 mr-1" /> Reprocess Rules
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowBatchSetTag(true)}>
                Set Tag…
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowBatchSetName(true)}>
                Set Name…
              </Button>
              <Button size="sm" variant="danger"
                onClick={() => setShowExcludeConfirm(true)}
                loading={bulkExclude.isPending}>
                <Trash2 className="h-4 w-4 mr-1" /> Exclude
              </Button>
            </>
          )}
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700 ml-auto">Clear selection</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
          No bank feed items.{hasFilters ? ' Try adjusting your filters.' : ' Import a bank statement or connect a bank to get started.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          {/* TODO(mobile): Bank Feed is intentionally left as a horizontal-scroll
              table on phones for now; a md:hidden card-list fallback (like the
              Transactions list) is a future enhancement given this table's width. */}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-3">
                  {selectableCount > 0 && (() => {
                    const pageSelected = items.filter((i) => isSelectable(i) && selected.has(i.id)).length;
                    const allPage = pageSelected === selectableCount;
                    return (
                      <input type="checkbox"
                        checked={pageSelected > 0 && allPage}
                        ref={(el) => { if (el) el.indeterminate = pageSelected > 0 && !allPage; }}
                        onChange={() => (allPage ? deselectPage() : selectAllOnPage())}
                        className="rounded border-gray-300 text-primary-600 h-[15px] w-[15px]" />
                    );
                  })()}
                </th>
                <SortHeader label="Date" sortKey="feedDate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Name" sortKey="description" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Category" sortKey="category" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                <SortHeader label="Amount" sortKey="amount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="text-right" />
                <SortHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                const amt = parseFloat(item.amount);
                return (
                  <tr key={item.id} className={isExpanded ? 'bg-primary-50/30' : 'hover:bg-gray-50'}
                    onDoubleClick={() => { if (isSelectable(item) && !isExpanded) expandItem(item); }}>
                    <td className="px-3 py-3">
                      {isSelectable(item) && (
                        <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                          className="rounded border-gray-300 text-primary-600 h-[15px] w-[15px]" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {isExpanded ? (
                        <input type="date" value={editState.feedDate}
                          onChange={(e) => setEditState((s) => ({ ...s, feedDate: e.target.value }))}
                          className="rounded border border-gray-300 px-2 py-1 text-sm w-36" />
                      ) : (
                        <div>
                          <p className="text-gray-900 whitespace-nowrap">{item.feedDate}</p>
                          <p className="text-xs text-gray-400">{item.bankAccountName || item.institutionName || ''}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <input value={editState.description}
                            onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
                            className="block w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Name" />
                          <ContactSelector value={editState.contactId}
                            onChange={(v) => setEditState((s) => ({ ...s, contactId: v }))} />
                          {item.payeeNameOnCheck ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Payee from check{item.checkNumber ? ` #${item.checkNumber}` : ''}: {item.payeeNameOnCheck}
                            </span>
                          ) : item.checkNumber ? (
                            // Check number without a check-image payee — the
                            // Plaid / OFX import case.
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Check #{item.checkNumber}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          {/* NAME shows the resolved payee/vendor when one
                              exists — human-assigned first, then a rule/AI
                              suggested contact — falling back to the cleaned
                              bank descriptor. The raw memo stays on the muted
                              line below. */}
                          {(() => {
                            // A real contact match is one where the name came
                            // from a resolved contacts row (assigned = human
                            // confirmed, or a rule/AI suggested contactId) —
                            // NOT the free-text bank descriptor fallback.
                            const isContactMatch = Boolean(item.assignedContactName || item.suggestedContactName);
                            const displayName = item.assignedContactName || item.suggestedContactName || item.description;
                            return (
                              <p className="text-gray-900 font-medium flex items-center gap-1">
                                <span className="truncate">{displayName || '—'}</span>
                                {isContactMatch && (
                                  <span title="Matched contact" aria-label="Matched contact" className="inline-flex shrink-0">
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  </span>
                                )}
                              </p>
                            );
                          })()}
                          {item.originalDescription && item.originalDescription !== (item.assignedContactName || item.suggestedContactName || item.description) && (
                            <p className="text-xs text-gray-400 truncate max-w-[300px]" title={item.originalDescription}>{item.originalDescription}</p>
                          )}
                          {item.payeeNameOnCheck ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Payee from check{item.checkNumber ? ` #${item.checkNumber}` : ''}: {item.payeeNameOnCheck}
                            </span>
                          ) : item.checkNumber ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Check #{item.checkNumber}
                            </span>
                          ) : null}
                          {item.suggestedAccountId && item.status === 'pending' && (
                            <p className="text-xs text-primary-600 flex items-center gap-0.5 mt-0.5">
                              <Sparkles className="h-3 w-3" />
                              {item.suggestedAccountName || 'Suggested'}
                              {item.matchType === 'rule' ? (
                                // A rule mapped this row — keep the green of a
                                // high-confidence match but label it "Rule" so
                                // the user knows a rule (not AI) set it.
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium" title="Mapped by a rule">Rule</span>
                              ) : (
                                item.confidenceScore && <ConfidenceBadge score={parseFloat(item.confidenceScore)} />
                              )}
                              {item.matchType === 'ai' && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium" title="Categorized by AI">AI</span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <AccountSelector value={catAccountId} onChange={setCatAccountId} />
                          <LineTagPicker value={catTagId} onChange={(t) => setCatTagId(t)} className="w-full" />
                          <input value={editState.memo}
                            onChange={(e) => setEditState((s) => ({ ...s, memo: e.target.value }))}
                            className="block w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Memo" />
                          {item.category && (
                            <p className="text-[11px] text-gray-400">Bank category hint: {item.category}</p>
                          )}
                          <PayrollOverlapBanner feedItemId={item.id} />
                        </div>
                      ) : item.status === 'assigned' ? (
                        // Staged category — visually distinct from a posted
                        // ('categorized') row: a purple pill = "ready to approve".
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-xs font-medium" title="Staged — approve to post">
                          <Check className="h-3 w-3" />
                          {item.assignedAccountName || 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-gray-900">{item.suggestedAccountName || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {(() => {
                        // CATEGORIZED / MATCHED: the tag(s) actually applied on the
                        // posted transaction's journal lines. One pill when uniform,
                        // "Multiple" when the lines differ.
                        const applied = item.lineTags ?? null;
                        if (applied && applied.length > 0) {
                          if (applied.length === 1) {
                            return (
                              <span className="inline-flex items-center rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs font-medium">
                                {applied[0]}
                              </span>
                            );
                          }
                          return (
                            <span title={applied.join(', ')}
                              className="inline-flex items-center rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs font-medium cursor-help">
                              Multiple ({applied.length})
                            </span>
                          );
                        }
                        // ASSIGNED: the human-staged tag, awaiting approval.
                        if (item.status === 'assigned' && item.assignedTagName) {
                          return (
                            <span title="Staged tag — approve to apply"
                              className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-xs font-medium">
                              {item.assignedTagName}
                            </span>
                          );
                        }
                        // PENDING: the rule-staged suggested tag, shown as a subtle
                        // outlined "suggested" pill so a rule-set tag is visible
                        // before the user categorizes.
                        if (item.status === 'pending' && item.suggestedTagName) {
                          return (
                            <span title="Suggested by a rule"
                              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">
                              <Sparkles className="h-3 w-3" />
                              {item.suggestedTagName}
                            </span>
                          );
                        }
                        return <span className="text-gray-300">—</span>;
                      })()}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-mono font-medium whitespace-nowrap ${amt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {amt > 0 ? '-' : '+'}${Math.abs(amt).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[item.status] || ''}`}
                        title={item.status === 'assigned' ? 'Assigned — ready to approve' : undefined}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isExpanded ? (
                          <>
                            {/* Save + STAGE the category (no ledger post). */}
                            <Button size="sm" onClick={() => handleAssign(item.id)} loading={assign.isPending}>
                              <Save className="h-3.5 w-3.5 mr-1" /> {catAccountId ? 'Assign' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : item.status === 'pending' ? (
                          <>
                            {item.suggestedAccountId && (
                              <Button size="sm" variant="secondary" onClick={() => handleAcceptSuggestion(item)} loading={assign.isPending} title="Accept suggestion (stages it)">
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <button onClick={() => expandItem(item)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600">
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            {aiEnabled && !item.suggestedAccountId && (
                              <button onClick={() => aiCategorize.mutate(item.id, { onSuccess: () => refetch() })}
                                className="p-1.5 rounded hover:bg-gray-100 text-purple-500 hover:text-purple-700" title="AI Suggest">
                                <Brain className="h-4 w-4" />
                              </button>
                            )}
                            {(item.matchCandidateCount ?? 0) > 0 ? (
                              // A posted ledger transaction already matches this
                              // feed item (e.g. a check written in-system) —
                              // surface it so it's linked, not duplicated.
                              <button onClick={() => setMatchModalFor(item.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 whitespace-nowrap"
                                title={`${item.matchCandidateCount} existing ledger transaction${item.matchCandidateCount! > 1 ? 's' : ''} already match this amount — link instead of creating a duplicate`}>
                                <Link2 className="h-3.5 w-3.5" /> Match{item.matchCandidateCount! > 1 ? ` (${item.matchCandidateCount})` : ''}
                              </button>
                            ) : (
                              <button onClick={() => setMatchModalFor(item.id)}
                                className="p-1.5 rounded hover:bg-gray-100 text-blue-500 hover:text-blue-700" title="Find existing transaction to match">
                                <Link2 className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => exclude.mutate(item.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500" title="Exclude">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : item.status === 'assigned' ? (
                          <>
                            {/* Staged → post it to the ledger. */}
                            <Button size="sm" onClick={() => handleApprove(item.id)} loading={approve.isPending}>
                              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <button onClick={() => expandItem(item)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600" title="Re-assign">
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button onClick={() => exclude.mutate(item.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500" title="Exclude">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={data?.total ?? 0} limit={PAGE_SIZE} offset={offset} onChange={setOffset} unit="items" />

      {matchModalFor && (
        <MatchCandidatesModal
          feedItemId={matchModalFor}
          onClose={() => setMatchModalFor(null)}
          onMatch={(transactionId) => {
            matchFeedItem.mutate(
              { id: matchModalFor, transactionId },
              { onSuccess: () => { setMatchModalFor(null); refetch(); } },
            );
          }}
          isPending={matchFeedItem.isPending}
        />
      )}
    </div>
  );
}

function MatchCandidatesModal({ feedItemId, onClose, onMatch, isPending }: {
  feedItemId: string;
  onClose: () => void;
  onMatch: (transactionId: string) => void;
  isPending: boolean;
}) {
  const { data, isLoading } = useMatchCandidates(feedItemId);
  const candidates = data?.candidates || [];

  const typeLabel = (type: string) => {
    if (type === 'bill_payment') return 'Bill Payment';
    if (type === 'expense') return 'Check / Expense';
    if (type === 'deposit') return 'Deposit';
    if (type === 'transfer') return 'Transfer';
    return type;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Match to Existing Transaction</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Same-amount transactions within ±5 days. Bill payments are listed first — match them
          to avoid creating a duplicate expense.
        </p>
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : candidates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No matching transactions found.</p>
        ) : (
          <table className="min-w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Number</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Vendor</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 text-sm">{typeLabel(c.txnType)}</td>
                  <td className="py-2 text-sm font-mono">
                    {c.checkNumber ? `#${c.checkNumber}` : c.txnNumber}
                  </td>
                  <td className="py-2 text-sm">{c.txnDate}</td>
                  <td className="py-2 text-sm">{c.contactName || '—'}</td>
                  <td className="py-2 text-sm text-right font-mono">${parseFloat(c.total).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" onClick={() => onMatch(c.id)} disabled={isPending}>
                      Match
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PayrollOverlapBanner({ feedItemId }: { feedItemId: string }) {
  const { data } = usePayrollOverlapCheck(feedItemId);
  const overlaps = data?.overlaps || [];
  if (overlaps.length === 0) return null;

  return (
    <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
      <p className="font-medium">Possible payroll overlap</p>
      {overlaps.map(o => (
        <p key={o.txnId} className="mt-0.5">
          {o.memo} on {o.date} (${o.amount})
        </p>
      ))}
      <p className="mt-1 text-yellow-600">This amount may already be covered by a payroll journal entry. Categorizing it could double-count the transaction.</p>
    </div>
  );
}
