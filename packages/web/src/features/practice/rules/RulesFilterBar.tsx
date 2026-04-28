// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { ACTION_TYPES, ACTION_TYPES_DEFERRED, type ActionType } from '@kis-books/shared';

export type ActiveFilter = 'all' | 'active' | 'inactive';
export type CompanyScopeFilter = 'all' | 'tenant' | 'company';
// 3-tier rules plan, Phase 5 — segmented tier filter facet.
// "mine" = caller's tenant_user; "firm" = tenant_firm; "global" =
// global_firm. The page hides the facet entirely when the
// current context has no firm role (solo books).
export type TierFilter = 'all' | 'mine' | 'firm' | 'global';

interface Props {
  activeFilter: ActiveFilter;
  onActiveFilterChange: (f: ActiveFilter) => void;
  companyScopeFilter: CompanyScopeFilter;
  onCompanyScopeFilterChange: (f: CompanyScopeFilter) => void;
  actionTypeFilter: ActionType | 'all';
  onActionTypeFilterChange: (a: ActionType | 'all') => void;
  tierFilter?: TierFilter;
  onTierFilterChange?: (f: TierFilter) => void;
  showTierFilter?: boolean;
}

// Phase 5a §5.1 — filters above the rules table.
// activeFilter: active / inactive / all.
// companyScopeFilter: tenant-wide rules vs company-scoped vs all.
// actionTypeFilter: narrow to rules whose action list contains a
// given action type (the page does this filter client-side).
export function RulesFilterBar({
  activeFilter,
  onActiveFilterChange,
  companyScopeFilter,
  onCompanyScopeFilterChange,
  actionTypeFilter,
  onActionTypeFilterChange,
  tierFilter = 'all',
  onTierFilterChange,
  showTierFilter,
}: Props) {
  const availableActions = ACTION_TYPES.filter(
    (t) => !(ACTION_TYPES_DEFERRED as readonly string[]).includes(t),
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showTierFilter && onTierFilterChange && (
        <Select
          label="Tier"
          value={tierFilter}
          onChange={(v) => onTierFilterChange(v as TierFilter)}
          options={[
            { value: 'all', label: 'All tiers' },
            { value: 'mine', label: 'Mine' },
            { value: 'firm', label: 'Firm' },
            { value: 'global', label: 'Global' },
          ]}
        />
      )}
      <Select
        label="Status"
        value={activeFilter}
        onChange={(v) => onActiveFilterChange(v as ActiveFilter)}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active only' },
          { value: 'inactive', label: 'Inactive only' },
        ]}
      />
      <Select
        label="Scope"
        value={companyScopeFilter}
        onChange={(v) => onCompanyScopeFilterChange(v as CompanyScopeFilter)}
        options={[
          { value: 'all', label: 'All' },
          { value: 'tenant', label: 'Tenant-wide' },
          { value: 'company', label: 'Company-specific' },
        ]}
      />
      <Select
        label="Action type"
        value={actionTypeFilter}
        onChange={(v) => onActionTypeFilterChange(v as ActionType | 'all')}
        options={[
          { value: 'all', label: 'All actions' },
          ...availableActions.map((a) => ({ value: a, label: pretty(a) })),
        ]}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function pretty(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
