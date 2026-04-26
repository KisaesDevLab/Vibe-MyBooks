// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import clsx from 'clsx';
import type { FindingStatus } from '@kis-books/shared';

const TONE: Record<FindingStatus, string> = {
  open: 'bg-rose-50 text-rose-700',
  assigned: 'bg-blue-50 text-blue-700',
  in_review: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  ignored: 'bg-gray-100 text-gray-600',
};

const LABEL: Record<FindingStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_review: 'In review',
  resolved: 'Resolved',
  ignored: 'Ignored',
};

export function StatusBadge({ status }: { status: FindingStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        TONE[status],
      )}
    >
      {LABEL[status]}
    </span>
  );
}

export const STATUS_LABELS = LABEL;
