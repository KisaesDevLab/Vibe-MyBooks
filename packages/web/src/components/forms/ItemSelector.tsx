// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useItems } from '../../api/hooks/useItems';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchableDropdown, type DropdownOption } from './SearchableDropdown';

export interface ItemSelection {
  id: string;
  name: string;
  description: string | null;
  unitPrice: string | null;
  incomeAccountId: string;
  isTaxable: boolean;
}

interface ItemSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: ItemSelection | null) => void;
  label?: string;
  required?: boolean;
  compact?: boolean;
  onAddNew?: (searchText: string) => void;
}

export function ItemSelector({ value, onChange, onSelect, label, required, compact, onAddNew }: ItemSelectorProps) {
  // Server-side search-as-you-type — the one-shot 200 cap made items
  // past the first page unfindable (same truncation class as the
  // ContactSelector vendor bug).
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const { data } = useItems({ isActive: true, limit: 500, offset: 0, search: debouncedQuery || undefined });
  const items = data?.data || [];

  const options: DropdownOption[] = items.map((item) => ({
    id: item.id,
    label: item.name,
    sublabel: item.unitPrice ? `$${parseFloat(item.unitPrice).toFixed(2)}` : undefined,
  }));

  const handleChange = (id: string) => {
    onChange(id);
    if (onSelect) {
      if (!id) { onSelect(null); return; }
      const item = items.find((i) => i.id === id);
      if (item) {
        onSelect({
          id: item.id,
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
          incomeAccountId: item.incomeAccountId,
          isTaxable: item.isTaxable,
        });
      }
    }
  };

  return (
    <SearchableDropdown
      value={value}
      onChange={handleChange}
      options={options}
      placeholder="Search items..."
      label={label}
      required={required}
      compact={compact}
      onAddNew={onAddNew}
      addNewLabel="Add new item..."
      onQueryChange={setQuery}
    />
  );
}
