// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Link } from 'react-router-dom';

// 3-tier rules plan, Phase 1 — shared sub-tab nav for the firm
// admin pages. Shared rather than per-page so the active-tab
// styling stays consistent. Phases 2-5 add `Rules` and
// `Settings` tabs as those surfaces ship.
type FirmTabKey = 'staff' | 'tenants' | 'rules';

interface FirmTabsProps {
  firmId: string;
  active: FirmTabKey;
}

const TABS: Array<{ key: FirmTabKey; label: string; path: string }> = [
  { key: 'staff', label: 'Staff', path: 'staff' },
  { key: 'tenants', label: 'Managed tenants', path: 'tenants' },
  { key: 'rules', label: 'Rules', path: 'rules' },
];

export function FirmTabs({ firmId, active }: FirmTabsProps) {
  return (
    <nav className="flex items-center gap-1 border-b border-gray-200 mt-3">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            to={`/firm/${firmId}/${t.path}`}
            className={
              '-mb-px inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-colors ' +
              (isActive
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700')
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
