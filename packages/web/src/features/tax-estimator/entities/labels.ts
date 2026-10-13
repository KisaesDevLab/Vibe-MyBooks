// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { AccountTreatment, EntityTaxType, EntityTypeOverrideInfo, EntityTypeSource, ResolvedEntityTax, TaxMethodSource } from '@kis-books/shared';
import { entityTypeOverrideBaseText } from '@kis-books/shared';

export const ENTITY_TYPE_LABELS: Record<EntityTaxType, string> = {
  sch_c: 'Schedule C (sole proprietor)', sch_f: 'Schedule F (farm)', s_corp: 'S corporation',
  partnership: 'Partnership', c_corp: 'C corporation',
};
export const TAX_METHOD_LABELS = { cash: 'Cash', accrual: 'Accrual' } as const;

export const TREATMENT_LABELS: Record<AccountTreatment, string> = {
  nondeductible_pct: 'Nondeductible %', owner_sehi: 'Owner SEHI', owner_retirement: 'Owner retirement',
  owner_personal: 'Owner personal', estimated_tax_payment: 'Estimated tax payment',
  tax_depreciation_differs: 'Tax depreciation differs', w2_wages: 'W-2 wages',
  guaranteed_payment: 'Guaranteed payment (partner)',
  capital_gain_lt: 'Character: long-term capital gain', capital_gain_st: 'Character: short-term capital gain',
  section_1231: 'Character: Section 1231', interest: 'Character: interest',
  dividends_ordinary: 'Character: ordinary dividends', dividends_qualified: 'Character: qualified dividends',
  unrecaptured_1250: 'Long-term gain: unrecaptured §1250 (25%)', collectibles_gain: 'Long-term gain: collectibles (28%)',
};

export function entityTypeSourceLabel(source: EntityTypeSource, returnForm: string | null, override?: EntityTypeOverrideInfo): string {
  switch (source) {
    // Q49: the entity year's override decided the type.
    case 'estimator_override': return override
      ? `Overridden for ${override.taxYear} (${entityTypeOverrideBaseText(override)})`
      : 'Overridden for this tax year';
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

/**
 * Q49: the default option of "Entity type for <year>" — what the D3 precedence gives without the
 * per-year override ("Use TB profile (1065 → Partnership)").
 */
export function baseEntityTypeOptionLabel(r: ResolvedEntityTax): string {
  const o = r.entityTypeOverride;
  const type = o ? o.baseEntityType : r.entityType;
  const source = o ? o.baseEntityTypeSource : r.entityTypeSource;
  const name = type ? ENTITY_TYPE_LABELS[type] : 'not set';
  switch (source) {
    case 'tb_profile': return `Use TB profile (${r.tbReturnForm ?? '?'} → ${name})`;
    case 'estimator_setting': return `Use estimator setting (${name})`;
    case 'company_entity_type': return `Use company entity type (${name})`;
    default: return 'Use TB profile (none set: no entity type)';
  }
}

/** Q49: the entity type the D3 precedence gives without the per-year override. */
export function baseEntityType(r: ResolvedEntityTax): EntityTaxType | null {
  return r.entityTypeOverride ? r.entityTypeOverride.baseEntityType : r.entityType;
}
