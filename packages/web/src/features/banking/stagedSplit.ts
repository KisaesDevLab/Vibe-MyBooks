// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { BankFeedItem } from '@kis-books/shared';

/**
 * Shown on a row whose rule staged a split (owner decision E1, engine QA
 * 2026-11-08). Accept suggestion, Assign, a category pick and bulk
 * Categorize post one line: the engine treats them as the owner's choice
 * and drops the split (U-164).
 */
export const STAGED_SPLIT_NOTICE =
  'This rule splits the amount. Accepting, assigning or changing the category here posts it as one line, without the split.';

/**
 * Whether the list row carries a split staged by a rule. `hasStagedSplit`
 * comes from GET /banking/feed once the engine pin includes it; before
 * that it is absent and no notice is shown.
 */
export function hasStagedSplit(item: BankFeedItem): boolean {
  return (item as BankFeedItem & { hasStagedSplit?: boolean }).hasStagedSplit === true;
}
