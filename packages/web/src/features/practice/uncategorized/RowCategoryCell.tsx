// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// One row's category picker on the Uncategorized tabs.
//
// Picking an account does NOT post. The pick is a draft until the row's own
// Save is pressed, and an unsaved-changes marker says so — otherwise a row
// vanishing from the list the instant a dropdown closed would read as an
// accidental posting, and a mis-click would already be in the books.
//
// Uses the same AccountSelector every transaction form uses, so the search,
// the account-number display and the by-type filtering behave identically to
// the rest of the app.

import { CircleDot, Loader2, Save } from 'lucide-react';
import { AccountSelector } from '../../../components/forms/AccountSelector';

export function RowCategoryCell({
  value, onChange, onSave, saving, disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  saving: boolean;
  /** True while any other write on the page is in flight. */
  disabled: boolean;
}) {
  const dirty = value !== '';

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-52 min-w-[10rem]">
        <AccountSelector value={value} onChange={onChange} compact />
      </div>

      {dirty && (
        <>
          <CircleDot
            className="h-4 w-4 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <span className="sr-only">Not saved yet</span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || disabled}
            title="Save this category. The row leaves this list."
            aria-label="Save this category"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </>
      )}
    </div>
  );
}
