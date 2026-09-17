// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Types and pure helpers shared by Enter Bill and the Bill Capture review
// screen. Moved out of EnterBillPage unchanged so both forms keep one
// definition of a line, one terms table and one due-date rule.

export interface BillLine {
  accountId: string;
  description: string;
  amount: string;
  // ADR 0XX/0XY — per-line tag + stickiness flag.
  tagId: string | null;
  userHasTouchedTag: boolean;
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

export const VALID_TERMS = new Set(['due_on_receipt', 'net_10', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']);

export const TERM_DAYS: Record<string, number> = {
  due_on_receipt: 0,
  net_10: 10,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
  net_90: 90,
};

export function emptyLine(): BillLine {
  return { accountId: '', description: '', amount: '', tagId: null, userHasTouchedTag: false };
}

export function calcDueDate(billDate: string, terms: string, customDays: string): string {
  if (!billDate) return '';
  const d = new Date(billDate);
  let days: number | undefined;
  if (terms === 'custom') {
    days = parseInt(customDays || '0', 10);
  } else if (terms in TERM_DAYS) {
    days = TERM_DAYS[terms];
  }
  if (days === undefined || isNaN(days)) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
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
