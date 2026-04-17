// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ContactType } from '@kis-books/shared';
import { useContacts, useDeactivateContact, useExportContacts } from '../../api/hooks/useContacts';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ContactImportModal } from './ContactImportModal';
import { MergeContactsModal } from './MergeContactsModal';
import { Plus, Upload, Download, Merge, Search } from 'lucide-react';

const tabs: { label: string; value: ContactType | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Customers', value: 'customer' },
  { label: 'Vendors', value: 'vendor' },
];

export function ContactsListPage() {
  const navigate = useNavigate();
  const [typeTab, setTypeTab] = useState<ContactType | ''>('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(true);
  const [showImport, setShowImport] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  const filters = {
    contactType: typeTab || undefined,
    isActive: activeFilter,
    search: search || undefined,
    limit: 100,
    offset: 0,
  };

  const { data, isLoading, isError, refetch } = useContacts(filters);
  const deactivateContact = useDeactivateContact();
  const exportContacts = useExportContacts();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const contacts = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportContacts.mutate(typeTab || undefined)}
            disabled={exportContacts.isPending}
          >
            <Download className="h-4 w-4 mr-1" /> {exportContacts.isPending ? 'Exporting…' : 'Export'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowMerge(true)}>
            <Merge className="h-4 w-4 mr-1" /> Merge
          </Button>
          <Button size="sm" onClick={() => navigate('/contacts/new')}>
            <Plus className="h-4 w-4 mr-1" /> New Contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTypeTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              typeTab === tab.value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={activeFilter === undefined ? 'all' : activeFilter ? 'active' : 'inactive'}
          onChange={(e) => setActiveFilter(e.target.value === 'all' ? undefined : e.target.value === 'active')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      {contacts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No contacts found. Add your first customer or vendor.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{contact.displayName}</td>
                  <td className="px-6 py-3 text-sm text-gray-500 capitalize">{contact.contactType}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{contact.email || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{contact.phone || '—'}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${contact.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {contact.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {contact.isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deactivateContact.mutate(contact.id); }}
                        disabled={deactivateContact.isPending && deactivateContact.variables === contact.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-2">{data?.total ?? 0} contacts</p>

      {showImport && <ContactImportModal defaultType={typeTab === 'vendor' ? 'vendor' : 'customer'} onClose={() => setShowImport(false)} />}
      {showMerge && <MergeContactsModal contacts={contacts} onClose={() => setShowMerge(false)} />}
    </div>
  );
}
