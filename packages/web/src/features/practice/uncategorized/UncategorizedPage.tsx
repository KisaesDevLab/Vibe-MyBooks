// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Practice -> Uncategorized. One screen for everything not yet classified:
//
//   Not posted       bank lines still off the ledger entirely
//   In suspense      amounts posted to the holding account, awaiting a category
//   Client suggested categories clients proposed from the portal
//
// A row travels tab 1 -> tab 2 when staff post it to suspense, and leaves
// tab 2 when someone picks a real category. Nothing here posts by itself.

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Inbox, Layers, MessageSquare } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { useSuspenseSummary, useSuggestions } from '../../../api/hooks/useUncategorized';
import { NotPostedTab } from './NotPostedTab';
import { InSuspenseTab } from './InSuspenseTab';
import { ClientSuggestedTab } from './ClientSuggestedTab';

type TabKey = 'not-posted' | 'in-suspense' | 'client-suggested';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Inbox }> = [
  { key: 'not-posted', label: 'Not posted', icon: Inbox },
  { key: 'in-suspense', label: 'In suspense', icon: Layers },
  { key: 'client-suggested', label: 'Client suggested', icon: MessageSquare },
];

export function UncategorizedPage() {
  // Tab lives in the URL so the notification email and the dashboard badge
  // can deep-link straight to the queue they are talking about.
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : 'not-posted';

  const summary = useSuspenseSummary();
  const unread = useSuggestions({ unread: true, limit: 1 });
  const unreadCount = unread.data?.total ?? 0;

  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };

  const balance = summary.data?.balance ?? '0';
  const balanceIsZero = Math.abs(Number(balance)) < 0.005;

  const counts = useMemo<Record<TabKey, number | null>>(() => ({
    'not-posted': summary.data?.unpostedCount ?? null,
    'in-suspense': summary.data?.transactionCount ?? null,
    'client-suggested': unreadCount || null,
  }), [summary.data, unreadCount]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Uncategorized</h1>
        <p className="text-sm text-gray-500">
          Everything waiting on a category, in one place. Posting to suspense keeps the bank
          reconciled while the classification work happens here.
        </p>
      </header>

      {/* Header strip. The suspense balance is the size of the unfinished work. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Sitting in suspense"
          value={formatMoney(balance)}
          tone={balanceIsZero ? 'ok' : 'warn'}
          hint={balanceIsZero ? 'Nothing unclassified on the ledger' : `${summary.data?.transactionCount ?? 0} transaction(s)`}
        />
        <Tile
          label="Not posted yet"
          value={String(summary.data?.unpostedCount ?? 0)}
          tone={(summary.data?.unpostedCount ?? 0) > 0 ? 'warn' : 'ok'}
          hint="Bank lines still off the ledger"
        />
        <Tile
          label="Client answers to review"
          value={String(unreadCount)}
          tone={unreadCount > 0 ? 'info' : 'ok'}
          hint="Nothing posts until you approve"
        />
      </div>

      {summary.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Could not load the summary.
          <button className="underline" onClick={() => summary.refetch()}>Retry</button>
        </div>
      )}

      <nav className="flex gap-1 border-b border-gray-200" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                active
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {count !== null && count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  t.key === 'client-suggested'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'not-posted' && <NotPostedTab />}
      {tab === 'in-suspense' && <InSuspenseTab />}
      {tab === 'client-suggested' && <ClientSuggestedTab />}
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
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500">{hint}</div>
    </div>
  );
}
