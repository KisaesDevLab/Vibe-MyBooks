// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Which chart-of-accounts entries may receive a bank feed.
//
// One definition for all three pickers (the mapping wizard, the mapping modal
// and the remap modal), which previously each carried their own copy of the
// detail-type list and none of them excluded system accounts.
//
// The server enforces the same rule in plaid-mapping.service.ts. This is the
// affordance half: an account the server would reject must not be offered.

import type { Account } from '@kis-books/shared';

const FEEDABLE_DETAIL_TYPES = [
  'bank', 'credit_card', 'other_current_asset', 'other_current_liability',
];

/**
 * The one system role a bank feed belongs in. Every other system-tagged
 * account is a holding or control account — Payments Clearing, suspense, A/R —
 * and feeding one corrupts both it and the real bank balance. Payments
 * Clearing reached a live client's feed precisely because it was offered here.
 *
 * Mirrors BANK_FEED_SYSTEM_TAG in packages/api/src/services/system-accounts.service.ts.
 */
const BANK_FEED_SYSTEM_TAG = 'cash_on_hand';

export function isFeedableAccount(a: Account): boolean {
  if (!FEEDABLE_DETAIL_TYPES.includes(a.detailType ?? '')) return false;
  if (a.systemTag && a.systemTag !== BANK_FEED_SYSTEM_TAG) return false;
  return true;
}
