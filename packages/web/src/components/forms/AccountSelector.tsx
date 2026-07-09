// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { AccountType } from '@kis-books/shared';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useCompanySettings } from '../../api/hooks/useCompany';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchableDropdown, type DropdownOption } from './SearchableDropdown';

interface AccountSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  accountTypeFilter?: AccountType | AccountType[];
  required?: boolean;
  compact?: boolean;
  // Grid navigation passthrough (see SearchableDropdown).
  onNavigate?: (dir: 'next' | 'prev') => void;
  dataCell?: string;
}

export function AccountSelector({ value, onChange, label, accountTypeFilter, required, compact, onNavigate, dataCell }: AccountSelectorProps) {
  // 500 + server-side search-as-you-type: the previous one-shot 200 cap
  // made accounts past the first page unfindable in large COAs (same
  // truncation class as the ContactSelector vendor bug).
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const { data } = useAccounts({ isActive: true, limit: 500, offset: 0, search: debouncedQuery || undefined });
  const { data: settingsData } = useCompanySettings();
  const accounts = data?.data || [];

  // If company setting is 'all', ignore the type filter and show everything
  const categoryMode = settingsData?.settings?.categoryFilterMode || 'by_type';
  const applyFilter = categoryMode === 'by_type' && accountTypeFilter;

  const filtered = applyFilter
    ? accounts.filter((a) => Array.isArray(accountTypeFilter) ? accountTypeFilter.includes(a.accountType as AccountType) : a.accountType === accountTypeFilter)
    : accounts;

  const options: DropdownOption[] = filtered.map((a) => ({
    id: a.id,
    // Selected-input display + search haystack (number and full name).
    label: a.accountNumber ? `${a.accountNumber} — ${a.name}` : a.name,
    // Two-line list: number + type on line 1, the account name on line 2, so
    // long names stay legible instead of truncating next to the type badge.
    title: a.accountNumber || a.name,
    description: a.accountNumber ? a.name : undefined,
    sublabel: a.accountType,
  }));

  return (
    <SearchableDropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Search accounts..."
      label={label}
      required={required}
      compact={compact}
      onQueryChange={setQuery}
      onNavigate={onNavigate}
      dataCell={dataCell}
    />
  );
}
