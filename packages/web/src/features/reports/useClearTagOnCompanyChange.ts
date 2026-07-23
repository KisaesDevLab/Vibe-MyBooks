// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useRef } from 'react';
import { useCompanyContext } from '../../providers/CompanyProvider';

/**
 * Reset a report's tag/class filter whenever the active company changes.
 *
 * Tag (class) filters are company/tenant-scoped, but the report pages persist
 * the selected tagId in sessionStorage (useSessionState) which does NOT clear
 * on a company switch. A tag chosen for company A then carries into company B,
 * where it matches no journal lines — so the report renders EMPTY (the classic
 * "my P&L shows no data" after switching companies). Clearing the tag on the
 * change restores the full report.
 *
 * The ref skips the initial mount so an intentionally-set tag survives an
 * in-company page refresh; it only fires when activeCompanyId actually flips.
 * (CompanyProvider also purges the persisted `vibe:report-*:tagId` keys on
 * switch, covering reports that were NOT mounted at switch time.)
 */
export function useClearTagOnCompanyChange(setTagId: (value: string) => void): void {
  const { activeCompanyId } = useCompanyContext();
  const prev = useRef(activeCompanyId);
  useEffect(() => {
    if (prev.current !== activeCompanyId) {
      prev.current = activeCompanyId;
      setTagId('');
    }
  }, [activeCompanyId, setTagId]);
}
