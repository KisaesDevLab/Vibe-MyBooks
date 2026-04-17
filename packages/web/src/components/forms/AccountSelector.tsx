// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { AccountType } from '@kis-books/shared';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useCompanySettings } from '../../api/hooks/useCompany';
import { SearchableDropdown, type DropdownOption } from './SearchableDropdown';

interface AccountSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  accountTypeFilter?: AccountType | AccountType[];
  required?: boolean;
  compact?: boolean;
}

export function AccountSelector({ value, onChange, label, accountTypeFilter, required, compact }: AccountSelectorProps) {
  const { data } = useAccounts({ isActive: true, limit: 200, offset: 0 });
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
    label: a.accountNumber ? `${a.accountNumber} — ${a.name}` : a.name,
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
    />
  );
}
