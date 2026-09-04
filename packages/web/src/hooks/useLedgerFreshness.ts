// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Keeps open screens honest without polling the screens themselves.
//
// The problem this solves: a list left sitting open never refetched, so
// anything written elsewhere — another user posting, an approval in a second
// tab, the bank sync running in the worker — stayed invisible until the page
// was reloaded. Nothing caches at the HTTP layer, so a reload was the only
// thing that cleared it.
//
// The naive fix is to poll every list. That is exactly the lag we do not want:
// re-running a transaction query every few seconds costs real work whether or
// not anything changed. Instead this polls ONE integer.
//
// `gl_version_stamps` is bumped by database triggers on journal_lines and on
// the balance-relevant columns of transactions (migration 0144), so the number
// moves for every ledger write in the system including ones no browser can
// see. Reading it is a two-row indexed lookup. We refetch the real data only
// when the number actually moves.

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useOptionalCompanyContext } from '../providers/CompanyProvider';

/**
 * How often to ask "did anything change?". The request is trivial, so this is
 * about how quickly a change should surface, not about cost. React Query
 * pauses the interval while the window is not focused (refetchIntervalInBackground
 * defaults to false), so a backgrounded tab costs nothing at all.
 */
const CHECK_MS = 20_000;

export function useLedgerFreshness(): void {
  const queryClient = useQueryClient();
  // Optional on purpose: this hook rides along in the shell and must never
  // be the reason a tree fails to render.
  const activeCompanyId = useOptionalCompanyContext()?.activeCompanyId ?? null;

  // Last stamp we acted on, remembered per company so switching companies
  // does not read as "the ledger changed".
  const seen = useRef<{ companyId: string | null; stamp: number } | null>(null);

  const { data } = useQuery({
    queryKey: ['ledger-version', activeCompanyId],
    queryFn: () => apiClient<{ stamp: number }>('/ledger-version'),
    refetchInterval: CHECK_MS,
    // Always ask the server; a cached answer defeats the whole point.
    staleTime: 0,
    // A blip here must never surface as an error to the user: the worst case
    // is the old behaviour, where a screen goes stale until it remounts.
    retry: false,
    refetchOnWindowFocus: true,
  });

  const stamp = data?.stamp;

  useEffect(() => {
    if (stamp == null) return;
    const companyId = activeCompanyId ?? null;
    const prev = seen.current;

    // First reading for this company establishes the baseline. Invalidating
    // here would fire a pointless refetch storm on every page load.
    if (!prev || prev.companyId !== companyId) {
      seen.current = { companyId, stamp };
      return;
    }
    if (prev.stamp === stamp) return;

    seen.current = { companyId, stamp };
    // Only ACTIVE queries actually refetch, so this costs the handful of
    // queries on the screen in front of the user, and only when the books
    // really moved. The watcher excludes itself to avoid a feedback loop.
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== 'ledger-version',
    });
  }, [stamp, activeCompanyId, queryClient]);
}
