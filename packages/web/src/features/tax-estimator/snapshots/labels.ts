// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import type { SnapshotReason } from '@kis-books/shared';

export const SNAPSHOT_REASON_LABELS: Record<SnapshotReason, string> = {
  finalize: 'Finalized',
  vouchers: 'Vouchers issued',
  pdf: 'PDF generated',
  report_pack: 'Report Pack',
};

/** ISO timestamp -> 'Oct 12, 2026, 3:04 PM' in the viewer's local time. */
export function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
