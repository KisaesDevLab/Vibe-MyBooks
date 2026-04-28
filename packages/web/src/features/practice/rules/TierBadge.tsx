// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { RuleScope } from '@kis-books/shared';

// 3-tier rules plan, Phase 5 — tier badge. Reused in the rules
// table, the builder modal radio, the firm-admin rules list, and
// the audit log. Keeping it standalone keeps the visual treatment
// in one place: slate for personal, blue for firm-tenant, violet
// for global-firm.
const STYLES: Record<RuleScope, { bg: string; fg: string; label: string }> = {
  tenant_user: {
    bg: 'bg-slate-100',
    fg: 'text-slate-700',
    label: 'Mine',
  },
  tenant_firm: {
    bg: 'bg-sky-100',
    fg: 'text-sky-700',
    label: 'Firm',
  },
  global_firm: {
    bg: 'bg-violet-100',
    fg: 'text-violet-700',
    label: 'Global',
  },
};

const TOOLTIPS: Record<RuleScope, string> = {
  tenant_user: 'Visible only to you on this tenant.',
  tenant_firm: 'Visible to all firm staff on this tenant.',
  global_firm: 'Auto-applied to every tenant your firm manages.',
};

interface Props {
  scope: RuleScope;
  /** When true, a small ↳ glyph appears so the rules table can
   *  flag forks in the Name column. */
  forked?: boolean;
}

export function TierBadge({ scope, forked }: Props) {
  const style = STYLES[scope];
  return (
    <span
      title={TOOLTIPS[scope]}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.fg}`}
    >
      {forked && <span aria-hidden="true">↳</span>}
      {style.label}
    </span>
  );
}

export const TIER_TOOLTIPS = TOOLTIPS;
