// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A floating panel (menu / popover) rendered in a portal on document.body with
// fixed positioning, so it is never clipped by an ancestor's `overflow`
// (modals, scrollable tables, sticky toolbars) and always stacks on top. The
// panel re-pins to its anchor on scroll/resize, flips above when there isn't
// room below, and clamps to the viewport horizontally.
//
// The caller owns open/close state; pass `panelRef` if an outside-click handler
// needs to treat clicks inside the panel as "inside".

import { useState, useLayoutEffect, useCallback, type ReactNode, type RefObject, type Ref } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface AnchoredPortalProps {
  /** The trigger element the panel is positioned against. */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  /** Which edge of the panel aligns to the anchor. Default 'left'. */
  align?: 'left' | 'right';
  /** Fixed panel width in px. Omit to match the anchor's width. */
  width?: number;
  /** Upper bound on the panel height (clamped to available space too). */
  maxHeight?: number;
  className?: string;
  /** Forwarded to the panel element so callers can exclude it from outside-click. */
  panelRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function AnchoredPortal({
  anchorRef,
  open,
  align = 'left',
  width,
  maxHeight = 360,
  className,
  panelRef,
  children,
}: AnchoredPortalProps) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 4;
    const w = width ?? r.width;
    const spaceBelow = window.innerHeight - r.bottom - GAP - 8;
    const spaceAbove = r.top - GAP - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const h = Math.max(120, Math.min(maxHeight, openUp ? spaceAbove : spaceBelow));
    let left = align === 'right' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    setPos({ left, width: w, maxHeight: h, top: openUp ? r.top - GAP - h : r.bottom + GAP });
  }, [anchorRef, align, width, maxHeight]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const onScroll = () => update();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, update]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={panelRef}
      className={clsx('fixed z-[1000] overflow-auto', className)}
      style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}
