// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { ArrowDown, X } from 'lucide-react';
import type { ConditionalRule, RuleScope, TenantFirmAssignmentWithTenant } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { useDemoteConditionalRule } from '../../../api/hooks/useConditionalRules';
import { useFirmTenants } from '../../../api/hooks/useFirms';
import { TierBadge } from './TierBadge';

interface Props {
  rule: ConditionalRule;
  /** When the rule is global_firm we need to ask which tenant
   *  to demote into; the modal queries the firm's managed tenants
   *  via this firmId. */
  firmId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const NEXT_TIER_DOWN: Record<RuleScope, RuleScope | null> = {
  global_firm: 'tenant_firm',
  tenant_firm: 'tenant_user',
  tenant_user: null,
};

// 3-tier rules plan, Phase 5 — Demote modal. global_firm →
// tenant_firm requires choosing a target tenant (the firm's
// managed tenant list); tenant_firm → tenant_user is a click.
export function DemoteRuleModal({ rule, firmId, onClose, onSuccess }: Props) {
  const next = NEXT_TIER_DOWN[rule.scope];
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const demote = useDemoteConditionalRule();
  const { data: tenants } = useFirmTenants(rule.scope === 'global_firm' ? firmId : null);

  if (!next) return null;
  const requiresTenantPicker = rule.scope === 'global_firm';
  const activeTenants: TenantFirmAssignmentWithTenant[] =
    (tenants?.assignments ?? []).filter((a) => a.isActive);

  const handle = async () => {
    setError(null);
    try {
      await demote.mutateAsync({
        id: rule.id,
        tenantId: requiresTenantPicker ? tenantId : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demote failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ArrowDown className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Demote rule</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-sm text-gray-700">
            Move <span className="font-medium">{rule.name}</span> from{' '}
            <TierBadge scope={rule.scope} /> to <TierBadge scope={next} />.
          </p>

          {requiresTenantPicker && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700">Target tenant</span>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Pick a managed tenant…</option>
                {activeTenants.map((a) => (
                  <option key={a.tenantId} value={a.tenantId}>
                    {a.tenantName}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500">
                The rule moves to this tenant; other tenants will no longer see it.
              </span>
            </label>
          )}

          {!requiresTenantPicker && (
            <p className="text-xs text-gray-500 italic">
              You become the owner. Only you will see the rule going forward.
            </p>
          )}

          {error && <p className="text-xs text-rose-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handle}
            disabled={demote.isPending || (requiresTenantPicker && !tenantId)}
          >
            {demote.isPending ? 'Demoting…' : 'Demote'}
          </Button>
        </div>
      </div>
    </div>
  );
}
