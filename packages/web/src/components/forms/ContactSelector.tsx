// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type FormEvent } from 'react';
import type { ContactType } from '@kis-books/shared';
import { useContacts, useCreateContact } from '../../api/hooks/useContacts';
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
}

export function ContactSelector({ value, onChange, onSelect, label, contactTypeFilter, required, compact }: ContactSelectorProps) {
  const { data, refetch } = useContacts({ contactType: contactTypeFilter, isActive: true, limit: 200, offset: 0 });
  const contacts = data?.data || [];
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

  const handleCreated = (newId: string) => {
    setShowAddModal(false);
    setPrefillName('');
    refetch().then(() => handleChange(newId));
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
        addNewLabel={prefillName ? undefined : 'Add new contact...'}
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
  onCreated: (id: string) => void;
  onClose: () => void;
}

function QuickAddContactModal({ prefillName, defaultType, onCreated, onClose }: QuickAddContactModalProps) {
  const [contactType, setContactType] = useState<ContactType>(defaultType as ContactType);
  const [displayName, setDisplayName] = useState(prefillName);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const createContact = useCreateContact();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createContact.mutate({
      contactType,
      displayName,
      companyName: companyName || null,
      email: email || null,
      phone: phone || null,
    }, {
      onSuccess: (data) => onCreated(data.contact.id),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Quick Add Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            onChange={(e) => setDisplayName(e.target.value)}
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

          {createContact.error && (
            <p className="text-sm text-red-600">{createContact.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createContact.isPending}>Add Contact</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
