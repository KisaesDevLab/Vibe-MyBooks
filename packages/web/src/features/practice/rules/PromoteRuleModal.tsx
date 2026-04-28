// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { ArrowUp, AlertTriangle, X } from 'lucide-react';
import type { ConditionalRule, RuleScope } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { usePromoteConditionalRule } from '../../../api/hooks/useConditionalRules';
import { TierBadge } from './TierBadge';

interface Props {
  rule: ConditionalRule;
  onClose: () => void;
  onSuccess?: () => void;
}

const NEXT_TIER: Record<RuleScope, RuleScope | null> = {
  tenant_user: 'tenant_firm',
  tenant_firm: 'global_firm',
  global_firm: null,
};

// 3-tier rules plan, Phase 5 — Promote modal. Walks the user
// through the tier change. The tenant_firm → global_firm step
// surfaces a warning about action-target portability (UUIDs
// stored in the rule are tenant-specific; global rules need
// system_tag rebinding via the Phase-4 resolver, and any
// account without a system_tag will be skipped at fire time).
export function PromoteRuleModal({ rule, onClose, onSuccess }: Props) {
  const next = NEXT_TIER[rule.scope];
  const [confirmActionShapes, setConfirmActionShapes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promote = usePromoteConditionalRule();

  if (!next) return null;

  const isPromoteToGlobal = next === 'global_firm';

  const handlePromote = async () => {
    setError(null);
    try {
      await promote.mutateAsync({
        id: rule.id,
        confirmActionShapes: isPromoteToGlobal ? confirmActionShapes : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promote failed');
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
            <ArrowUp className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-gray-900">Promote rule</h2>
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

          {isPromoteToGlobal && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 flex flex-col gap-2">
                <p>
                  Global rules apply across every tenant your firm manages. Action targets
                  reference tenant-specific accounts; the engine rebinds them via the{' '}
                  <code className="font-mono">system_tag</code> on each tenant&apos;s
                  Chart of Accounts. Any account without a system tag will be silently
                  skipped on tenants that lack the matching tag.
                </p>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmActionShapes}
                    onChange={(e) => setConfirmActionShapes(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I understand action targets must have a matching system_tag in each
                    managed tenant.
                  </span>
                </label>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePromote}
            disabled={
              promote.isPending || (isPromoteToGlobal && !confirmActionShapes)
            }
          >
            {promote.isPending ? 'Promoting…' : `Promote to ${NEXT_TIER[rule.scope] === 'tenant_firm' ? 'Firm' : 'Global'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
