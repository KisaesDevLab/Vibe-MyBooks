// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
//
// Keyboard-entry focus helpers: after picking an account / contact with
// Enter, focus moves on to the next logical field instead of being lost.

const FOCUSABLE = 'input, select, textarea, button, a[href], [tabindex]';

/**
 * Move focus to the next focusable, enabled, visible element after `from`
 * in DOM order, staying inside the nearest form (or dialog / document when
 * there is no form). Elements inside `skipWithin` (the dropdown's own
 * clear button) and anything tabIndex=-1 are skipped. Text inputs get
 * their content selected so typing replaces it. Returns false when there
 * is nothing to move to.
 */
export function focusNextField(from: HTMLElement, skipWithin?: HTMLElement | null): boolean {
  const scope: ParentNode = from.closest('form') ?? from.closest('[role="dialog"]') ?? document.body;
  const all = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE));
  const start = all.indexOf(from);
  if (start < 0) return false;
  for (const el of all.slice(start + 1)) {
    if (skipWithin && skipWithin.contains(el)) continue;
    if (el.tabIndex < 0) continue;
    if ((el as HTMLInputElement).disabled) continue;
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    if (el.closest('[hidden], [aria-hidden="true"], [inert]')) continue;
    // Not rendered (display:none ancestor / hidden at this breakpoint).
    // jsdom has no layout, so only trust this check in a real browser.
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (el.getClientRects().length === 0 && typeof navigator !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) continue;
    if (focusField(el)) return true;
  }
  return false;
}

/** Focus `el` and select a text input's contents so typing replaces it. */
export function focusField(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  el.focus();
  if (document.activeElement !== el) return false;
  if (el instanceof HTMLInputElement && /^(text|search|email|tel|url|number|)$/.test(el.type)) {
    try { el.select(); } catch { /* not selectable */ }
  }
  return true;
}

/** onAdvance helper: focus the first element matching `selector` inside `root` (default document). */
export function focusSelector(selector: string, root?: ParentNode | null): boolean {
  return focusField((root ?? document).querySelector<HTMLElement>(selector));
}
