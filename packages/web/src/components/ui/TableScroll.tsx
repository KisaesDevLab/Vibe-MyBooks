// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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
 */
export function TableScroll({ children, className = '' }: TableScrollProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}
