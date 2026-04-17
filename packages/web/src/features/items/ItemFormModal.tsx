// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type FormEvent } from 'react';
import type { Item } from '@kis-books/shared';
import { useCreateItem, useUpdateItem } from '../../api/hooks/useItems';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { X } from 'lucide-react';

interface ItemFormModalProps {
  item?: Item | null;
  onClose: () => void;
}

export function ItemFormModal({ item, onClose }: ItemFormModalProps) {
  const isEdit = !!item;

  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice || '');
  const [incomeAccountId, setIncomeAccountId] = useState(item?.incomeAccountId || '');
  const [isTaxable, setIsTaxable] = useState(item?.isTaxable ?? false);

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload = {
      name,
      description: description || null,
      unitPrice: unitPrice || null,
      incomeAccountId,
      isTaxable,
    };

    if (isEdit) {
      updateItem.mutate({ id: item.id, ...payload }, { onSuccess: onClose });
    } else {
      createItem.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = createItem.isPending || updateItem.isPending;
  const error = createItem.error || updateItem.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Item' : 'New Item'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <MoneyInput
            label="Unit Price"
            value={unitPrice}
            onChange={setUnitPrice}
          />

          <AccountSelector
            label="Income Account"
            value={incomeAccountId}
            onChange={setIncomeAccountId}
            accountTypeFilter="revenue"
            required
          />

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isTaxable}
                onChange={(e) => setIsTaxable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
            </label>
            <span className="text-sm font-medium text-gray-700">Taxable</span>
          </div>

          {error && <p className="text-sm text-red-600">{error.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isPending}>
              {isEdit ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
