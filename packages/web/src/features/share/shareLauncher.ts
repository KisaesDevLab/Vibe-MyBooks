// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tiny opener registry connecting the Knowledge Base launcher buttons to the
// globally-mounted SharePanel. The panel (banner, approval prompts, pointer
// overlay) must live in the AppShell so an active session survives
// navigation; only the ENTRY buttons live on the Knowledge Base page, so a
// context provider would be overkill for one imperative call.

let openFn: (() => void) | null = null;

/** Called by SharePanel on mount. Returns an unregister cleanup. */
export function registerShareOpener(fn: () => void): () => void {
  openFn = fn;
  return () => {
    if (openFn === fn) openFn = null;
  };
}

/** Open the pre-share consent modal (no-op if the panel isn't mounted). */
export function openShareModal(): void {
  openFn?.();
}
