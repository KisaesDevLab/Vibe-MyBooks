// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Fragment, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, ChevronDown, ChevronRight, ListChecks, Search } from 'lucide-react';
import type { ClientRulesOverviewRow, ClientRulesOverviewSortKey, ClientRulesPostTenantResult } from '@kis-books/shared';
import { apiClient, setTokens } from '../../../api/client';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import {
  useClientMappingOptions,
  useClientRulesOverview,
  usePostClientRules,
  useSaveClientMapping,
  useSetClientExcluded,
} from '../../../api/hooks/useClientRulesOverview';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { Pagination } from '../../../components/ui/Pagination';
import { SortableTh } from '../../../components/ui/SortableTh';
import { CommitInput } from '../../../components/forms/CommitInput';
import { useToast } from '../../../components/ui/Toaster';

// Client Rules Overview — one row per client the staff user can reach:
// how many pending bank-feed items the rules would post, which global
// rule accounts still need a mapping in that client, and the client
// portal counters. Counts only; the transactions themselves stay on each
// client's Bank Feed. Sorting and paging are server-side, so an order by
// "Ready to post" ranks every client, not just the page shown.

const PAGE_SIZE_OPTIONS = ['10', '25', '50', '100'];
const DEFAULT_PAGE_SIZE = '25';

type SortKey = ClientRulesOverviewSortKey;
type SortDir = 'asc' | 'desc';
// Counters open on their biggest value; the name on A→Z.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  tenantName: 'asc',
  rulesMatched: 'desc',
  matched: 'desc',
  ready: 'desc',
  needsMapping: 'desc',
  unreadDocuments: 'desc',
  openDocumentRequests: 'desc',
  openQuestions: 'desc',
};

const SCOPE_LABEL: Record<string, string> = {
  tenant_user: 'Personal',
  tenant_firm: 'Client',
  global_firm: 'Global',
};

type PostTarget = { tenantIds: string[]; ruleIds?: string[]; label: string };

export function ClientRulesOverviewPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<SortKey>('tenantName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<PostTarget | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastResults, setLastResults] = useState<Map<string, ClientRulesPostTenantResult>>(new Map());

  const limit = Number(pageSize);
  const { data, isLoading, isError, refetch, isFetching } = useClientRulesOverview({
    limit,
    offset,
    search: search || undefined,
    sortBy,
    sortDir,
    includeExcluded,
  });
  const postMutation = usePostClientRules();
  const exclusion = useSetClientExcluded();
  const switchTo = useSwitchAndOpen();

  const rows = data?.data ?? [];
  const excludedTotal = data?.excludedTotal ?? 0;
  const canPost = (r: ClientRulesOverviewRow) => r.ready > 0 && !r.error && !r.excluded;
  const selectableIds = rows.filter(canPost).map((r) => r.tenantId);
  const selectedReady = rows.filter((r) => selected.has(r.tenantId) && canPost(r));
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  // First click on a column opens it in its natural direction; the next
  // click flips it. Any change restarts at the first page.
  const onSort = (key: SortKey) => {
    if (key === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir(DEFAULT_DIR[key]); }
    setOffset(0);
  };

  const setExcluded = (row: ClientRulesOverviewRow, excluded: boolean) => {
    exclusion.mutate({ tenantId: row.tenantId, excluded }, {
      onSuccess: () => {
        setSelected((s) => { const n = new Set(s); n.delete(row.tenantId); return n; });
        toast.success(excluded
          ? `${row.tenantName} is excluded from bulk posting.`
          : `${row.tenantName} is back on the overview.`);
      },
      onError: (e: Error) => toast.error(e.message || 'Could not update the client.'),
    });
  };

  // One request per client so a long run shows progress and one client's
  // failure never hides another's result.
  const runPost = async (target: PostTarget) => {
    setConfirm(null);
    setProgress({ done: 0, total: target.tenantIds.length });
    const results = new Map(lastResults);
    let posted = 0;
    let failed = 0;
    for (const [i, tenantId] of target.tenantIds.entries()) {
      try {
        const res = await postMutation.mutateAsync({ tenantIds: [tenantId], ruleIds: target.ruleIds });
        for (const r of res.results) {
          results.set(r.tenantId, r);
          posted += r.posted;
          failed += r.failed + (r.error ? 1 : 0);
        }
      } catch (err) {
        failed++;
        results.set(tenantId, {
          tenantId, posted: 0, skipped: 0, failed: 0, failures: [], more: false,
          error: err instanceof Error ? err.message : 'Request failed',
        });
      }
      setProgress({ done: i + 1, total: target.tenantIds.length });
    }
    setLastResults(results);
    setProgress(null);
    setSelected(new Set());
    if (failed > 0) toast.error(`Posted ${posted} transaction${posted === 1 ? '' : 's'}; ${failed} failed. See the client rows for details.`);
    else toast.success(`Posted ${posted} transaction${posted === 1 ? '' : 's'}.`);
  };

  const busy = progress !== null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <ListChecks className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Client Rules Overview</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-3xl">
        For every client you can reach: how many uncategorized bank transactions your rules
        would post, which global-rule accounts still need mapping to that client&apos;s chart of
        accounts, and what the client has sent or still owes you. Transactions are posted
        exactly as the Bank Feed would post them.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <CommitInput
            value={search}
            onCommit={(v) => { setSearch(v.trim()); setOffset(0); }}
            placeholder="Search clients…"
            aria-label="Search clients"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Button
          disabled={selectedReady.length === 0 || busy}
          onClick={() => setConfirm({
            tenantIds: selectedReady.map((r) => r.tenantId),
            label: `${selectedReady.reduce((n, r) => n + r.ready, 0)} ready transactions across ${selectedReady.length} client${selectedReady.length === 1 ? '' : 's'}`,
          })}
        >
          Post selected{selectedReady.length > 0 ? ` (${selectedReady.length})` : ''}
        </Button>
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching || busy}>
          {isFetching && !isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
        {(excludedTotal > 0 || includeExcluded) && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeExcluded}
              onChange={(e) => { setIncludeExcluded(e.target.checked); setOffset(0); }}
            />
            Show excluded clients{excludedTotal > 0 ? ` (${excludedTotal})` : ''}
          </label>
        )}
        {progress && (
          <span className="text-sm text-gray-600" role="status">
            Posting… {progress.done} of {progress.total} clients
          </span>
        )}
      </div>

      {isLoading ? (
        <OverviewSkeleton />
      ) : isError ? (
        <ErrorMessage message="Could not load the client rules overview." onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          {search
            ? 'No clients match your search.'
            : excludedTotal > 0
              ? `Every client you can reach is excluded from bulk posting (${excludedTotal}). Tick “Show excluded clients” to see them.`
              : 'You don’t have access to any clients yet.'}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all clients with ready transactions"
                      checked={allSelected}
                      disabled={selectableIds.length === 0 || busy}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))}
                    />
                  </th>
                  <SortableTh sortKey="tenantName" label="Client" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortableTh sortKey="rulesMatched" label="Rules matched" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Rules with at least one matching pending transaction" />
                  <SortableTh sortKey="matched" label="Matched" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Pending transactions at least one rule matches" />
                  <SortableTh sortKey="ready" label="Ready to post" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Pending transactions a rule would post now" />
                  <SortableTh sortKey="needsMapping" label="Needs mapping" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Matched by a global rule whose account isn't mapped in this client yet" />
                  <SortableTh sortKey="unreadDocuments" label="Unread docs" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Unread documents the client submitted" />
                  <SortableTh sortKey="openDocumentRequests" label="Open requests" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Document requests still waiting on the client" />
                  <SortableTh sortKey="openQuestions" label="Open questions" align="right" padding="px-3 py-3" sortBy={sortBy} sortDir={sortDir} onSort={onSort} description="Portal questions waiting on the client's answer" />
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const isOpen = expanded.has(row.tenantId);
                  const result = lastResults.get(row.tenantId);
                  return (
                    <Fragment key={row.tenantId}>
                      <tr className={isOpen ? 'bg-gray-50' : undefined}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.tenantName}`}
                            checked={selected.has(row.tenantId)}
                            disabled={!canPost(row) || busy}
                            onChange={() => setSelected((s) => toggle(s, row.tenantId))}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium text-gray-900 hover:text-primary-700"
                            onClick={() => setExpanded((s) => toggle(s, row.tenantId))}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {row.tenantName}
                          </button>
                          {row.excluded && (
                            <span
                              className="ml-2 inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                              title="This client is excluded from bulk rule posting"
                            >
                              <Ban className="h-3 w-3" /> Excluded
                            </span>
                          )}
                          {row.error && <div className="mt-1 text-xs text-red-600">{row.error}</div>}
                          {!row.error && !row.tieredRules && (
                            <div className="mt-1 text-xs text-gray-500">
                              Firm and global rules are off for this client — only its own rules are counted.
                            </div>
                          )}
                          {row.truncated && (
                            <div className="mt-1 text-xs text-amber-700">
                              Counts cover the first {row.pendingItems.toLocaleString()} pending transactions.
                            </div>
                          )}
                          {result && <PostResultNote result={result} />}
                        </td>
                        <Num value={row.rulesMatched} />
                        <Num value={row.matched} />
                        <Num value={row.ready} strong />
                        <td className="px-3 py-3 text-right tabular-nums">
                          {row.needsMapping > 0 ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline"
                              onClick={() => setExpanded((s) => new Set(s).add(row.tenantId))}
                              title="Map this client's accounts"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {row.needsMapping}
                            </button>
                          ) : <span className="text-gray-400">0</span>}
                        </td>
                        <CountLink value={row.unreadDocuments} label="unread documents" onOpen={() => switchTo(row.tenantId, '/practice/reminders?tab=open&filter=unread')} />
                        <td className="px-3 py-3 text-right tabular-nums">
                          {row.openDocumentRequests > 0 ? (
                            <button
                              type="button"
                              className="font-medium text-primary-700 hover:underline"
                              onClick={() => switchTo(row.tenantId, '/practice/reminders?tab=open')}
                              aria-label={`${row.openDocumentRequests} open document requests for ${row.tenantName}`}
                            >
                              {row.openDocumentRequests}
                              {row.overdueDocumentRequests > 0 && (
                                <span className="ml-1 rounded bg-red-50 px-1 text-xs text-red-700 border border-red-200">
                                  {row.overdueDocumentRequests} overdue
                                </span>
                              )}
                            </button>
                          ) : <span className="text-gray-400">0</span>}
                        </td>
                        <CountLink value={row.openQuestions} label="open questions" onOpen={() => switchTo(row.tenantId, '/practice/client-portal?tab=questions')} />
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            disabled={!canPost(row) || busy}
                            title={row.excluded ? 'Excluded from bulk posting' : undefined}
                            onClick={() => setConfirm({
                              tenantIds: [row.tenantId],
                              label: `${row.ready} ready transaction${row.ready === 1 ? '' : 's'} for ${row.tenantName}`,
                            })}
                          >
                            Post
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50">
                          <td />
                          <td colSpan={9} className="px-3 pb-4">
                            <ClientDetail
                              row={row}
                              busy={busy || exclusion.isPending}
                              onPostRule={(ruleId, ruleName, ready) => setConfirm({
                                tenantIds: [row.tenantId],
                                ruleIds: [ruleId],
                                label: `${ready} transaction${ready === 1 ? '' : 's'} matched by “${ruleName}” for ${row.tenantName}`,
                              })}
                              onOpenFeed={() => switchTo(row.tenantId, '/banking/feed')}
                              onSetExcluded={(excluded) => setExcluded(row, excluded)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Pagination
              total={data?.total ?? 0}
              limit={limit}
              offset={offset}
              onChange={setOffset}
              unit="clients"
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={(size) => { setPageSize(size); setOffset(0); }}
            />
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Post rule matches?"
        message={confirm ? `This posts ${confirm.label} to the ledger, exactly as approving them on the Bank Feed would. Items a rule marks for review are never posted.` : undefined}
        confirmLabel="Post"
        onConfirm={() => { if (confirm) void runPost(confirm); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function Num({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <td className="px-3 py-3 text-right tabular-nums">
      {value > 0
        ? <span className={strong ? 'font-semibold text-gray-900' : 'text-gray-900'}>{value}</span>
        : <span className="text-gray-400">0</span>}
    </td>
  );
}

function CountLink({ value, label, onOpen }: { value: number; label: string; onOpen: () => void }) {
  return (
    <td className="px-3 py-3 text-right tabular-nums">
      {value > 0 ? (
        <button type="button" className="font-medium text-primary-700 hover:underline" onClick={onOpen} aria-label={`${value} ${label}`}>
          {value}
        </button>
      ) : <span className="text-gray-400">0</span>}
    </td>
  );
}

function PostResultNote({ result }: { result: ClientRulesPostTenantResult }) {
  if (result.error) return <div className="mt-1 text-xs text-red-600">Post failed: {result.error}</div>;
  return (
    <div className="mt-1 text-xs text-gray-600">
      Last post: {result.posted} posted
      {result.failed > 0 && <span className="text-red-600"> · {result.failed} failed ({result.failures[0]?.error})</span>}
      {result.more && <span> · more remain — post again</span>}
    </div>
  );
}

function ClientDetail({
  row,
  busy,
  onPostRule,
  onOpenFeed,
  onSetExcluded,
}: {
  row: ClientRulesOverviewRow;
  busy: boolean;
  onPostRule: (ruleId: string, ruleName: string, ready: number) => void;
  onOpenFeed: () => void;
  onSetExcluded: (excluded: boolean) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 pt-2">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-gray-800">Matches by rule</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs text-gray-600 hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => onSetExcluded(!row.excluded)}
              title={row.excluded
                ? 'Show this client on the overview again and allow bulk posting'
                : 'Hide this client from the overview and refuse bulk posting — for clients who do not want bulk changes'}
            >
              {row.excluded ? 'Include in bulk posting' : 'Exclude from bulk posting'}
            </button>
            <button type="button" className="text-xs text-primary-700 hover:underline" onClick={onOpenFeed}>
              Open Bank Feed →
            </button>
          </div>
        </div>
        {row.excluded && (
          <p className="mb-2 rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-700">
            Excluded: this client does not receive bulk postings from this page. Its rules still run on the Bank Feed.
          </p>
        )}
        {row.rules.length === 0 ? (
          <p className="text-sm text-gray-500">
            {row.pendingItems === 0 ? 'No pending bank transactions.' : `No rule matches any of the ${row.pendingItems} pending transactions.`}
          </p>
        ) : (
          <table className="w-full text-sm bg-white rounded border border-gray-200">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Rule</th>
                <th className="px-3 py-2 text-right font-medium">Matched</th>
                <th className="px-3 py-2 text-right font-medium">Ready</th>
                <th className="px-3 py-2 text-right font-medium">Needs mapping</th>
                <th className="px-3 py-2 text-right font-medium">For review</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {row.rules.map((r) => (
                <tr key={r.ruleId}>
                  <td className="px-3 py-2">
                    {r.ruleName}
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{SCOPE_LABEL[r.scope] ?? r.scope}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.matched}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{r.ready}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.needsMapping || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.needsReview || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="secondary" disabled={r.ready === 0 || busy || row.excluded} onClick={() => onPostRule(r.ruleId, r.ruleName, r.ready)}>
                      Post
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <MappingPanel row={row} />
    </div>
  );
}

// Global rules point at accounts in the client they were written on; each
// other client says which of its own accounts stands in for each one.
function MappingPanel({ row }: { row: ClientRulesOverviewRow }) {
  const toast = useToast();
  const needed = row.unmappedAccounts;
  const options = useClientMappingOptions(needed.length > 0 ? row.tenantId : null);
  const save = useSaveClientMapping();
  const [choice, setChoice] = useState<Record<string, string>>({});

  if (needed.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Account mapping</h3>
        <p className="text-sm text-gray-500">Every global rule that matched here resolves to one of this client&apos;s accounts.</p>
      </div>
    );
  }
  if (!row.firmId) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Account mapping</h3>
        <p className="text-sm text-gray-500">This client isn&apos;t managed by a firm, so global rule accounts can&apos;t be mapped here.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">Account mapping needed</h3>
      <p className="text-xs text-gray-500 mb-2">
        Choose which of {row.tenantName}&apos;s accounts each global-rule account posts to. Saved once per client.
      </p>
      {options.isLoading ? (
        <div className="h-16 animate-pulse rounded bg-gray-100" />
      ) : options.isError ? (
        <ErrorMessage message="Could not load this client's accounts." onRetry={() => options.refetch()} />
      ) : (
        <ul className="space-y-2">
          {needed.map((acct) => {
            const label = acct.sourceAccountNumber ? `${acct.sourceAccountNumber} · ${acct.sourceAccountName}` : acct.sourceAccountName;
            const value = choice[acct.sourceAccountId] ?? '';
            return (
              <li key={acct.sourceAccountId} className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white p-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{label}</div>
                  <div className="text-xs text-gray-500">{acct.items} transaction{acct.items === 1 ? '' : 's'} waiting</div>
                </div>
                <select
                  aria-label={`Account in ${row.tenantName} for ${acct.sourceAccountName}`}
                  className="w-full sm:w-64 rounded border border-gray-300 px-2 py-1 text-sm"
                  value={value}
                  onChange={(e) => setChoice((c) => ({ ...c, [acct.sourceAccountId]: e.target.value }))}
                >
                  <option value="">Choose an account…</option>
                  {(options.data?.accounts ?? []).filter((a) => a.accountType === acct.sourceAccountType).map((a) => (
                    <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} · ${a.name}` : a.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!value || save.isPending}
                  onClick={() => save.mutate(
                    { tenantId: row.tenantId, sourceAccountId: acct.sourceAccountId, accountId: value },
                    {
                      onSuccess: () => toast.success(`Mapped ${acct.sourceAccountName} for ${row.tenantName}.`),
                      onError: (e: Error) => toast.error(e.message || 'Could not save the mapping.'),
                    },
                  )}
                >
                  Save
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3" aria-label="Loading client rules overview">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  );
}

// Switch the session into `tenantId`, then land on `path` there — the same
// full-navigation switch the Clients screen does, plus a destination.
function useSwitchAndOpen() {
  const { clearActiveCompany } = useCompanyContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  return async (tenantId: string, path: string) => {
    try {
      const result = await apiClient<{ tokens: { accessToken: string } }>('/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      if (!result?.tokens?.accessToken) throw new Error('Server did not return new access tokens.');
      setTokens(result.tokens);
      clearActiveCompany();
      queryClient.clear();
      window.onbeforeunload = null;
      window.location.assign(`${window.location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not switch client.');
    }
  };
}
