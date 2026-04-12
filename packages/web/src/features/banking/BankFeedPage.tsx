import { useState, useMemo } from 'react';
import type { BankFeedStatus, BankFeedItem } from '@kis-books/shared';
import { useBankFeed, useBankConnections, useCategorizeFeedItem, useExcludeFeedItem, useBulkApprove, useBulkCategorize, useBulkExclude, useBulkRecleanse, useMatchFeedItem, useMatchCandidates, usePayrollOverlapCheck } from '../../api/hooks/useBanking';
import { useAiConfig, useAiCategorize, useAiBatchCategorize } from '../../api/hooks/useAi';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Check, X, CheckCheck, Brain, Sparkles, ChevronDown, ChevronUp, Save, Trash2, FolderInput, Search, ArrowUpDown, RefreshCw, Link2 } from 'lucide-react';
import { apiClient } from '../../api/client';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  matched: 'bg-green-100 text-green-700',
  categorized: 'bg-blue-100 text-blue-700',
  excluded: 'bg-gray-100 text-gray-500',
};

function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 0.9) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">High</span>;
  if (score >= 0.7) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">Medium</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">Low</span>;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface EditState {
  feedDate: string;
  description: string;
  memo: string;
  contactId: string;
}

type SortKey = 'feedDate' | 'description' | 'status' | 'amount';
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
  const [statusFilter, setStatusFilter] = useState<BankFeedStatus | ''>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ feedDate: '', description: '', memo: '', contactId: '' });
  const [catAccountId, setCatAccountId] = useState('');
  const [batchCatAccountId, setBatchCatAccountId] = useState('');
  const [showBatchCategorize, setShowBatchCategorize] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('feedDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [matchModalFor, setMatchModalFor] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading, isFetching, refetch } = useBankFeed({
    status: statusFilter || undefined,
    bankConnectionId: connectionFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: debouncedSearch || undefined,
    limit: 200,
  });
  const { data: connectionsData } = useBankConnections();
  const { data: aiConfig } = useAiConfig();
  const categorize = useCategorizeFeedItem();
  const exclude = useExcludeFeedItem();
  const bulkApprove = useBulkApprove();
  const bulkCategorize = useBulkCategorize();
  const bulkExclude = useBulkExclude();
  const bulkRecleanse = useBulkRecleanse();
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

  const sortedItems = useMemo(() => {
    const items = [...(data?.data || [])];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'feedDate': cmp = a.feedDate.localeCompare(b.feedDate); break;
        case 'description': cmp = (a.description || '').localeCompare(b.description || ''); break;
        case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
        case 'amount': cmp = parseFloat(a.amount) - parseFloat(b.amount); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [data?.data, sortKey, sortDir]);

  if (firstLoad) return <LoadingSpinner className="py-12" />;
  const items = sortedItems;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pending = items.filter((i) => i.status === 'pending').map((i) => i.id);
    setSelected(new Set(pending));
  };

  const expandItem = (item: any) => {
    if (expandedId === item.id) { setExpandedId(null); return; }
    setExpandedId(item.id);
    setEditState({
      feedDate: item.feedDate,
      description: item.description || '',
      memo: item.category || '',
      contactId: item.suggestedContactId || '',
    });
    setCatAccountId(item.suggestedAccountId || '');
  };

  const handleSaveAndCategorize = async (itemId: string) => {
    await apiClient(`/banking/feed/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        feedDate: editState.feedDate, description: editState.description,
        memo: editState.memo, contactId: editState.contactId || undefined,
      }),
    });
    if (catAccountId) {
      categorize.mutate({
        id: itemId, accountId: catAccountId,
        contactId: editState.contactId || undefined, memo: editState.memo || undefined,
      }, { onSuccess: () => { setExpandedId(null); } });
    } else {
      refetch();
      setExpandedId(null);
    }
  };

  const handleAcceptSuggestion = async (item: any) => {
    if (!item.suggestedAccountId) return;
    categorize.mutate({ id: item.id, accountId: item.suggestedAccountId, contactId: item.suggestedContactId || undefined }, {
      onSuccess: () => {
        apiClient('/ai/categorize/accept', {
          method: 'POST',
          body: JSON.stringify({ feedItemId: item.id, accountId: item.suggestedAccountId, contactId: item.suggestedContactId, accepted: true, modified: false }),
        }).catch(() => {});
      },
    });
  };

  const handleAiBatchCategorize = () => {
    const pendingIds = items.filter((i) => i.status === 'pending' && !i.suggestedAccountId).map((i) => i.id);
    if (pendingIds.length === 0) return;
    aiBatch.mutate(pendingIds, { onSuccess: () => refetch() });
  };

  const pendingWithoutSuggestion = items.filter((i) => i.status === 'pending' && !i.suggestedAccountId).length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const connections = connectionsData?.connections || [];
  const hasFilters = search || startDate || endDate || connectionFilter;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bank Feed</h1>
        <div className="flex gap-2">
          {aiEnabled && pendingWithoutSuggestion > 0 && selected.size === 0 && (
            <Button size="sm" variant="secondary" onClick={handleAiBatchCategorize} loading={aiBatch.isPending}>
              <Brain className="h-4 w-4 mr-1" /> AI Categorize ({pendingWithoutSuggestion})
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
                {connections.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.accountName || c.institutionName || 'Bank Account'}{c.mask ? ` (****${c.mask})` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-gray-400" />
            <input placeholder="Search name, memo..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm" />
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
            {(['', 'pending', 'categorized', 'matched', 'excluded'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setConnectionFilter(''); }}
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
              <Button size="sm" disabled={!batchCatAccountId} loading={bulkCategorize.isPending}
                onClick={() => bulkCategorize.mutate(
                  { feedItemIds: [...selected], accountId: batchCatAccountId },
                  { onSuccess: () => { setSelected(new Set()); setShowBatchCategorize(false); setBatchCatAccountId(''); } },
                )}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowBatchCategorize(false); setBatchCatAccountId(''); }}>Cancel</Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setShowBatchCategorize(true)}>
                <FolderInput className="h-4 w-4 mr-1" /> Categorize
              </Button>
              {aiEnabled && (
                <Button size="sm" variant="secondary" onClick={() => aiBatch.mutate([...selected], { onSuccess: () => { refetch(); setSelected(new Set()); } })} loading={aiBatch.isPending}>
                  <Brain className="h-4 w-4 mr-1" /> AI Categorize
                </Button>
              )}
              <Button size="sm" onClick={() => bulkApprove.mutate([...selected], { onSuccess: () => setSelected(new Set()) })} loading={bulkApprove.isPending}>
                <CheckCheck className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bulkRecleanse.mutate([...selected], { onSuccess: () => setSelected(new Set()) })} loading={bulkRecleanse.isPending}>
                <RefreshCw className="h-4 w-4 mr-1" /> Re-cleanse
              </Button>
              <Button size="sm" variant="danger"
                onClick={() => { if (confirm(`Exclude ${selected.size} item${selected.size > 1 ? 's' : ''}?`)) bulkExclude.mutate([...selected], { onSuccess: () => setSelected(new Set()) }); }}
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-3">
                  {pendingCount > 0 && (
                    <input type="checkbox"
                      checked={selected.size > 0 && selected.size === pendingCount}
                      ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < pendingCount; }}
                      onChange={() => selected.size === pendingCount ? setSelected(new Set()) : selectAll()}
                      className="rounded border-gray-300 text-primary-600 h-[15px] w-[15px]" />
                  )}
                </th>
                <SortHeader label="Date" sortKey="feedDate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Name" sortKey="description" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Category" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Amount" sortKey="amount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="text-right" />
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                const amt = parseFloat(item.amount);
                return (
                  <tr key={item.id} className={isExpanded ? 'bg-primary-50/30' : 'hover:bg-gray-50'}
                    onDoubleClick={() => { if (item.status === 'pending' && !isExpanded) expandItem(item); }}>
                    <td className="px-3 py-3">
                      {item.status === 'pending' && (
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
                          <p className="text-xs text-gray-400">{(item as any).bankAccountName || (item as any).institutionName || ''}</p>
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
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-900 font-medium">{item.description || '—'}</p>
                          {(item as any).originalDescription && (item as any).originalDescription !== item.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[300px]" title={(item as any).originalDescription}>{(item as any).originalDescription}</p>
                          )}
                          {item.suggestedAccountId && item.status === 'pending' && (
                            <p className="text-xs text-primary-600 flex items-center gap-0.5 mt-0.5">
                              <Sparkles className="h-3 w-3" />
                              {(item as any).suggestedAccountName || 'Suggested'}
                              {item.confidenceScore && <ConfidenceBadge score={parseFloat(item.confidenceScore)} />}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {isExpanded ? (
                        <div className="space-y-1">
                          <AccountSelector value={catAccountId} onChange={setCatAccountId} />
                          <input value={editState.memo}
                            onChange={(e) => setEditState((s) => ({ ...s, memo: e.target.value }))}
                            className="block w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Memo" />
                          <PayrollOverlapBanner feedItemId={item.id} />
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[item.status] || ''}`}>
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-mono font-medium whitespace-nowrap ${amt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {amt > 0 ? '-' : '+'}${Math.abs(amt).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isExpanded ? (
                          <>
                            <Button size="sm" onClick={() => handleSaveAndCategorize(item.id)} loading={categorize.isPending}>
                              <Save className="h-3.5 w-3.5 mr-1" /> {catAccountId ? 'Save & Categorize' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : item.status === 'pending' ? (
                          <>
                            {item.suggestedAccountId && (
                              <Button size="sm" variant="secondary" onClick={() => handleAcceptSuggestion(item)} loading={categorize.isPending}>
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
                            <button onClick={() => setMatchModalFor(item.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-blue-500 hover:text-blue-700" title="Find existing transaction to match">
                              <Link2 className="h-4 w-4" />
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
      <p className="text-sm text-gray-500 mt-2">{data?.total ?? 0} items</p>

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
