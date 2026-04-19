// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// ADR 0XZ — shared two-line split row primitive. Layout-only; parent
// forms own field state and pass rendered inputs via the line1/line2
// slots. No transaction-type-specific logic lives here so every entry
// surface (Expense, Bill, Invoice, JE, Register, …) can reuse the same
// keyboard and accessibility model without divergence.

import { X, Copy, Share2 } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode, KeyboardEvent } from 'react';

export interface SplitRowV2Props {
  /** 0-based row index. Used for accessible labels ("Split 2 of 4"). */
  index: number;
  /** Total number of splits, for the labeled group. */
  total: number;
  /** Whether this is the first row — enables the apply-to-all affordance. */
  isFirst?: boolean;
  /** Primary fields (Account/Amount/type-specific). Renders as row line 1. */
  line1: ReactNode;
  /** Secondary fields (Description + Tag). Renders as row line 2. */
  line2: ReactNode;
  /** Fires when the user activates the delete control. */
  onDelete?: () => void;
  /** Fires when the user activates the duplicate control. */
  onDuplicate?: () => void;
  /** ADR 0XZ §6.3 — apply this row's tag to every row below that has not
   *  been touched. Only rendered when `isFirst` is true. */
  onApplyTagToAll?: () => void;
  /** ADR 0XZ §3.1 — fires when the user presses Enter inside the final
   *  field of line 2, requesting a new row be added and focus moved to
   *  its first field. Parent forms implement the actual append. */
  onAddRow?: () => void;
  /** Row-level error message, rendered below the two lines. */
  errorMessage?: string | null;
  /** Compact density for power-user forms (Register, Batch Entry). */
  density?: 'comfortable' | 'compact';
  /** When set, row gains a primary-accent left border indicating focus/selection. */
  isActive?: boolean;
}

/**
 * Renders one logical split as two horizontal lines stacked inside a
 * single container. The two lines read as one unit; the container's
 * left border conveys row status (clean / active / error).
 */
export function SplitRowV2(props: SplitRowV2Props) {
  const {
    index,
    total,
    isFirst = false,
    line1,
    line2,
    onDelete,
    onDuplicate,
    onApplyTagToAll,
    onAddRow,
    errorMessage,
    density = 'comfortable',
    isActive = false,
  } = props;

  const padY = density === 'compact' ? 'py-2' : 'py-3';
  const padX = 'px-3';
  const hasError = Boolean(errorMessage);

  // ADR 0XZ §3.1 keyboard shortcuts, scoped to the row container so they
  // only fire when focus is inside this split. Cmd/Ctrl on Mac, Ctrl
  // elsewhere. Prevent default before firing so the browser's native
  // Cmd+D bookmark dialog and Ctrl+Delete word-delete don't hijack us.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'd' || e.key === 'D') && onDuplicate) {
      e.preventDefault();
      onDuplicate();
      return;
    }
    if (mod && (e.key === 'Backspace' || e.key === 'Delete') && onDelete) {
      e.preventDefault();
      onDelete();
      return;
    }
    if (mod && e.shiftKey && (e.key === 'a' || e.key === 'A') && isFirst && onApplyTagToAll) {
      e.preventDefault();
      onApplyTagToAll();
      return;
    }
    // Enter-to-add-row fires only when focus is in the LAST element of
    // line 2 (the caller signals this by wiring onAddRow; the component
    // listens on any enter-without-shift). Parent forms should attach
    // onAddRow only when they want the shortcut to apply to this row
    // (typically the last row, or the one focused on last field).
    if (e.key === 'Enter' && !e.shiftKey && !mod && onAddRow) {
      const target = e.target as HTMLElement;
      // Skip Enter in inputs that have their own Enter semantics (e.g.
      // a textarea). The primary use case is a plain <input> where the
      // user pressing Enter wants to advance.
      if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
      e.preventDefault();
      onAddRow();
    }
  };

  return (
    <div
      role="group"
      aria-labelledby={`split-row-${index}-label`}
      onKeyDown={handleKeyDown}
      className={clsx(
        'relative rounded-md border bg-white',
        hasError ? 'border-red-400' : 'border-gray-200',
        isActive && !hasError && 'border-primary-400',
      )}
    >
      <span id={`split-row-${index}-label`} className="sr-only">
        Split {index + 1} of {total}
      </span>

      {/* Left border accent — visual "you are here" signal. */}
      <span
        aria-hidden="true"
        className={clsx(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-md',
          hasError ? 'bg-red-400' : isActive ? 'bg-primary-500' : 'bg-transparent',
        )}
      />

      {/* Line 1 — primary fields + row actions. */}
      <div className={clsx('flex items-center gap-2', padX, padY)}>
        <div className="flex-1 min-w-0 flex items-center gap-2">{line1}</div>
        <div className="flex items-center gap-1">
          {isFirst && onApplyTagToAll && (
            <button
              type="button"
              onClick={onApplyTagToAll}
              aria-label="Apply this row's tag to all untouched tag rows"
              title="Apply tag to all empty tag rows (Cmd/Ctrl+Shift+A)"
              className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              aria-label={`Duplicate split ${index + 1}`}
              title="Duplicate row (Cmd/Ctrl+D)"
              className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete split ${index + 1}`}
              title="Delete row (Cmd/Ctrl+Backspace)"
              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visual separator between the two logical lines. */}
      <div className="border-t border-gray-100" aria-hidden="true" />

      {/* Line 2 — Description + Tag. Width proportions are enforced by the
          caller's layout; this container just provides the horizontal
          flex surface. */}
      <div className={clsx('flex items-center gap-2', padX, padY)}>
        {line2}
      </div>

      {errorMessage && (
        <div className={clsx('border-t border-red-200 bg-red-50 text-xs text-red-700', padX, 'py-1.5')}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
