// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Scale, ChevronRight } from 'lucide-react';
import type { ConditionalRule } from '@kis-books/shared';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useFirm } from '../../api/hooks/useFirms';
import {
  useConditionalRules,
  useTenantOverrides,
} from '../../api/hooks/useConditionalRules';
import { TierBadge } from '../practice/rules/TierBadge';
import { FirmTabs } from './FirmTabs';

// 3-tier rules plan, Phase 5 — firm-admin rules page. Lists the
// firm's global rules with a per-rule "tenant overrides" panel
// that exposes the forks pointing back at each global. Editing a
// global navigates to the practice rules surface (where the
// existing builder modal handles authoring).
export function FirmRulesPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const firm = useFirm(firmId ?? null);
  // The /practice/conditional-rules listing returns this firm's
  // globals via ?scope=global_firm when called from any tenant
  // managed by the firm. The page itself is firm-scoped, so we
  // rely on the user being on a managed tenant; if they're on a
  // solo book tab this returns empty and the empty state surfaces.
  const { data, isLoading } = useConditionalRules({ scope: 'global_firm' });
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  if (!firmId) return null;

  const globals = (data?.rules ?? []).filter((r) => r.scope === 'global_firm');

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{firm.data?.name ?? 'Firm'}</h1>
        <FirmTabs firmId={firmId} active="rules" />
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Global rules</h2>
          <p className="text-xs text-gray-500">
            Auto-applied across every tenant your firm manages. Tenants can fork a global
            for client-specific tweaks.
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="md" />
      ) : globals.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Scale className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">
            No global rules yet. Promote a tenant rule to global from the Practice
            &rarr; Rules page on a managed tenant.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {globals.map((r) => (
            <GlobalRuleRow
              key={r.id}
              rule={r}
              expanded={expandedRuleId === r.id}
              onToggle={() => setExpandedRuleId((prev) => (prev === r.id ? null : r.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GlobalRuleRow({
  rule,
  expanded,
  onToggle,
}: {
  rule: ConditionalRule;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className={
              'h-4 w-4 text-gray-400 transition-transform ' + (expanded ? 'rotate-90' : '')
            }
          />
          <span className="font-medium text-gray-900">{rule.name}</span>
          <TierBadge scope={rule.scope} />
        </div>
        <span className="text-xs text-gray-500 font-mono">priority {rule.priority}</span>
      </button>
      {expanded && <TenantOverridesPanel ruleId={rule.id} />}
    </li>
  );
}

function TenantOverridesPanel({ ruleId }: { ruleId: string }) {
  const { data, isLoading } = useTenantOverrides(ruleId);
  if (isLoading) {
    return (
      <div className="px-4 py-3 border-t border-gray-100">
        <LoadingSpinner size="sm" />
      </div>
    );
  }
  const overrides = data?.overrides ?? [];
  return (
    <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
        Tenant overrides ({overrides.length})
      </h3>
      {overrides.length === 0 ? (
        <p className="text-xs italic text-gray-500">
          No tenant has forked this rule. Every managed tenant runs the global verbatim.
        </p>
      ) : (
        <ul className="text-xs text-gray-700 flex flex-col gap-1">
          {overrides.map((o) => (
            <li key={o.ruleId} className="flex items-center gap-2">
              <TierBadge scope="tenant_firm" forked />
              <span className="font-mono">{o.tenantId.slice(0, 8)}…</span>
              <span className="text-gray-500">
                — last edited {new Date(o.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
