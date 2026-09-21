// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Manual "reload what I'm looking at" for the header bar.
//
// useLedgerFreshness keeps screens current for anything that moves the GL,
// but plenty of writes never touch journal_lines — bank feed rows, contacts,
// rules, document requests, settings — so a screen can still sit stale until
// something remounts it. This is the escape hatch: mark EVERY cached query
// stale. The ones on screen refetch now; the rest refetch when next shown.
// Unlike a browser reload it keeps the route, scroll position and any
// half-entered form.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

// Fast refetches finish before the eye registers anything. Hold the spinner
// this long so a click always reads as "it did something".
const MIN_SPIN_MS = 600;

export function RefreshButton() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        // Resolves once the active queries have settled. A failed refetch
        // surfaces through that screen's own error state, not here.
        queryClient.invalidateQueries().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <button
      type="button"
      aria-label="Refresh data"
      title="Refresh data"
      aria-busy={refreshing}
      onClick={refresh}
      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
    >
      <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
    </button>
  );
}
