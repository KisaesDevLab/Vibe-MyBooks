// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ACCOUNT_TYPES,
  formatAccountTypeLabel,
  type AccountType,
  type CustomDetailType,
} from '@kis-books/shared';
import { useDetailTypes, useCreateDetailType, useDeleteDetailType, useUpdateDetailType } from '../../api/hooks/useDetailTypes';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { useToast } from '../../components/ui/Toaster';

// Derive a snake_case slug from a label as the user types, so most
// people never touch the slug field: 'Equipment Leases' → 'equipment_leases'.
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function DetailTypesPage() {
  const { custom, isLoading, isError, refetch } = useDetailTypes();
  const createDetailType = useCreateDetailType();
  const deleteDetailType = useDeleteDetailType();
  const updateDetailType = useUpdateDetailType();
  const [reordering, setReordering] = useState(false);
  const toast = useToast();

  const [accountType, setAccountType] = useState<AccountType>('expense');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [valueTouched, setValueTouched] = useState(false);

  const effectiveValue = valueTouched ? value : slugify(label);
  const valueValid = /^[a-z0-9_]{2,50}$/.test(effectiveValue);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !valueValid) return;
    createDetailType.mutate(
      { accountType, value: effectiveValue, label: label.trim() },
      {
        onSuccess: () => {
          setLabel('');
          setValue('');
          setValueTouched(false);
          toast.success('Detail type added');
        },
        onError: (err: Error) => toast.error('Could not add detail type', { detail: err.message }),
      },
    );
  };

  const handleDelete = (id: string, delLabel: string) => {
    deleteDetailType.mutate(id, {
      onSuccess: () => toast.success(`Deleted '${delLabel}'`),
      onError: (err: Error) => toast.error('Could not delete detail type', { detail: err.message }),
    });
  };

  // Move a row up/down WITHIN its account-type segment (reports group
  // per account type, so cross-type order is meaningless). The server
  // returns `custom` in presentation order (sort_order NULLS LAST,
  // label), so the displayed order is the source of truth: swap in the
  // segment, then persist index positions for every row whose stored
  // sortOrder differs — this also normalizes legacy NULLs the first
  // time a segment is reordered.
  const handleMove = async (dt: CustomDetailType, direction: -1 | 1) => {
    const segment = custom.filter((c) => c.accountType === dt.accountType);
    const idx = segment.findIndex((c) => c.id === dt.id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= segment.length) return;
    const next = [...segment];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setReordering(true);
    try {
      for (let i = 0; i < next.length; i++) {
        if (next[i]!.sortOrder !== i) {
          await updateDetailType.mutateAsync({ id: next[i]!.id, sortOrder: i });
        }
      }
    } catch (err) {
      toast.error('Could not reorder detail types', { detail: (err as Error).message });
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Detail Types</h1>
      <p className="text-sm text-gray-500 mb-6">
        Add custom detail types to the built-in list. They appear in the account form dropdowns
        and in report grouping. A detail type in use by an account cannot be deleted.
      </p>

      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add a detail type</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{formatAccountTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          <Input
            label="Display Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
            placeholder="e.g. Equipment Leases"
            required
          />
          <div>
            <Input
              label="Value (slug)"
              value={effectiveValue}
              onChange={(e) => { setValueTouched(true); setValue(e.target.value); }}
              maxLength={50}
              placeholder="equipment_leases"
            />
            <p className={`text-xs mt-1 ${effectiveValue && !valueValid ? 'text-red-600' : 'text-gray-500'}`}>
              2–50 lowercase letters, digits, or underscores. Stored on accounts — cannot be renamed later.
            </p>
          </div>
          <Button type="submit" loading={createDetailType.isPending} disabled={!label.trim() || !valueValid}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </form>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Custom detail types</h2>
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : isError ? (
          <ErrorMessage onRetry={refetch} />
        ) : custom.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No custom detail types yet. Add one above — it will show up alongside the built-ins.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Use the arrows to set the presentation order. Grouped reports (P&amp;L, Balance Sheet)
              show custom detail-type groups in this order, after the built-in groups.
            </p>
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 pr-2 font-medium w-16">Order</th>
                  <th className="py-2 pr-4 font-medium">Account Type</th>
                  <th className="py-2 pr-4 font-medium">Label</th>
                  <th className="py-2 pr-4 font-medium">Value</th>
                  <th className="py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {custom.map((dt) => {
                  const segment = custom.filter((c) => c.accountType === dt.accountType);
                  const segIdx = segment.findIndex((c) => c.id === dt.id);
                  return (
                    <tr key={dt.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMove(dt, -1)}
                            disabled={reordering || segIdx <= 0}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"
                            aria-label={`Move ${dt.label} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(dt, 1)}
                            disabled={reordering || segIdx >= segment.length - 1}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"
                            aria-label={`Move ${dt.label} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 pr-4">{formatAccountTypeLabel(dt.accountType)}</td>
                      <td className="py-2 pr-4">{dt.label}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500">{dt.value}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(dt.id, dt.label)}
                          disabled={deleteDetailType.isPending}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                          aria-label={`Delete ${dt.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
