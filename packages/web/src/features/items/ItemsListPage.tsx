// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { useItems, useDeactivateItem, useExportItems } from '../../api/hooks/useItems';
import type { ItemSortKey } from '@kis-books/shared';
import { SortableTh } from '../../components/ui/SortableTh';
import { useColumnView } from '../../hooks/useColumnView';
import { booleanSetToParam } from '../../utils/columnView';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Pagination } from '../../components/ui/Pagination';
import { ItemFormModal } from './ItemFormModal';
import { Plus, Download, Search } from 'lucide-react';
import type { Item } from '@kis-books/shared';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const PAGE_SIZE = 100;
const SORT_KEYS: readonly ItemSortKey[] = ['name', 'price', 'taxable', 'status'];
const STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];
const TAXABLE_OPTIONS = [{ value: 'yes', label: 'Taxable' }, { value: 'no', label: 'Not taxable' }];

export function ItemsListPage() {
  const [search, setSearchRaw] = useState('');
  // Sort + the Status / Taxable value filters in one persisted view; the
  // Status select and the header popover share the same entry.
  const view = useColumnView<ItemSortKey>('vibe:items:view', {
    sortKeys: SORT_KEYS, defaultFilters: { status: ['active'] },
  });
  const activeFilter = booleanSetToParam(view.filterFor('status'), { trueValue: 'active', falseValue: 'inactive' });
  const taxableFilter = booleanSetToParam(view.filterFor('taxable'), { trueValue: 'yes', falseValue: 'no' });
  const [offset, setOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);

  // Any filter change resets to page 1.
  const setSearch = (v: string) => { setSearchRaw(v); setOffset(0); };
  const setActiveFilter = (v: boolean | undefined) =>
    view.setFilter('status', new Set(v === undefined ? [] : [v ? 'active' : 'inactive']));
  useEffect(() => { setOffset(0); }, [view.signature]);

  // Debounced: the query fires once typing pauses, not per keystroke.
  const debouncedSearch = useDebouncedValue(search);

  const filters = {
    isActive: activeFilter,
    isTaxable: taxableFilter,
    search: debouncedSearch || undefined,
    sortBy: view.sortCol || undefined,
    sortDir: view.sortCol ? view.sortDir : undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError, refetch } = useItems(filters);
  const deactivateItem = useDeactivateItem();
  const exportItems = useExportItems();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const items = data?.data || [];

  const handleRowClick = (item: Item) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditItem(null);
  };

  const formatPrice = (price: string | null) => {
    if (!price) return '--';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const truncate = (text: string | null, maxLen: number) => {
    if (!text) return '--';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products & Services</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportItems.mutate()}
            disabled={exportItems.isPending}
          >
            <Download className="h-4 w-4 mr-1" /> {exportItems.isPending ? 'Exporting…' : 'Export'}
          </Button>
          <Button size="sm" onClick={() => { setEditItem(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Search items..."
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
      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No items found. Add your first product or service.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <SortableTh padding="px-6 py-3" label="Name" {...view.thProps('name')} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <SortableTh padding="px-6 py-3" label="Unit Price" align="right" {...view.thProps('price')} />
                <SortableTh padding="px-6 py-3" label="Taxable" align="center" {...view.thProps('taxable')} filter={view.filterProps('taxable', TAXABLE_OPTIONS, { ariaLabel: 'Filter Taxable' })} />
                <SortableTh padding="px-6 py-3" label="Status" align="center" {...view.thProps('status')} filter={view.filterProps('status', STATUS_OPTIONS, { ariaLabel: 'Filter Status' })} />
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(item)}
                >
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{truncate(item.description, 60)}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">{formatPrice(item.unitPrice)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.isTaxable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.isTaxable ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {item.isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deactivateItem.mutate(item.id); }}
                        disabled={deactivateItem.isPending && deactivateItem.variables === item.id}
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

      <Pagination
        total={data?.total ?? 0}
        limit={PAGE_SIZE}
        offset={offset}
        onChange={setOffset}
        unit="items"
      />

      {showForm && <ItemFormModal item={editItem} onClose={handleCloseForm} />}
    </div>
  );
}
