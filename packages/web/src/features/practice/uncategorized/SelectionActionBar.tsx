// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface Props {
  selectedCount: number;
  totalCount: number;
  /** More rows exist beyond the loaded page — render the count as "N+". */
  hasMore?: boolean;
  allSelected: boolean;
  disabled?: boolean;
  onToggleAll: () => void;
  onClearSelection: () => void;
  /** The page's own actions, rendered on the right. */
  children?: ReactNode;
}

/**
 * The presentational half of Close Review's BulkActionBar, with the
 * classification-bucket coupling removed so any list can use it. Actions are
 * a slot rather than a fixed set of callbacks.
 *
 * Selection is per-page here, not cumulative across pages: every action on
 * this screen posts to or moves money in the general ledger, and "select all"
 * meaning "all the rows I happen to have loaded" is a footgun when the button
 * next to it writes journal lines.
 */
export function SelectionActionBar({
  selectedCount, totalCount, hasMore, allSelected, disabled,
  onToggleAll, onClearSelection, children,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 flex-wrap">
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onToggleAll}
          disabled={disabled || totalCount === 0}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 disabled:text-gray-400"
        >
          <span
            className={`inline-block h-4 w-4 rounded border ${
              allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
            }`}
          />
          {allSelected ? 'Deselect all' : 'Select all on this page'}
        </button>
        <span className="text-xs text-gray-500">
          {selectedCount} of {totalCount}{hasMore ? '+' : ''} selected
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {selectedCount > 0 && (
          <Button variant="secondary" onClick={onClearSelection} disabled={disabled}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
