// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useEffect, useState } from 'react';
import type { CompanyOptionDTO } from '@kis-books/shared';
import { useCompanyOptions } from '../../../api/hooks/useTaxEstimatorTaxpayers';

const DEBOUNCE_MS = 250;

export const optionLabel = (o: Pick<CompanyOptionDTO, 'tenantName' | 'companyName'>) => `${o.tenantName} — ${o.companyName}`;

/**
 * Company picker that searches ACROSS the firm's managed tenants (MODULE.md D1).
 * The server returns only tenants inside the caller's scope; each option is
 * labelled "Client — Company".
 */
export function CompanyPicker({ value, onSelect, disabled }: {
  value: { tenantName: string; companyName: string } | null;
  onSelect: (o: CompanyOptionDTO) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);
  const { data, isLoading, isError, refetch } = useCompanyOptions(q, open);

  return (
    <div className="relative">
      <label htmlFor="company-picker" className="block text-sm font-medium text-gray-700 mb-1">Client company</label>
      <input
        id="company-picker" type="text" role="combobox" aria-expanded={open} aria-controls="company-picker-list"
        autoComplete="off" disabled={disabled} placeholder="Search clients and companies"
        value={open ? text : (value ? optionLabel(value) : text)}
        onFocus={() => { setOpen(true); setText(''); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {open && (
        <div id="company-picker-list" role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {isLoading && <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>}
          {isError && (
            <p className="px-3 py-2 text-sm text-red-600">
              Could not load companies. <button type="button" className="underline" onClick={() => refetch()}>Retry</button>
            </p>
          )}
          {!isLoading && !isError && data && data.data.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">No matching companies in the clients your firm manages.</p>
          )}
          {data?.data.map((o) => (
            <button key={`${o.tenantId}:${o.companyId}`} type="button" role="option" aria-selected={false}
              onClick={() => { onSelect(o); setOpen(false); setText(''); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
              <span className="font-medium text-gray-900">{optionLabel(o)}</span>
              <span className="ml-2 text-xs text-gray-500">{o.returnForm ? `Form ${o.returnForm}` : o.entityType.replace(/_/g, ' ')}</span>
            </button>
          ))}
          {data && data.total > data.data.length && (
            <p className="px-3 py-2 text-xs text-gray-500">Showing {data.data.length} of {data.total}. Keep typing to narrow the list.</p>
          )}
          <button type="button" className="block w-full text-left px-3 py-2 text-xs text-gray-500 border-t" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}
