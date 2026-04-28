// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { GitBranch, X } from 'lucide-react';
import type { ConditionalRule, TenantFirmAssignmentWithTenant } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { useForkConditionalRule } from '../../../api/hooks/useConditionalRules';
import { useFirmTenants } from '../../../api/hooks/useFirms';

interface Props {
  rule: ConditionalRule;
  firmId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

// 3-tier rules plan, Phase 5 — Fork modal. Lets a firm staffer
// pick one or more managed tenants to fork the global rule into.
// Each fork creates a tenant_firm rule with `forked_from_global_id`
// pointing back; the global stays unchanged for everyone else.
//
// Multi-select fans out one mutation per tenant (the API endpoint
// is single-tenant — keeping it that way avoids partial-batch
// ambiguity in the audit log).
export function ForkRuleModal({ rule, firmId, onClose, onSuccess }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fork = useForkConditionalRule();
  const { data: tenants } = useFirmTenants(firmId);

  const activeTenants: TenantFirmAssignmentWithTenant[] =
    (tenants?.assignments ?? []).filter((a) => a.isActive);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFork = async () => {
    setError(null);
    const ids = Array.from(selected);
    setProgress({ done: 0, total: ids.length });
    let i = 0;
    for (const tenantId of ids) {
      try {
        await fork.mutateAsync({ id: rule.id, tenantId });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fork failed');
        setProgress(null);
        return;
      }
      i += 1;
      setProgress({ done: i, total: ids.length });
    }
    setProgress(null);
    onSuccess?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">Fork rule to tenant</h2>
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

        <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
          <p className="text-sm text-gray-700">
            Fork <span className="font-medium">{rule.name}</span> for one or more managed
            tenants. Each fork shadows this global rule for its tenant; the global stays
            unchanged elsewhere.
          </p>

          {activeTenants.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No managed tenants available to fork into.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
              {activeTenants.map((a) => (
                <li key={a.tenantId} className="px-3 py-2 hover:bg-gray-50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(a.tenantId)}
                      onChange={() => toggle(a.tenantId)}
                    />
                    <span className="font-medium text-gray-900">{a.tenantName}</span>
                    <span className="text-xs font-mono text-gray-500">{a.tenantSlug}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {progress && (
            <p className="text-xs text-gray-500">
              Forking… {progress.done} of {progress.total}
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
            onClick={handleFork}
            disabled={fork.isPending || selected.size === 0}
          >
            {fork.isPending
              ? 'Forking…'
              : selected.size === 1
                ? 'Fork to 1 tenant'
                : `Fork to ${selected.size} tenants`}
          </Button>
        </div>
      </div>
    </div>
  );
}
