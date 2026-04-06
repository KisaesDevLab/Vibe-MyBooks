import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ContactType } from '@kis-books/shared';
import { useContact, useCreateContact, useUpdateContact } from '../../api/hooks/useContacts';
import { Input } from '../../components/ui/Input';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const contactTypes: { value: ContactType; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'both', label: 'Both' },
];

export function ContactFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const { data: existing, isLoading } = useContact(isEdit ? id : '');
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const [form, setForm] = useState({
    contactType: 'customer' as ContactType,
    displayName: '',
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    billingLine1: '',
    billingLine2: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    shippingLine1: '',
    shippingLine2: '',
    shippingCity: '',
    shippingState: '',
    shippingZip: '',
    defaultPaymentTerms: '',
    defaultExpenseAccountId: '',
    taxId: '',
    is1099Eligible: false,
    notes: '',
  });

  useEffect(() => {
    if (existing?.contact) {
      const c = existing.contact;
      setForm({
        contactType: c.contactType as ContactType,
        displayName: c.displayName || '',
        companyName: c.companyName || '',
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email || '',
        phone: c.phone || '',
        billingLine1: c.billingLine1 || '',
        billingLine2: c.billingLine2 || '',
        billingCity: c.billingCity || '',
        billingState: c.billingState || '',
        billingZip: c.billingZip || '',
        shippingLine1: c.shippingLine1 || '',
        shippingLine2: c.shippingLine2 || '',
        shippingCity: c.shippingCity || '',
        shippingState: c.shippingState || '',
        shippingZip: c.shippingZip || '',
        defaultPaymentTerms: c.defaultPaymentTerms || '',
        defaultExpenseAccountId: c.defaultExpenseAccountId || '',
        taxId: c.taxId || '',
        is1099Eligible: c.is1099Eligible ?? false,
        notes: c.notes || '',
      });
    }
  }, [existing]);

  if (isEdit && isLoading) return <LoadingSpinner className="py-12" />;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      ...form,
      companyName: form.companyName || null,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      email: form.email || null,
      phone: form.phone || null,
      billingLine1: form.billingLine1 || null,
      billingLine2: form.billingLine2 || null,
      billingCity: form.billingCity || null,
      billingState: form.billingState || null,
      billingZip: form.billingZip || null,
      shippingLine1: form.shippingLine1 || null,
      shippingLine2: form.shippingLine2 || null,
      shippingCity: form.shippingCity || null,
      shippingState: form.shippingState || null,
      shippingZip: form.shippingZip || null,
      defaultPaymentTerms: form.defaultPaymentTerms || null,
      defaultExpenseAccountId: form.defaultExpenseAccountId || null,
      taxId: form.taxId || null,
      notes: form.notes || null,
    };

    if (isEdit) {
      updateContact.mutate({ id, ...input }, { onSuccess: () => navigate(`/contacts/${id}`) });
    } else {
      createContact.mutate(input, { onSuccess: (data) => navigate(`/contacts/${data.contact.id}`) });
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const error = createContact.error || updateContact.error;
  const isPending = createContact.isPending || updateContact.isPending;
  const showCustomerFields = form.contactType === 'customer' || form.contactType === 'both';
  const showVendorFields = form.contactType === 'vendor' || form.contactType === 'both';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Contact' : 'New Contact'}</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Type</label>
            <select value={form.contactType} onChange={set('contactType')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {contactTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input label="Display Name" value={form.displayName} onChange={set('displayName')} required />
          <Input label="Company Name" value={form.companyName} onChange={set('companyName')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} />
            <Input label="Last Name" value={form.lastName} onChange={set('lastName')} />
          </div>
          <Input label="Email" value={form.email} onChange={set('email')} type="email" />
          <Input label="Phone" value={form.phone} onChange={set('phone')} type="tel" />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Billing Address</h2>
          <Input label="Address Line 1" value={form.billingLine1} onChange={set('billingLine1')} />
          <Input label="Address Line 2" value={form.billingLine2} onChange={set('billingLine2')} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" value={form.billingCity} onChange={set('billingCity')} />
            <Input label="State" value={form.billingState} onChange={set('billingState')} />
            <Input label="ZIP" value={form.billingZip} onChange={set('billingZip')} />
          </div>
        </div>

        {showCustomerFields && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Shipping Address</h2>
              <Input label="Address Line 1" value={form.shippingLine1} onChange={set('shippingLine1')} />
              <Input label="Address Line 2" value={form.shippingLine2} onChange={set('shippingLine2')} />
              <div className="grid grid-cols-3 gap-4">
                <Input label="City" value={form.shippingCity} onChange={set('shippingCity')} />
                <Input label="State" value={form.shippingState} onChange={set('shippingState')} />
                <Input label="ZIP" value={form.shippingZip} onChange={set('shippingZip')} />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Customer Settings</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
                <select value={form.defaultPaymentTerms} onChange={set('defaultPaymentTerms')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">— Use company default —</option>
                  <option value="due_on_receipt">Due On Receipt</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                  <option value="net_60">Net 60</option>
                  <option value="net_90">Net 90</option>
                </select>
              </div>
            </div>
          </>
        )}

        {showVendorFields && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Vendor Settings</h2>
            <AccountSelector
              label="Default Expense Category"
              value={form.defaultExpenseAccountId}
              onChange={(v) => setForm((f) => ({ ...f, defaultExpenseAccountId: v }))}
              accountTypeFilter="expense"
            />
            <Input label="Tax ID / EIN" value={form.taxId} onChange={set('taxId')} placeholder="XX-XXXXXXX" />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is1099Eligible}
                onChange={(e) => setForm((f) => ({ ...f, is1099Eligible: e.target.checked }))}
                className="rounded border-gray-300"
              />
              1099 Eligible
            </label>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Notes</h2>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={4}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={isPending}>{isEdit ? 'Save Changes' : 'Create Contact'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/contacts')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
