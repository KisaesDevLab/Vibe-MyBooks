// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import type { Account, AccountType, CreateAccountInput, UpdateAccountInput } from '@kis-books/shared';
import { ACCOUNT_TYPES, DETAIL_TYPES, formatAccountTypeLabel } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useCreateAccount, useUpdateAccount } from '../../api/hooks/useAccounts';
import { X } from 'lucide-react';

interface AccountFormModalProps {
  account?: Account | null;
  onClose: () => void;
}

export function AccountFormModal({ account, onClose }: AccountFormModalProps) {
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const isEdit = !!account;

  const [form, setForm] = useState({
    name: '',
    accountNumber: '',
    accountType: 'asset' as AccountType,
    detailType: '',
    description: '',
  });

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
        accountNumber: account.accountNumber || '',
        accountType: account.accountType as AccountType,
        detailType: account.detailType || '',
        description: account.description || '',
      });
    }
  }, [account]);

  const detailTypes = DETAIL_TYPES[form.accountType] || [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      name: form.name,
      accountNumber: form.accountNumber || null,
      accountType: form.accountType,
      detailType: form.detailType || null,
      description: form.description || null,
    };

    if (isEdit) {
      updateAccount.mutate({ id: account.id, ...input }, { onSuccess: onClose });
    } else {
      createAccount.mutate(input as CreateAccountInput, { onSuccess: onClose });
    }
  };

  const error = createAccount.error || updateAccount.error;
  const isPending = createAccount.isPending || updateAccount.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Account' : 'New Account'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {account?.isSystem && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
              System account — some fields are restricted.
            </div>
          )}

          <Input label="Account Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Account Number (optional)" value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              value={form.accountType}
              onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value as AccountType, detailType: '' }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={account?.isSystem}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{formatAccountTypeLabel(t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detail Type</label>
            <select
              value={form.detailType}
              onChange={(e) => setForm((f) => ({ ...f, detailType: e.target.value }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {detailTypes.map((dt) => (
                <option key={dt} value={dt}>{dt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isPending}>{isEdit ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
