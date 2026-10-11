// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { EntitySettingsResponse, EntityTaxType, TaxMethod, UpsertEntitySettingsInput } from '@kis-books/shared';
import { ENTITY_TAX_TYPES, TAX_METHODS } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import {
  ENTITY_TYPE_LABELS, TAX_METHOD_LABELS, US_STATES, SELECT_CLASS, entityTypeSourceLabel, taxMethodSourceLabel,
} from './labels';

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600" data-testid="source-chip">{children}</span>
);

/** Resolved entity type / method with their source, override controls (secondary when a TB profile exists, D3) and the entity flags. */
export function SettingsPanel({ data, canWrite, saving, error, onSave }: {
  data: EntitySettingsResponse; canWrite: boolean; saving: boolean; error?: string;
  onSave: (input: UpsertEntitySettingsInput) => void;
}) {
  const { settings: s, resolved: r } = data;
  const [type, setType] = useState<EntityTaxType | ''>(s.taxEntityType ?? '');
  const [method, setMethod] = useState<TaxMethod | ''>(s.taxMethod ?? '');
  const [sstb, setSstb] = useState(s.isSstb);
  const [large, setLarge] = useState(s.largeCorporation);
  const [farmer, setFarmer] = useState<'' | 'yes' | 'no'>(s.farmerOverride == null ? '' : s.farmerOverride ? 'yes' : 'no');
  const [rental, setRental] = useState(s.rentalQbiTradeOrBusiness);
  const [state, setState] = useState(s.stateSourcing ?? '');
  const hasTb = r.entityTypeSource === 'tb_profile';

  const typeControl = (
    <label className="block text-sm text-gray-700">
      Entity type override
      <select aria-label="Entity type override" className={SELECT_CLASS} disabled={!canWrite} value={type}
        onChange={(e) => setType(e.target.value as EntityTaxType | '')}>
        <option value="">No override</option>
        {ENTITY_TAX_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
      </select>
    </label>
  );
  const methodControl = (
    <label className="block text-sm text-gray-700">
      Tax method override
      <select aria-label="Tax method override" className={SELECT_CLASS} disabled={!canWrite} value={method}
        onChange={(e) => setMethod(e.target.value as TaxMethod | '')}>
        <option value="">No override</option>
        {TAX_METHODS.map((m) => <option key={m} value={m}>{TAX_METHOD_LABELS[m]}</option>)}
      </select>
    </label>
  );
  const save = () => onSave({
    taxEntityType: type || null, taxMethod: method || null, isSstb: sstb, largeCorporation: large,
    farmerOverride: farmer === '' ? null : farmer === 'yes', rentalQbiTradeOrBusiness: rental, stateSourcing: state || null,
  });
  const check = (id: string, label: string, v: boolean, set: (b: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" aria-label={label} checked={v} disabled={!canWrite} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <section className="space-y-4 bg-white rounded-lg border border-gray-200 p-4" aria-label="Tax profile">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Entity type</div>
          <div className="text-base font-medium text-gray-900" data-testid="resolved-type">
            {r.entityType ? ENTITY_TYPE_LABELS[r.entityType] : 'Not set'}
          </div>
          <Chip>{entityTypeSourceLabel(r.entityTypeSource, r.tbReturnForm)}</Chip>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Tax accounting method</div>
          <div className="text-base font-medium text-gray-900" data-testid="resolved-method">{TAX_METHOD_LABELS[r.taxMethod]}</div>
          <Chip>{taxMethodSourceLabel(r.taxMethodSource)}</Chip>
          {r.booksMethod !== r.taxMethod && <p className="text-xs text-amber-700 mt-1">Books report on the {r.booksMethod} basis.</p>}
        </div>
      </div>

      {hasTb ? (
        <details className="rounded border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm text-gray-600">Override (rarely needed; the Trial Balance profile is the source of truth)</summary>
          <div className="grid gap-3 sm:grid-cols-2 mt-3">{typeControl}{methodControl}</div>
        </details>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{typeControl}{methodControl}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {check('sstb', 'Specified service trade or business (SSTB)', sstb, setSstb)}
        {check('large', 'Large corporation', large, setLarge)}
        {check('rental', 'Rental is a trade or business (QBI)', rental, setRental)}
        <label className="block text-sm text-gray-700">
          Farmer override
          <select aria-label="Farmer override" className={SELECT_CLASS} disabled={!canWrite} value={farmer}
            onChange={(e) => setFarmer(e.target.value as '' | 'yes' | 'no')}>
            <option value="">Automatic</option><option value="yes">Treat as farmer</option><option value="no">Not a farmer</option>
          </select>
        </label>
        <label className="block text-sm text-gray-700">
          Income sourced to (state)
          <select aria-label="State sourcing" className={SELECT_CLASS} disabled={!canWrite} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Not set</option>
            {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {canWrite && <Button size="sm" loading={saving} onClick={save}>Save tax profile</Button>}
    </section>
  );
}
