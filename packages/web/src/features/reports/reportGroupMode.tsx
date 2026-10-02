// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Shared "View:" display mode for the P&L and Balance Sheet.
//   detail              — flat accounts
//   grouped / condensed — by detail type (headers + accounts + subtotals / subtotals only)
//   leadsheet / leadsheet_condensed — the same two presentations keyed by
//     the Trial Balance module's leadsheets (only offered when the TB
//     module is on for the client; unassigned accounts group last).

import { useFeatureFlag } from '../../api/hooks/useFeatureFlag';

export type GroupMode = 'detail' | 'grouped' | 'condensed' | 'leadsheet' | 'leadsheet_condensed';

export const isCondensedMode = (m: GroupMode) => m === 'condensed' || m === 'leadsheet_condensed';
export const isGroupedMode = (m: GroupMode) => m === 'grouped' || m === 'leadsheet';
export const isLeadsheetMode = (m: GroupMode) => m === 'leadsheet' || m === 'leadsheet_condensed';

// Query-string fragment for the report API (and its PDF/CSV exports).
export function groupModeParams(m: GroupMode): string {
  if (m === 'detail') return '';
  return `&group_by=${isLeadsheetMode(m) ? 'leadsheet' : 'detail_type'}${isCondensedMode(m) ? '&display=condensed' : ''}`;
}

// Leadsheets exist only in the Trial Balance module. A leadsheet mode
// remembered from another client falls back to Detail where it's off.
export function useEffectiveGroupMode(mode: GroupMode): { mode: GroupMode; leadsheetsAvailable: boolean } {
  const leadsheetsAvailable = useFeatureFlag('TRIAL_BALANCE_V1') === true;
  return { mode: !leadsheetsAvailable && isLeadsheetMode(mode) ? 'detail' : mode, leadsheetsAvailable };
}

export function GroupModeOptions({ leadsheets }: { leadsheets: boolean }) {
  return (
    <>
      <option value="detail">Detail</option>
      <option value="grouped">Grouped by detail type</option>
      <option value="condensed">Condensed (group totals)</option>
      {leadsheets && <option value="leadsheet">Grouped by leadsheet</option>}
      {leadsheets && <option value="leadsheet_condensed">Condensed (leadsheet totals)</option>}
    </>
  );
}
