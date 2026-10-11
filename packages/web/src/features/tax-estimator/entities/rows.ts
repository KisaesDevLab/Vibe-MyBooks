// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import Decimal from 'decimal.js';
import type { AccountTreatmentDto, AccountTreatment, TaxBasisAccountLine, TaxCodeRef, TreatmentSuggestion } from '@kis-books/shared';

export interface TreatmentRow {
  accountId: string;
  accountNumber: string | null;
  name: string;
  accountType: string;
  taxCode: TaxCodeRef | null;
  treatment: AccountTreatment | null;
  pct: string | null;
  paymentTaxpayerId: string | null;
  paymentPersonId: string | null;
  paymentJurisdiction: string | null;
  nonRecurring: boolean;
  bookAmount: string;
  taxAmount: string;
  suggestion: TreatmentSuggestion | null;
  /** No TB code, no estimator treatment, and book activity: treated as ordinary and flagged. */
  unmappedWithActivity: boolean;
}

const isZero = (v: string) => { try { return new Decimal(v).isZero(); } catch { return true; } };

/** One row per P&L account: the tax-basis P&L accounts (TB code + amounts) merged with stored treatments and suggestions. */
export function buildRows(
  lines: TaxBasisAccountLine[], treatments: AccountTreatmentDto[], suggestions: TreatmentSuggestion[],
): TreatmentRow[] {
  const tById = new Map(treatments.map((t) => [t.accountId, t]));
  const sById = new Map(suggestions.map((s) => [s.accountId, s]));
  const rows: TreatmentRow[] = lines.map((l) => {
    const t = tById.get(l.accountId);
    const treatment = t?.treatment ?? l.treatment;
    return {
      accountId: l.accountId, accountNumber: l.accountNumber, name: l.name, accountType: l.accountType,
      taxCode: l.taxCode, treatment, pct: t?.pct ?? l.pct,
      paymentTaxpayerId: t?.paymentTaxpayerId ?? null, paymentPersonId: t?.paymentPersonId ?? null,
      paymentJurisdiction: t?.paymentJurisdiction ?? null, nonRecurring: t?.nonRecurring ?? l.accountNonRecurring,
      bookAmount: l.bookAmount, taxAmount: l.taxAmount, suggestion: treatment ? null : sById.get(l.accountId) ?? null,
      unmappedWithActivity: !l.taxCode && !treatment && !isZero(l.bookAmount),
    };
  });
  const seen = new Set(lines.map((l) => l.accountId));
  for (const t of treatments) {
    if (seen.has(t.accountId)) continue;
    rows.push({
      accountId: t.accountId, accountNumber: t.accountNumber, name: t.accountName, accountType: t.accountType,
      taxCode: null, treatment: t.treatment, pct: t.pct, paymentTaxpayerId: t.paymentTaxpayerId,
      paymentPersonId: t.paymentPersonId, paymentJurisdiction: t.paymentJurisdiction, nonRecurring: t.nonRecurring,
      bookAmount: '0.0000', taxAmount: '0.0000', suggestion: null, unmappedWithActivity: false,
    });
  }
  return rows;
}
