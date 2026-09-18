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
import { AccountSelector } from './AccountSelector';
import { LineTagPicker } from './SplitRowV2';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
          defaultType={contactTypeFilter || 'vendor'}
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
  // "More details" — the fields that otherwise send people to the full
  // contact page right after a quick add: the mailing address (what Write
  // Check prints), and for vendors the default category + tag the forms
  // auto-fill from. Collapsed by default so the quick path stays quick.
  const [showMore, setShowMore] = useState(false);
  const [billing, setBilling] = useState({ line1: '', line2: '', city: '', state: '', zip: '' });
  const [shipping, setShipping] = useState({ line1: '', line2: '', city: '', state: '', zip: '' });
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [defaultExpenseAccountId, setDefaultExpenseAccountId] = useState('');
  const [defaultTagId, setDefaultTagId] = useState<string | null>(null);

  const isVendorish = contactType === 'vendor' || contactType === 'both';
  const isCustomerish = contactType === 'customer' || contactType === 'both';

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
    const ship = isCustomerish ? (shippingSameAsBilling ? billing : shipping) : null;
    createContact.mutate({
      contactType,
      displayName: displayName.trim(),
      companyName: companyName || null,
      email: email || null,
      phone: phone || null,
      billingLine1: billing.line1 || null,
      billingLine2: billing.line2 || null,
      billingCity: billing.city || null,
      billingState: billing.state || null,
      billingZip: billing.zip || null,
      shippingLine1: ship?.line1 || null,
      shippingLine2: ship?.line2 || null,
      shippingCity: ship?.city || null,
      shippingState: ship?.state || null,
      shippingZip: ship?.zip || null,
      // Vendor defaults only mean something on a vendor; never send them for
      // a plain customer even if the user toggled the type after filling them.
      defaultExpenseAccountId: isVendorish && defaultExpenseAccountId ? defaultExpenseAccountId : null,
      defaultTagId: isVendorish ? defaultTagId : null,
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
      <div className={`bg-white rounded-lg shadow-xl w-full mx-4 max-h-[90vh] flex flex-col ${showMore ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Quick Add Contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 overflow-y-auto">
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
            id="qa-display-name"
            label="Display Name"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); if (localError) setLocalError(null); }}
            required
            autoFocus
          />
          <Input
            id="qa-company-name"
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="qa-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="qa-phone"
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
          >
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showMore ? 'Fewer details' : 'More details'}
            {!showMore && (
              <span className="font-normal text-gray-500"> — address{isVendorish ? ', default category' : ''}</span>
            )}
          </button>

          {showMore && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-800">
                  {isCustomerish ? 'Billing address' : 'Mailing address'}
                </legend>
                <Input id="qa-billing-line1" label="Address Line 1" value={billing.line1} onChange={(e) => setBilling((b) => ({ ...b, line1: e.target.value }))} />
                <Input id="qa-billing-line2" label="Address Line 2" value={billing.line2} onChange={(e) => setBilling((b) => ({ ...b, line2: e.target.value }))} />
                <div className="grid grid-cols-3 gap-3">
                  <Input id="qa-billing-city" label="City" value={billing.city} onChange={(e) => setBilling((b) => ({ ...b, city: e.target.value }))} />
                  <Input id="qa-billing-state" label="State" value={billing.state} onChange={(e) => setBilling((b) => ({ ...b, state: e.target.value }))} />
                  <Input id="qa-billing-zip" label="ZIP" value={billing.zip} onChange={(e) => setBilling((b) => ({ ...b, zip: e.target.value }))} />
                </div>
                {isVendorish && (
                  <p className="text-xs text-gray-500">Prints on the mailing panel of checks and on envelopes.</p>
                )}
              </fieldset>

              {isCustomerish && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-gray-800">Shipping address</legend>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={shippingSameAsBilling}
                      onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Same as billing
                  </label>
                  {!shippingSameAsBilling && (
                    <>
                      <Input id="qa-shipping-line1" label="Address Line 1" value={shipping.line1} onChange={(e) => setShipping((v) => ({ ...v, line1: e.target.value }))} />
                      <Input id="qa-shipping-line2" label="Address Line 2" value={shipping.line2} onChange={(e) => setShipping((v) => ({ ...v, line2: e.target.value }))} />
                      <div className="grid grid-cols-3 gap-3">
                        <Input id="qa-shipping-city" label="City" value={shipping.city} onChange={(e) => setShipping((v) => ({ ...v, city: e.target.value }))} />
                        <Input id="qa-shipping-state" label="State" value={shipping.state} onChange={(e) => setShipping((v) => ({ ...v, state: e.target.value }))} />
                        <Input id="qa-shipping-zip" label="ZIP" value={shipping.zip} onChange={(e) => setShipping((v) => ({ ...v, zip: e.target.value }))} />
                      </div>
                    </>
                  )}
                </fieldset>
              )}

              {isVendorish && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-gray-800">Vendor defaults</legend>
                  <AccountSelector
                    label="Default Expense Category"
                    value={defaultExpenseAccountId}
                    onChange={setDefaultExpenseAccountId}
                    accountTypeFilter="expense"
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Default Tag</label>
                    <LineTagPicker value={defaultTagId} onChange={setDefaultTagId} />
                  </div>
                  <p className="text-xs text-gray-500">
                    New checks, bills and expenses for this vendor start with this category and tag.
                  </p>
                </fieldset>
              )}
            </div>
          )}

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
