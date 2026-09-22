// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// One row's payee picker on the Uncategorized tabs.
//
// Same rule as the category next to it: picking a contact is a draft until
// the row's Save is pressed. A payee is header-level — saving it moves no
// money and the row stays on the list — but one Save per row is one rule to
// remember, and the amber marker means the same thing in both columns.
//
// Uses the shared ContactSelector, so search, quick-add and the by-type
// filter behave exactly as they do on Write Check and the Bank Feeds editor.

import { ContactSelector, type ContactSelection } from '../../../components/forms/ContactSelector';

export function RowPayeeCell({
  value, onChange, onSelect, checkPayee,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Fires with the picked contact so the caller can prefill its category. */
  onSelect?: (contact: ContactSelection | null) => void;
  /**
   * Payee read off the check image, shown as a hint under an empty picker
   * so the name the bookkeeper already saw on Bank Feeds is not lost here.
   */
  checkPayee?: string | null;
}) {
  return (
    <div className="min-w-[11rem]">
      <ContactSelector value={value} onChange={onChange} onSelect={onSelect} compact />
      {!value && checkPayee && (
        <p
          className="mt-0.5 truncate text-[11px] text-gray-500"
          title={`Payee read off the check image: ${checkPayee}. Search for or add the contact to link it.`}
        >
          On the check: {checkPayee}
        </p>
      )}
    </div>
  );
}
