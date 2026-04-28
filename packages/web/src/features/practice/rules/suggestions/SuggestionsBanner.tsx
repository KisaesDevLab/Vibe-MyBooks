// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useRuleSuggestions } from '../../../../api/hooks/useRuleSuggestions';
import { SuggestionsModal } from './SuggestionsModal';

// Phase 5b §5.7 — banner on the Rules page. Shown only when at
// least one suggestion exists. Clicking opens the modal.
export function SuggestionsBanner() {
  const { data } = useRuleSuggestions();
  const [open, setOpen] = useState(false);

  const count = data?.suggestions.length ?? 0;
  if (count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between gap-3 w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Lightbulb className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-900">
              {count} potential rule{count === 1 ? '' : 's'} detected
            </div>
            <div className="text-xs text-amber-700">
              Patterns from your categorization history that could be automated. Click to review.
            </div>
          </div>
        </div>
        <span className="text-xs font-medium text-amber-800 underline">View suggestions</span>
      </button>
      <SuggestionsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
