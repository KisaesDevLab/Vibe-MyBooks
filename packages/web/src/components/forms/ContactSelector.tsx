// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ContactType, Contact } from '@kis-books/shared';
import { useContacts, useContact, useCreateContact } from '../../api/hooks/useContacts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchableDropdown, type DropdownOption } from './SearchableDropdown';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X } from 'lucide-react';

export interface ContactSelection {
  id: string;
  displayName: string;
  contactType: string;
  defaultExpenseAccountId: string | null;
  // ADR 0XY — default tag, used by forms to re-run resolveDefaultTag
  // on untouched lines when the contact changes.
  defaultTagId: string | null;
}

interface ContactSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (contact: ContactSelection | null) => void;
  label?: string;
  contactTypeFilter?: ContactType;
  required?: boolean;
  compact?: boolean;
  // Grid navigation passthrough (see SearchableDropdown).
  onNavigate?: (dir: 'next' | 'prev') => void;
  dataCell?: string;
}

export function ContactSelector({ value, onChange, onSelect, label, contactTypeFilter, required, compact, onNavigate, dataCell }: ContactSelectorProps) {
  // Server-side search-as-you-type. A capped one-shot fetch meant any
  // contact past the first page could NEVER be found in this dropdown
  // (the type-to-filter only narrowed the loaded page) — the reported
  // "not all vendors show on Rules" bug.
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const { data, refetch } = useContacts({
    contactType: contactTypeFilter,
    isActive: true,
    limit: 200,
    offset: 0,
    search: debouncedQuery || undefined,
  });
  const contacts = data?.data || [];
  // The saved selection may live outside the current page/search — fetch
  // it individually so the closed input still shows its name.
  const inList = !value || contacts.some((c) => c.id === value);
  const { data: selectedData } = useContact(inList ? '' : value);
  const selectedContact = selectedData?.contact;
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillName, setPrefillName] = useState('');

  const options: DropdownOption[] = contacts.map((c) => ({
    id: c.id,
    label: c.displayName,
    sublabel: c.contactType,
  }));

  const handleChange = (id: string) => {
    onChange(id);
    if (onSelect) {
      if (!id) { onSelect(null); return; }
      const contact = contacts.find((c) => c.id === id);
      if (contact) {
        onSelect({
          id: contact.id,
          displayName: contact.displayName,
          contactType: contact.contactType,
          defaultExpenseAccountId: contact.defaultExpenseAccountId,
          defaultTagId: (contact as unknown as { defaultTagId?: string | null }).defaultTagId ?? null,
        });
      }
    }
  };

  const handleAddNew = (searchText: string) => {
    setPrefillName(searchText);
    setShowAddModal(true);
  };

  // Select the just-created contact directly from the mutation result — not by
  // re-finding it in a stale `contacts` list after refetch (which never
  // contained the new id, so onSelect/autofill silently never fired).
  const handleCreated = (contact: Contact) => {
    setShowAddModal(false);
    setPrefillName('');
    onChange(contact.id);
    if (onSelect) {
      onSelect({
        id: contact.id,
        displayName: contact.displayName,
        contactType: contact.contactType,
        defaultExpenseAccountId: contact.defaultExpenseAccountId,
        defaultTagId: (contact as unknown as { defaultTagId?: string | null }).defaultTagId ?? null,
      });
    }
    refetch(); // refresh the list so a subsequent search finds it
  };

  return (
    <>
      <SearchableDropdown
        value={value}
        onChange={handleChange}
        options={options}
        placeholder="Search contacts..."
        label={label}
        required={required}
        compact={compact}
        onAddNew={handleAddNew}
        onQueryChange={setQuery}
        selectedLabel={selectedContact?.displayName}
        onNavigate={onNavigate}
        dataCell={dataCell}
      />
      {showAddModal && (
        <QuickAddContactModal
          prefillName={prefillName}
          defaultType={contactTypeFilter || 'customer'}
          onCreated={handleCreated}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
}

// ─── Quick Add Contact Modal ─────────────────────────────────────

interface QuickAddContactModalProps {
  prefillName: string;
  defaultType: ContactType | string;
  onCreated: (contact: Contact) => void;
  onClose: () => void;
}

function QuickAddContactModal({ prefillName, defaultType, onCreated, onClose }: QuickAddContactModalProps) {
  const [contactType, setContactType] = useState<ContactType>(defaultType as ContactType);
  const [displayName, setDisplayName] = useState(prefillName);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const createContact = useCreateContact();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // CRITICAL: the selector (and so this modal) usually lives inside a
    // page-level <form> (Expense, Write Check, Enter Bill…). React
    // synthetic events bubble through the REACT tree — portal or not —
    // so without stopPropagation the outer form's onSubmit fires too,
    // submitting/navigating the whole page and losing the user's inputs.
    e.stopPropagation();
    // Surface an in-app error for a missing name instead of relying on the
    // browser's native `required` bubble, which blocks the submit silently and
    // reads as "clicked Add Contact but nothing happened".
    if (!displayName.trim()) {
      setLocalError('Display name is required.');
      return;
    }
    setLocalError(null);
    createContact.mutate({
      contactType,
      displayName: displayName.trim(),
      companyName: companyName || null,
      email: email || null,
      phone: phone || null,
    }, {
      onSuccess: (data) => onCreated(data.contact),
    });
  };

  // Portaled to <body>: a <form> nested in the page's <form> is invalid
  // HTML, and native submit behavior of nested forms is what made "Add
  // Contact" reload the page. (React-tree bubbling is handled separately
  // by stopPropagation in handleSubmit.)
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Quick Add Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Type</label>
            <div className="flex gap-2">
              {(['customer', 'vendor', 'both'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContactType(t)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    contactType === t
                      ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); if (localError) setLocalError(null); }}
            required
            autoFocus
          />
          <Input
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {(localError || createContact.error) && (
            <p className="text-sm text-red-600">{localError || createContact.error?.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createContact.isPending}>Add Contact</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
