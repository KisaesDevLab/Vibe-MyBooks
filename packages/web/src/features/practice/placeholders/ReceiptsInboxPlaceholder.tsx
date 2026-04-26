// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { ComingSoonCard } from '../ComingSoonCard';

export function ReceiptsInboxPlaceholder() {
  return (
    <ComingSoonCard
      feature="Receipts Inbox"
      description="Bookkeeper-facing queue of unmatched receipts captured from the mobile PWA, email forwarding, and storage providers. Match receipts to transactions or create new ones from the receipt data."
      buildPhase="Phase 15 (Receipt PWA companion surface)"
    />
  );
}
