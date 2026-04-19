// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Small floating-tooltip wrapper that reveals a keyboard chord when the
// user hovers the wrapped element. Purely CSS (group-hover + opacity
// transition); pointer-events on the tooltip itself are disabled so it
// never blocks a click on the underlying button.

import type { ReactNode } from 'react';

export interface ShortcutTooltipProps {
  /** Keyboard chord to display, e.g. "Ctrl/Cmd+Enter". */
  chord: string;
  /** The element (typically a Button) the tooltip points at. */
  children: ReactNode;
}

export function ShortcutTooltip({ chord, children }: ShortcutTooltipProps) {
  return (
    <span className="relative group inline-block">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <kbd className="font-mono">{chord}</kbd>
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"
        />
      </span>
    </span>
  );
}
