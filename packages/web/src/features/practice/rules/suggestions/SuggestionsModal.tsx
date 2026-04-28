// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Lightbulb, X } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { useRuleSuggestions, type RuleSuggestion } from '../../../../api/hooks/useRuleSuggestions';
import { useCreateConditionalRule } from '../../../../api/hooks/useConditionalRules';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Phase 5b §5.7 — suggestions modal. One row per detected
// pattern; "Create rule" POSTs the proposed rule directly
// (no builder round-trip). Suggestion that's been created is
// invalidated out by the create mutation's onSuccess.
export function SuggestionsModal({ open, onClose }: Props) {
  const { data, isLoading } = useRuleSuggestions();
  const create = useCreateConditionalRule();

  if (!open) return null;
  const suggestions = data?.suggestions ?? [];

  const createFromSuggestion = (s: RuleSuggestion) => {
    create.mutate({
      name: s.proposedRule.name,
      conditions: s.proposedRule.conditions,
      actions: s.proposedRule.actions,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Suggested rules</h2>
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

        <div className="flex-1 overflow-auto px-5 py-3">
          <p className="text-sm text-gray-600 mb-3">
            These patterns appear repeatedly in your categorization history with low override rates. One-click create a rule to automate the categorization next time.
          </p>
          {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {!isLoading && suggestions.length === 0 && (
            <p className="text-sm italic text-gray-500">
              No suggestions right now. We&apos;ll surface patterns once you&apos;ve categorized similar transactions a few times.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <li
                key={`${s.payeePattern}-${i}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {s.proposedRule.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Pattern <code className="font-mono">{s.payeePattern}</code> →{' '}
                    {s.accountName}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Confirmed {s.timesConfirmed}× · override rate{' '}
                    {Math.round(s.overrideRate * 100)}%
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => createFromSuggestion(s)}
                  disabled={create.isPending}
                >
                  Create rule
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
