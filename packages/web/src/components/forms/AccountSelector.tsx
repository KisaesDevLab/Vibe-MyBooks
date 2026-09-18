// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Account, AccountType } from '@kis-books/shared';
import { ACCOUNT_TYPES, formatAccountTypeLabel } from '@kis-books/shared';
import { X } from 'lucide-react';
import { useAccounts, useCreateAccount } from '../../api/hooks/useAccounts';
import { useCompanySettings } from '../../api/hooks/useCompany';
import { useMe } from '../../api/hooks/useAuth';
import { useFirms } from '../../api/hooks/useFirms';
import { useDetailTypes } from '../../api/hooks/useDetailTypes';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { isFirmOnlyEligible } from '../../hooks/usePracticeVisibility';
import { SearchableDropdown, type DropdownOption } from './SearchableDropdown';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

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

  // "+ Add" is for the firm keeping these books (firm member or super
  // admin — the same line as the Practice surfaces). The API also admits
  // anyone with Chart of Accounts write access; this only decides who is
  // offered the shortcut.
  const { data: meData } = useMe();
  const { data: firmsData } = useFirms();
  const canQuickAdd = isFirmOnlyEligible(meData?.user?.isSuperAdmin === true, (firmsData?.firms ?? []).length > 0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  // Types offered in the quick-add form: the dropdown's own filter when it
  // is in force, so the new account is always selectable where it was made.
  const allowedTypes: readonly AccountType[] = applyFilter
    ? (Array.isArray(accountTypeFilter) ? accountTypeFilter : [accountTypeFilter as AccountType])
    : ACCOUNT_TYPES;

  const handleCreated = (account: Account) => {
    setShowAddModal(false);
    setPrefillName('');
    onChange(account.id);
  };

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
    <>
      <SearchableDropdown
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Search accounts..."
        label={label}
        required={required}
        compact={compact}
        onAddNew={canQuickAdd ? (text) => { setPrefillName(text); setShowAddModal(true); } : undefined}
        onQueryChange={setQuery}
        onNavigate={onNavigate}
        dataCell={dataCell}
      />
      {showAddModal && (
        <QuickAddAccountModal
          prefillName={prefillName}
          allowedTypes={allowedTypes}
          onCreated={handleCreated}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
}

// ─── Quick Add Account Modal ─────────────────────────────────────

interface QuickAddAccountModalProps {
  prefillName: string;
  allowedTypes: readonly AccountType[];
  onCreated: (account: Account) => void;
  onClose: () => void;
}

function QuickAddAccountModal({ prefillName, allowedTypes, onCreated, onClose }: QuickAddAccountModalProps) {
  const [name, setName] = useState(prefillName);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(allowedTypes[0] ?? 'expense');
  const [detailType, setDetailType] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { optionsFor } = useDetailTypes();
  const detailTypes = optionsFor(accountType);
  const createAccount = useCreateAccount();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // The selector usually sits inside a page-level <form>; React events
    // bubble through the React tree even across the portal, so stop the
    // outer form from submitting (same trap as QuickAddContactModal).
    e.stopPropagation();
    if (!name.trim()) {
      setLocalError('Account name is required.');
      return;
    }
    setLocalError(null);
    createAccount.mutate({
      name: name.trim(),
      accountNumber: accountNumber.trim() || null,
      accountType,
      detailType: detailType || null,
    }, {
      onSuccess: (data) => onCreated(data.account),
    });
  };

  // Portaled to <body> so this <form> is never nested in the page's form.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Quick Add Account</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 overflow-y-auto">
          <Input
            id="qa-account-name"
            label="Account Name"
            value={name}
            onChange={(e) => { setName(e.target.value); if (localError) setLocalError(null); }}
            required
            autoFocus
          />
          <Input
            id="qa-account-number"
            label="Account Number (optional)"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <div>
            <label htmlFor="qa-account-type" className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              id="qa-account-type"
              value={accountType}
              onChange={(e) => { setAccountType(e.target.value as AccountType); setDetailType(''); }}
              disabled={allowedTypes.length === 1}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
            >
              {allowedTypes.map((t) => (
                <option key={t} value={t}>{formatAccountTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qa-detail-type" className="block text-sm font-medium text-gray-700 mb-1">Detail Type</label>
            <select
              id="qa-detail-type"
              value={detailType}
              onChange={(e) => setDetailType(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {detailTypes.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          {(localError || createAccount.error) && (
            <p className="text-sm text-red-600">{localError || createAccount.error?.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createAccount.isPending}>Add Account</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
