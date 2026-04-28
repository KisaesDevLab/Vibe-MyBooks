// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { ClassificationBucket } from '@kis-books/shared';
import { Check, CheckCheck, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { BUCKET_LABELS } from './BucketSummaryRow';

interface Props {
  bucket: ClassificationBucket;
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  disabled?: boolean;
  onToggleAll: () => void;
  onApproveSelected: () => void;
  onApproveAll: () => Promise<void> | void;
  onClearSelection: () => void;
}

// Action bar above every bucket list. Build plan §2.5:
//   - Bulk select with header checkbox
//   - "Approve selected" — applies suggested classification
//   - "Approve all" per bucket — the parent owns the confirm
//     dialog so the button + keyboard shortcut both gate on it.
//   - "Clear selection" — deselects everything
// "Send back to [other bucket]" is implemented inline on each
// row via the reclassify button, not here.
export function BulkActionBar({
  bucket,
  selectedCount,
  totalCount,
  allSelected,
  disabled,
  onToggleAll,
  onApproveSelected,
  onApproveAll,
  onClearSelection,
}: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
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
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-xs text-gray-500">
          {selectedCount} of {totalCount} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <>
            <Button variant="secondary" onClick={onClearSelection} disabled={disabled}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button
              variant="primary"
              onClick={onApproveSelected}
              disabled={disabled || selectedCount === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve {selectedCount}
            </Button>
          </>
        )}
        <Button
          variant={selectedCount > 0 ? 'secondary' : 'primary'}
          onClick={() => void onApproveAll()}
          disabled={disabled || totalCount === 0}
        >
          <CheckCheck className="h-4 w-4 mr-1" />
          Approve all in {BUCKET_LABELS[bucket]}
        </Button>
      </div>
    </div>
  );
}
