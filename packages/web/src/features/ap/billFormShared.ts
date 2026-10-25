// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Types and pure helpers shared by Enter Bill and the Bill Capture review
// screen. Moved out of EnterBillPage unchanged so both forms keep one
// definition of a line, one terms table and one due-date rule.

import { PAYMENT_TERMS, addCalendarDays, isCalendarDate } from '@kis-books/shared';

export interface BillLine {
  accountId: string;
  description: string;
  amount: string;
  // ADR 0XX/0XY — per-line tag + stickiness flag.
  tagId: string | null;
  userHasTouchedTag: boolean;
  // Item-line fields of a saved bill (bill-lines-v1). This form has no
  // columns for them; an edit sends them back so they are kept (review L1).
  itemId?: string | null;
  quantity?: string | null;
  unitPrice?: string | null;
  contactId?: string | null;
  isBillable?: boolean;
  /** The amount as loaded: a changed amount drops the unit cost (it no longer multiplies out). */
  loadedAmount?: string;
}

export interface OcrExtraction {
  vendor: string | null;
  vendorInvoiceNumber: string | null;
  billDate: string | null;
  dueDate: string | null;
  paymentTerms: string | null;
  total: string | null;
  subtotal: string | null;
  tax: string | null;
  notes: string | null;
  confidence: number;
  contactId: string | null;
  defaultExpenseAccountId: string | null;
  lineItems: Array<{ description: string | null; amount: string | null; quantity: string | null }>;
}

// The engine's terms table (GET /payment-terms reads the same list): every
// code with fixed net days.
export const TERM_DAYS: Record<string, number> = Object.fromEntries(
  PAYMENT_TERMS.filter((t) => t.netDays !== null).map((t) => [t.code, t.netDays!]),
);

export const VALID_TERMS = new Set(Object.keys(TERM_DAYS));

export function emptyLine(): BillLine {
  return { accountId: '', description: '', amount: '', tagId: null, userHasTouchedTag: false };
}

/**
 * The due-date preview for a bill date and terms: calendar arithmetic with
 * the engine's own helper (review L2; the old local-time setDate came out a
 * day early across the March DST change). '' when the terms give no date.
 * The engine computes the stored date; the form sends dueDate only when the
 * owner typed one.
 */
export function calcDueDate(billDate: string, terms: string, customDays: string): string {
  if (!billDate || !isCalendarDate(billDate)) return '';
  let days: number | undefined;
  if (terms === 'custom') {
    days = /^\d+$/.test(customDays) ? Number(customDays) : undefined;
  } else if (terms in TERM_DAYS) {
    days = TERM_DAYS[terms];
  }
  if (days === undefined) return '';
  return addCalendarDays(billDate, days);
}

// ─── Exact amounts (review L6) ──────────────────────────────────────
// Line amounts are decimal strings; totals are compared exactly in units of
// 0.0001 (the ledger's scale), never as floats with a tolerance.

const AMOUNT_RE = /^(-?)(\d+)(?:\.(\d{0,4}))?$/;

/** An amount string in 0.0001 units, or null when it isn't a plain decimal with at most 4 places. */
export function amountUnits(value: string | null | undefined): bigint | null {
  const m = AMOUNT_RE.exec((value ?? '').trim());
  if (!m) return null;
  const units = BigInt(m[2]!) * BigInt(10000) + BigInt((m[3] ?? '').padEnd(4, '0'));
  return m[1] === '-' ? -units : units;
}

/** The exact sum of the amounts (blank or malformed ones count as 0). */
export function sumAmountUnits(values: ReadonlyArray<string | null | undefined>): bigint {
  return values.reduce<bigint>((s, v) => s + (amountUnits(v) ?? BigInt(0)), BigInt(0));
}

/** 0.0001 units as a 2-place display string when exact, else 4 places. */
export function formatUnits(units: bigint): string {
  const neg = units < BigInt(0);
  const abs = neg ? -units : units;
  const whole = abs / BigInt(10000);
  const frac = (abs % BigInt(10000)).toString().padStart(4, '0');
  const shown = frac.endsWith('00') ? frac.slice(0, 2) : frac;
  return `${neg ? '-' : ''}${whole.toString()}.${shown}`;
}

/**
 * A form line as POST / PUT /bills takes it. Every line carries its item,
 * quantity, cost, customer and billable mark explicitly (null / false on a
 * new line), so an edit keeps what the bill had (review L1) and the engine
 * never has to guess. When the owner changed a loaded line's amount the
 * unit cost no longer multiplies out, so it is dropped (quantity with an
 * amount and no cost is accepted).
 */
export function billLinePayload(l: BillLine) {
  const amountChanged = l.loadedAmount !== undefined && amountUnits(l.amount) !== amountUnits(l.loadedAmount);
  return {
    accountId: l.accountId,
    description: l.description || undefined,
    amount: l.amount,
    tagId: l.tagId,
    itemId: l.itemId ?? null,
    quantity: l.quantity ?? null,
    unitPrice: amountChanged ? null : (l.unitPrice ?? null),
    contactId: l.contactId ?? null,
    isBillable: l.isBillable === true,
  };
}

/** A stored 4-place percent ("2.0000", "1.5000") as typed: "2", "1.5". */
export function editPercent(stored: string): string {
  return stored.includes('.') ? stored.replace(/0+$/, '').replace(/\.$/, '') : stored;
}

/** A stored 4-place amount ("873.7600") for the amount box: "873.76", or all 4 places when they matter. */
export function editAmount(stored: string | null | undefined): string {
  const units = amountUnits(stored);
  return units === null ? '' : formatUnits(units);
}

function money(v: string | null | undefined): number {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
}

/** The AI's line items as form lines (positive amounts only), each on the
 *  vendor's default expense account and tag. Empty when nothing usable. */
export function extractionToLines(
  ext: Pick<OcrExtraction, 'lineItems' | 'defaultExpenseAccountId'>,
  defaultTagId: string | null = null,
): BillLine[] {
  return (ext.lineItems ?? [])
    .filter((li) => money(li.amount) > 0)
    .map((li) => ({
      accountId: ext.defaultExpenseAccountId || '',
      description: li.description || '',
      amount: money(li.amount).toFixed(2),
      tagId: defaultTagId,
      userHasTouchedTag: false,
    }));
}

/** One line at the bill total, categorised to the vendor's default expense
 *  account and tag. Used by the Single-line mode and as the fallback when
 *  the AI returned a total but no lines. */
export function singleLineFromTotal(
  ext: Pick<OcrExtraction, 'total' | 'notes' | 'defaultExpenseAccountId' | 'lineItems'>,
  defaultTagId: string | null = null,
  fallbackDescription = 'Vendor invoice',
): BillLine {
  // Prefer the stated total; else the sum of the lines the AI read.
  const stated = money(ext.total);
  const summed = (ext.lineItems ?? []).reduce((s, li) => s + Math.max(money(li.amount), 0), 0);
  const amount = stated > 0 ? stated : summed;
  return {
    accountId: ext.defaultExpenseAccountId || '',
    description: ext.notes || fallbackDescription,
    amount: amount > 0 ? amount.toFixed(2) : '',
    tagId: defaultTagId,
    userHasTouchedTag: false,
  };
}
