// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { AttachFileButton } from '../../../attachments/AttachFileButton';

interface Props {
  bankFeedItemId: string;
}

// Per-row "attach receipt" affordance for bucket rows that don't have an
// attached receipt yet. Uploads with attachable_type='bank_feed_items' so the
// attachments route auto-fires receipt OCR, then invalidates the bucket query
// so the new attachment and its OCR signals flow through to the row's
// ReceiptComparisonPanel without a refresh.
//
// The upload mechanics now live in AttachFileButton, shared with the
// Uncategorized screen. This wrapper keeps the bucket call sites unchanged.
export function AttachReceiptButton({ bankFeedItemId }: Props) {
  return (
    <AttachFileButton
      attachableType="bank_feed_items"
      attachableId={bankFeedItemId}
      invalidateKeys={[['practice', 'classification']]}
      label="Attach receipt"
    />
  );
}
