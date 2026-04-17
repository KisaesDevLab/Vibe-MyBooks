// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { useCompany, useUpdateCompany, useUploadLogo } from '../../api/hooks/useCompany';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { entityTypes } from '@kis-books/shared';
import type { EntityType } from '@kis-books/shared';

export function CompanyProfilePage() {
  const { data, isLoading, isError, refetch } = useCompany();
  const updateCompany = useUpdateCompany();
  const uploadLogo = useUploadLogo();

  const [form, setForm] = useState({
    businessName: '',
    legalName: '',
    ein: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    phone: '',
    email: '',
    website: '',
    industry: '',
    entityType: 'sole_prop' as string,
  });

  useEffect(() => {
    if (data?.company) {
      const c = data.company;
      setForm({
        businessName: c.businessName || '',
        legalName: c.legalName || '',
        ein: c.ein || '',
        addressLine1: c.addressLine1 || '',
        addressLine2: c.addressLine2 || '',
        city: c.city || '',
        state: c.state || '',
        zip: c.zip || '',
        country: c.country || 'US',
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        industry: c.industry || '',
        entityType: c.entityType || 'sole_prop',
      });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateCompany.mutate({
      ...form,
      entityType: form.entityType as EntityType,
      legalName: form.legalName || null,
      ein: form.ein || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      industry: form.industry || null,
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo.mutate(file);
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Company Profile</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Business Information</h2>
          <Input label="Business Name" value={form.businessName} onChange={set('businessName')} required />
          <Input label="Legal Name" value={form.legalName} onChange={set('legalName')} />
          <Input label="EIN" value={form.ein} onChange={set('ein')} placeholder="XX-XXXXXXX" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select value={form.entityType} onChange={set('entityType')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {entityTypes.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <Input label="Industry" value={form.industry} onChange={set('industry')} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Address</h2>
          <Input label="Address Line 1" value={form.addressLine1} onChange={set('addressLine1')} />
          <Input label="Address Line 2" value={form.addressLine2} onChange={set('addressLine2')} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" value={form.city} onChange={set('city')} />
            <Input label="State" value={form.state} onChange={set('state')} />
            <Input label="ZIP" value={form.zip} onChange={set('zip')} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Contact</h2>
          <Input label="Phone" value={form.phone} onChange={set('phone')} type="tel" />
          <Input label="Email" value={form.email} onChange={set('email')} type="email" />
          <Input label="Website" value={form.website} onChange={set('website')} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Logo</h2>
          {data?.company.logoUrl && (
            <img src={data.company.logoUrl} alt="Company logo" className="h-16 w-16 object-contain rounded" />
          )}
          <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm" />
        </div>

        {/* API & MCP Access */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">API & MCP Access</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={(data?.company as any)?.mcpEnabled ?? false}
              onChange={async (e) => {
                updateCompany.mutate({ mcpEnabled: e.target.checked } as any);
              }}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-5 w-5" />
            <div>
              <span className="text-sm font-medium text-gray-700">Allow API & MCP access to this company</span>
              <p className="text-xs text-gray-500">When disabled, all API keys and MCP calls targeting this company will be rejected.</p>
            </div>
          </label>
        </div>

        {updateCompany.error && <p className="text-sm text-red-600">{updateCompany.error.message}</p>}
        {updateCompany.isSuccess && <p className="text-sm text-green-600">Saved successfully</p>}

        <Button type="submit" loading={updateCompany.isPending}>Save Changes</Button>
      </form>
    </div>
  );
}
