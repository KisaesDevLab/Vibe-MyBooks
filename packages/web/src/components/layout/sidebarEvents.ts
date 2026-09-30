// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useRef } from 'react';

// Clicking the app title collapses every sidebar group. The main nav
// groups live in Sidebar's own state, but Admin / Practice / Trial
// Balance each own their collapse state (and storage key), so the
// title broadcasts a window event those groups listen for.
export const SIDEBAR_COLLAPSE_ALL_EVENT = 'sidebar:collapse-all';

export function dispatchSidebarCollapseAll(): void {
  window.dispatchEvent(new Event(SIDEBAR_COLLAPSE_ALL_EVENT));
}

export function useSidebarCollapseAll(onCollapseAll: () => void): void {
  const handlerRef = useRef(onCollapseAll);
  handlerRef.current = onCollapseAll;
  useEffect(() => {
    const listener = () => handlerRef.current();
    window.addEventListener(SIDEBAR_COLLAPSE_ALL_EVENT, listener);
    return () => window.removeEventListener(SIDEBAR_COLLAPSE_ALL_EVENT, listener);
  }, []);
}
