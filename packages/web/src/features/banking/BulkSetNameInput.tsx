// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useContacts } from '../../api/hooks/useContacts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchableDropdown, type DropdownOption } from '../../components/forms/SearchableDropdown';

// Searchable name picker for the bank-feed bulk "Set Name" action. The
// value is a free-text name (what bulkSetName writes to the feed item's
// description), but the user can search existing contact names and pick
// one to standardize on a known payee — or type a brand-new name. The
// previous plain <input> offered no search/dropdown of available names.
export function BulkSetNameInput({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (name: string) => void;
  onEnter: () => void;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  // Server-side contact search (same pattern as the shared selectors) so
  // every existing name is reachable, not just the first page.
  const { data } = useContacts({ isActive: true, limit: 200, offset: 0, search: debouncedQuery || undefined });
  const contacts = data?.data ?? [];

  // De-dupe by display name — the picker sets a NAME string, so two
  // contacts sharing a name collapse to one option. The option id IS the
  // name, so onChange yields the chosen name directly.
  const seen = new Set<string>();
  const options: DropdownOption[] = [];
  for (const c of contacts) {
    if (seen.has(c.displayName)) continue;
    seen.add(c.displayName);
    options.push({ id: c.displayName, label: c.displayName, sublabel: c.contactType });
  }

  return (
    <div className="w-64" onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onEnter(); }}>
      <SearchableDropdown
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Search or type a name…"
        compact
        onQueryChange={setQuery}
        // A typed name with no match is still usable — apply it verbatim.
        onAddNew={(text) => onChange(text)}
        addNewLabel="Use typed name"
        // Free-typed names aren't in `options`; show the current value.
        selectedLabel={value}
      />
    </div>
  );
}
