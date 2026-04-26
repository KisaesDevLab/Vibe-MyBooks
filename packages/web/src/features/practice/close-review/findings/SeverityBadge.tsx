// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import clsx from 'clsx';
import type { FindingSeverity } from '@kis-books/shared';

const TONE: Record<FindingSeverity, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-200',
  med: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

const LABEL: Record<FindingSeverity, string> = {
  low: 'Low',
  med: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        TONE[severity],
      )}
    >
      {LABEL[severity]}
    </span>
  );
}
