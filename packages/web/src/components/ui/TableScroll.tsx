// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { ReactNode } from 'react';

interface TableScrollProps {
  children: ReactNode;
  /** Extra classes appended to the card wrapper. */
  className?: string;
}

/**
 * House-style card container for a data table. Horizontally scrolls its
 * contents on narrow viewports (`overflow-x-auto`) instead of clipping them
 * (`overflow-hidden`), so right-side columns and row actions stay reachable
 * on a phone. Pair with a `min-w-full` table so it fills wide and scrolls
 * narrow. Use this instead of hand-rolling the wrapper div to prevent the
 * clip regression from creeping back in.
 *
 * `relative` makes the card the containing block for absolutely positioned
 * descendants (e.g. a `sr-only` column header), so overflow-x-auto clips
 * them too; without it they escape the card and widen the whole page.
 */
export function TableScroll({ children, className = '' }: TableScrollProps) {
  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}
