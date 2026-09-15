// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Banking → Uncategorized. The team-member view of what is sitting in
// suspense. Two modes, decided by the server (/practice/uncategorized/mode):
//
//   suggest  the books are managed by a firm (or you are not the owner of
//            self-managed books): pick what each amount was and SEND it;
//            the reviewer approves and posts. Nothing here touches the ledger.
//   review   you own self-managed books: the same suggest tab for your team's
//            answers, plus a Suggested tab where you approve or reject.

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Layers, MessageSquare } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { useSuspenseSummary, useSuggestions, type UncategorizedMode } from '../../../api/hooks/useUncategorized';
import { ClientSuggestedTab } from '../../practice/uncategorized/ClientSuggestedTab';
import { TeamSuspenseTab } from './TeamSuspenseTab';

type TabKey = 'needs-category' | 'suggested';

export function TeamUncategorizedPage({ mode }: { mode: UncategorizedMode }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabKey = raw === 'suggested' && mode.canReview ? 'suggested' : 'needs-category';

  const summary = useSuspenseSummary();
  // Only reviewers may read the suggestions list; for everyone else the
  // request would 403, so it is not even made.
  const unread = useSuggestions({ unread: true, limit: 1 }, mode.canReview);
  const unreadCount = unread.data?.total ?? 0;

  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };

  const balance = summary.data?.balance ?? '0';
  const balanceIsZero = Math.abs(Number(balance)) < 0.005;
  const reviewerName = mode.firmName ?? 'your accounting firm';

  const tabs = useMemo(() => {
    const list: Array<{ key: TabKey; label: string; icon: typeof Layers; count: number | null }> = [
      { key: 'needs-category', label: 'Needs a category', icon: Layers, count: summary.data?.transactionCount ?? null },
    ];
    if (mode.canReview) {
      list.push({ key: 'suggested', label: 'Suggested', icon: MessageSquare, count: unreadCount || null });
    }
    return list;
  }, [mode.canReview, summary.data, unreadCount]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Uncategorized</h1>
        <p className="text-sm text-gray-500">
          {mode.managedByFirm
            ? <>Amounts the bank recorded that nobody has categorized yet. Pick what each one was and send it — nothing posts until <strong>{reviewerName}</strong> approves it.</>
            : mode.canReview
              ? <>Amounts the bank recorded that nobody has categorized yet. Your team suggests a category; you approve it on the Suggested tab, which posts it.</>
              : <>Amounts the bank recorded that nobody has categorized yet. Pick what each one was and send it — nothing posts until an owner approves it.</>}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Tile
          label="Sitting in suspense"
          value={formatMoney(balance)}
          tone={balanceIsZero ? 'ok' : 'warn'}
          hint={balanceIsZero ? 'Nothing waiting on a category' : `${summary.data?.transactionCount ?? 0} transaction(s)`}
        />
        {mode.canReview && (
          <Tile
            label="Suggestions to review"
            value={String(unreadCount)}
            tone={unreadCount > 0 ? 'info' : 'ok'}
            hint="Nothing posts until you approve"
          />
        )}
      </div>

      {summary.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Could not load the summary.
          <button className="underline" onClick={() => summary.refetch()}>Retry</button>
        </div>
      )}

      {tabs.length > 1 && (
        <nav className="flex gap-1 border-b border-gray-200" role="tablist">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                  active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                    t.key === 'suggested' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {tab === 'needs-category' && <TeamSuspenseTab mode={mode} />}
      {tab === 'suggested' && <ClientSuggestedTab />}
    </div>
  );
}

function Tile({ label, value, hint, tone }: {
  label: string; value: string; hint: string; tone: 'ok' | 'warn' | 'info';
}) {
  const toneClass = tone === 'warn'
    ? 'border-amber-200 bg-amber-50'
    : tone === 'info'
      ? 'border-indigo-200 bg-indigo-50'
      : 'border-gray-200 bg-white';
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{hint}</div>
    </div>
  );
}
