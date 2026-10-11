// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { AccountTreatment, EntityTaxType, EntityTypeSource, TaxMethodSource } from '@kis-books/shared';

export const ENTITY_TYPE_LABELS: Record<EntityTaxType, string> = {
  sch_c: 'Schedule C (sole proprietor)', sch_f: 'Schedule F (farm)', s_corp: 'S corporation',
  partnership: 'Partnership', c_corp: 'C corporation',
};
export const TAX_METHOD_LABELS = { cash: 'Cash', accrual: 'Accrual' } as const;

export const TREATMENT_LABELS: Record<AccountTreatment, string> = {
  nondeductible_pct: 'Nondeductible %', owner_sehi: 'Owner SEHI', owner_retirement: 'Owner retirement',
  owner_personal: 'Owner personal', estimated_tax_payment: 'Estimated tax payment',
  tax_depreciation_differs: 'Tax depreciation differs', w2_wages: 'W-2 wages',
};

export function entityTypeSourceLabel(source: EntityTypeSource, returnForm: string | null): string {
  switch (source) {
    case 'tb_profile': return `From Trial Balance return form ${returnForm ?? ''}`.trim();
    case 'estimator_setting': return 'Estimator override';
    case 'company_entity_type': return 'Company entity type';
    default: return 'Not set';
  }
}
export function taxMethodSourceLabel(source: TaxMethodSource): string {
  return source === 'estimator_setting' ? 'Estimator override' : 'Company accounting method';
}

export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'] as const;

export const SELECT_CLASS = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500';
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');
