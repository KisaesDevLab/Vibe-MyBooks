// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { ArrowDown, ArrowUp, GitBranch, GripVertical, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { FirmRole } from '@kis-books/shared';
import type { RuleWithStats } from '../../../api/hooks/useConditionalRules';
import {
  useDeleteConditionalRule,
  useReorderConditionalRules,
  useUpdateConditionalRule,
} from '../../../api/hooks/useConditionalRules';
import { TierBadge } from './TierBadge';

interface Props {
  rules: RuleWithStats[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (rule: RuleWithStats) => void;
  sortBy: 'priority' | 'name' | 'lastFired';
  onSortByChange: (s: 'priority' | 'name' | 'lastFired') => void;
  // 3-tier rules plan, Phase 5 — tier transition handlers. Null
  // when the firm context isn't loaded yet (or the tenant is a
  // solo book); the row hides the buttons in that case.
  firmRole?: FirmRole | null;
  onPromote?: (rule: RuleWithStats) => void;
  onDemote?: (rule: RuleWithStats) => void;
  onFork?: (rule: RuleWithStats) => void;
}

// Phase 5a §5.1 — sortable + drag-reorderable rules table.
// Native HTML5 drag-and-drop (no new dependency); persists the
// new order via the existing /reorder endpoint.
export function RulesTable({
  rules,
  selected,
  onToggleSelect,
  onSelectAll,
  onEdit,
  sortBy,
  onSortByChange,
  firmRole,
  onPromote,
  onDemote,
  onFork,
}: Props) {
  // Per-tier action availability mirrors the server-side gates:
  //   - promote tenant_user → tenant_firm: any firm role on the tenant
  //   - promote tenant_firm → global_firm: firm_admin
  //   - demote down a tier: same restrictions in reverse
  //   - fork: only on global_firm rules; firm_staff or admin
  function canPromote(scope: string): boolean {
    if (!firmRole) return false;
    if (scope === 'tenant_user') return firmRole === 'firm_admin' || firmRole === 'firm_staff';
    if (scope === 'tenant_firm') return firmRole === 'firm_admin';
    return false;
  }
  function canDemote(scope: string): boolean {
    if (!firmRole) return false;
    if (scope === 'global_firm') return firmRole === 'firm_admin';
    if (scope === 'tenant_firm') return firmRole === 'firm_admin' || firmRole === 'firm_staff';
    return false;
  }
  function canFork(scope: string): boolean {
    if (!firmRole) return false;
    return scope === 'global_firm' && (firmRole === 'firm_admin' || firmRole === 'firm_staff');
  }
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const update = useUpdateConditionalRule();
  const remove = useDeleteConditionalRule();
  const reorder = useReorderConditionalRules();

  const sorted = [...rules].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'lastFired') {
      const la = a.stats?.lastFiredAt ? new Date(a.stats.lastFiredAt).getTime() : 0;
      const lb = b.stats?.lastFiredAt ? new Date(b.stats.lastFiredAt).getTime() : 0;
      return lb - la;
    }
    return a.priority - b.priority;
  });

  const handleDrop = (overId: string) => {
    if (!draggingId || draggingId === overId) {
      setDraggingId(null);
      return;
    }
    const ids = sorted.map((r) => r.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggingId(null);
      return;
    }
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    setDraggingId(null);
    reorder.mutate(next);
  };

  const allSelected = rules.length > 0 && selected.size === rules.length;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
            <th className="px-2 py-2 w-8" />
            <th className="px-2 py-2 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-2 cursor-pointer" onClick={() => onSortByChange('priority')}>
              Priority{sortBy === 'priority' && ' ↑'}
            </th>
            <th className="px-3 py-2 cursor-pointer" onClick={() => onSortByChange('name')}>
              Name{sortBy === 'name' && ' ↑'}
            </th>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2 cursor-pointer" onClick={() => onSortByChange('lastFired')}>
              Last fired{sortBy === 'lastFired' && ' ↓'}
            </th>
            <th className="px-3 py-2 text-right">Fires (30d)</th>
            <th className="px-3 py-2 text-right">Override rate</th>
            <th className="px-3 py-2 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center text-gray-500 italic py-8">
                No conditional rules yet. Click "New rule" to create one.
              </td>
            </tr>
          )}
          {sorted.map((r) => {
            const isSelected = selected.has(r.id);
            const isDragging = draggingId === r.id;
            return (
              <tr
                key={r.id}
                draggable={sortBy === 'priority'}
                onDragStart={() => setDraggingId(r.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(r.id)}
                onDragEnd={() => setDraggingId(null)}
                className={clsx(
                  isSelected && 'bg-indigo-50',
                  isDragging && 'opacity-50',
                )}
              >
                <td className="px-2 py-2 text-gray-400">
                  {sortBy === 'priority' && <GripVertical className="h-4 w-4 cursor-grab" />}
                </td>
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.priority}</td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  <div className="flex flex-col">
                    <span>{r.name}</span>
                    {r.forkedFromGlobalId && (
                      <span className="text-[11px] text-gray-500 font-normal">
                        ↳ forked from a global rule
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <TierBadge scope={r.scope} forked={!!r.forkedFromGlobalId} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: r.id, patch: { active: !r.active } })}
                    className={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                      r.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {r.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {r.stats?.lastFiredAt ? new Date(r.stats.lastFiredAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{r.stats?.fires30d ?? 0}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {r.stats?.overrideRate === null || r.stats?.overrideRate === undefined
                    ? '—'
                    : `${Math.round(r.stats.overrideRate * 100)}%`}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {/* 3-tier rules plan, Phase 5 — tier transition
                        actions. Self-gated on firmRole + scope. The
                        buttons disappear cleanly on solo books and
                        non-firm members. */}
                    {onPromote && canPromote(r.scope) && (
                      <button
                        type="button"
                        onClick={() => onPromote(r)}
                        aria-label={`Promote ${r.name}`}
                        title={r.scope === 'tenant_user' ? 'Promote to Firm tier' : 'Promote to Global tier'}
                        className="rounded p-1 text-gray-500 hover:bg-sky-50 hover:text-sky-700"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onDemote && canDemote(r.scope) && (
                      <button
                        type="button"
                        onClick={() => onDemote(r)}
                        aria-label={`Demote ${r.name}`}
                        title={r.scope === 'global_firm' ? 'Demote to a tenant' : 'Demote to your personal rules'}
                        className="rounded p-1 text-gray-500 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onFork && canFork(r.scope) && (
                      <button
                        type="button"
                        onClick={() => onFork(r)}
                        aria-label={`Fork ${r.name}`}
                        title="Fork this global rule for one tenant"
                        className="rounded p-1 text-gray-500 hover:bg-violet-50 hover:text-violet-700"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      aria-label={`Edit ${r.name}`}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete rule "${r.name}"? This removes its audit history too.`)) {
                          remove.mutate(r.id);
                        }
                      }}
                      aria-label={`Delete ${r.name}`}
                      className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
