// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Action, ActionType, RuleScope } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useConditionalRules, type RuleWithStats } from '../../../api/hooks/useConditionalRules';
import { RulesTable } from './RulesTable';
import { RulesFilterBar, type ActiveFilter, type CompanyScopeFilter, type TierFilter } from './RulesFilterBar';
import { BulkActionMenu } from './BulkActionMenu';
import { RuleBuilderModal } from './RuleBuilderModal';
import { SuggestionsBanner } from './suggestions/SuggestionsBanner';
import { ImportExportMenu } from './io/ImportExportMenu';
import { PromoteRuleModal } from './PromoteRuleModal';
import { DemoteRuleModal } from './DemoteRuleModal';
import { ForkRuleModal } from './ForkRuleModal';

// Phase 5a §5.1 — page composition. Replaces the Phase-1
// `RulesPlaceholder`. Combines the filter bar, bulk-action bar,
// rules table, and the builder modal.
export function RulesPage() {
  const { data, isLoading } = useConditionalRules();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'priority' | 'name' | 'lastFired'>('priority');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [companyScopeFilter, setCompanyScopeFilter] = useState<CompanyScopeFilter>('all');
  const [actionTypeFilter, setActionTypeFilter] = useState<ActionType | 'all'>('all');
  // 3-tier rules plan, Phase 5 — tier filter facet. Defaults to
  // "all" so the page renders the same content as Phase 4 for
  // anyone not using the firm tier.
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [editingRule, setEditingRule] = useState<RuleWithStats | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  // 3-tier transition modals — at most one open at a time.
  const [promotingRule, setPromotingRule] = useState<RuleWithStats | null>(null);
  const [demotingRule, setDemotingRule] = useState<RuleWithStats | null>(null);
  const [forkingRule, setForkingRule] = useState<RuleWithStats | null>(null);

  const firmId = data?.firmId ?? null;
  const firmRole = data?.firmRole ?? null;

  const filtered = useMemo(() => {
    const all = data?.rules ?? [];
    return all.filter((r) => {
      if (activeFilter === 'active' && !r.active) return false;
      if (activeFilter === 'inactive' && r.active) return false;
      if (companyScopeFilter === 'tenant' && r.companyId !== null) return false;
      if (companyScopeFilter === 'company' && r.companyId === null) return false;
      if (actionTypeFilter !== 'all') {
        if (!actionsContainType(r, actionTypeFilter)) return false;
      }
      if (tierFilter !== 'all' && tierMatch(r.scope, tierFilter) === false) return false;
      return true;
    });
  }, [data, activeFilter, companyScopeFilter, actionTypeFilter, tierFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rules</h1>
          <p className="text-sm text-gray-500">
            Conditional rules run before legacy bank rules. First match per priority wins (unless &quot;continue after match&quot; is enabled).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportMenu />
          <Button
            variant="primary"
            onClick={() => {
              setEditingRule(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New rule
          </Button>
        </div>
      </div>

      <SuggestionsBanner />

      <RulesFilterBar
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
        companyScopeFilter={companyScopeFilter}
        onCompanyScopeFilterChange={setCompanyScopeFilter}
        actionTypeFilter={actionTypeFilter}
        onActionTypeFilterChange={setActionTypeFilter}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
        showTierFilter={firmRole !== null}
      />

      <BulkActionMenu
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />

      <RulesTable
        rules={filtered}
        selected={selected}
        onToggleSelect={toggleSelect}
        onSelectAll={selectAll}
        onEdit={(r) => {
          setEditingRule(r);
          setBuilderOpen(true);
        }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        firmRole={firmRole}
        onPromote={firmRole ? (r) => setPromotingRule(r) : undefined}
        onDemote={firmRole ? (r) => setDemotingRule(r) : undefined}
        onFork={firmRole ? (r) => setForkingRule(r) : undefined}
      />

      <RuleBuilderModal
        open={builderOpen}
        rule={editingRule}
        firmRole={firmRole}
        onClose={() => {
          setBuilderOpen(false);
          setEditingRule(null);
        }}
      />

      {promotingRule && (
        <PromoteRuleModal
          rule={promotingRule}
          onClose={() => setPromotingRule(null)}
        />
      )}
      {demotingRule && (
        <DemoteRuleModal
          rule={demotingRule}
          firmId={firmId}
          onClose={() => setDemotingRule(null)}
        />
      )}
      {forkingRule && (
        <ForkRuleModal
          rule={forkingRule}
          firmId={firmId}
          onClose={() => setForkingRule(null)}
        />
      )}
    </div>
  );
}

// 3-tier rules plan, Phase 5 — match a rule scope against the
// segmented tier filter. `mine` means the caller's tenant_user
// rules; the parent already filtered by the calling tenant via
// the API query, so visibility is correct without an explicit
// owner_user_id check here.
function tierMatch(scope: RuleScope, filter: TierFilter): boolean {
  if (filter === 'mine') return scope === 'tenant_user';
  if (filter === 'firm') return scope === 'tenant_firm';
  if (filter === 'global') return scope === 'global_firm';
  return true;
}

// Walks an actions tree (flat or branching) looking for an
// action of the given type. Used by the action-type filter.
function actionsContainType(rule: RuleWithStats, type: ActionType): boolean {
  return walkActionsForType(rule.actions, type);
}

function walkActionsForType(actions: unknown, type: ActionType): boolean {
  if (Array.isArray(actions)) {
    return (actions as Action[]).some((a) => a.type === type);
  }
  if (actions && typeof actions === 'object') {
    const branch = actions as { then?: unknown; elif?: Array<{ then?: unknown }>; else?: unknown };
    if (walkActionsForType(branch.then, type)) return true;
    for (const e of branch.elif ?? []) {
      if (walkActionsForType(e.then, type)) return true;
    }
    if (branch.else && walkActionsForType(branch.else, type)) return true;
  }
  return false;
}
