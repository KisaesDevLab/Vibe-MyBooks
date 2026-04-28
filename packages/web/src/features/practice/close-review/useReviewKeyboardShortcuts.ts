// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onToggleSelect?: () => void;
  onApprove?: () => void;
  onApproveAll?: () => void;
}

// Hook attaches a single keydown listener to `document` and
// restricts firing to when focus is inside the ref's subtree so
// shortcuts don't collide with browser defaults (Space scrolling,
// for example). Callers typically rebuild the `handlers` object
// every render — we stash it in a ref so the listener only
// re-attaches when `enabled` changes, not on every parent render.
// Build plan §2.5 spec:
//   - Space  → toggle-select focused row
//   - Enter  → approve focused row
//   - A      → approve-all in current bucket
export function useReviewKeyboardShortcuts(
  container: React.RefObject<HTMLElement>,
  handlers: ShortcutHandlers,
  enabled: boolean = true,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const node = container.current;
      if (!node) return;
      const active = document.activeElement;
      if (!active || !node.contains(active)) return;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLSelectElement) return;
      // Buttons inside the subtree (Approve, Reclassify, etc.)
      // already activate on Enter/Space — let those go to the
      // button so we don't fire a row-level action on top of a
      // button-specific one.
      if (active instanceof HTMLButtonElement && active !== container.current) return;

      const h = handlersRef.current;
      if (e.key === ' ' || e.code === 'Space') {
        if (h.onToggleSelect) {
          e.preventDefault();
          h.onToggleSelect();
        }
      } else if (e.key === 'Enter') {
        if (h.onApprove) {
          e.preventDefault();
          h.onApprove();
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (h.onApproveAll) {
          e.preventDefault();
          h.onApproveAll();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [container, enabled]);
}
