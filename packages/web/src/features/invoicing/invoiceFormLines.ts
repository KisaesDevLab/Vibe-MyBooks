// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

/**
 * The invoice editor's lines, to and from the API (review B-1). Pure, so the
 * load -> save round trip is unit-tested without the form.
 *
 * Load: every line but A/R and Sales Tax, as a SIGNED amount (credit -
 * debit), so discounts and other negative lines are kept; a discount keeps
 * its item and percent (or its amount), a subtotal its item, every line its
 * itemId, serviceDate and unitPriceSource; a billed cost keeps its source
 * (billableSourceLineId) and markup percent, its markup line is folded in.
 * Save: a discount goes back as {itemId, discountPercent} or {itemId,
 * unitPrice}, a subtotal as {itemId}, a billed cost as
 * {billableSourceLineId, accountId, markupPercent}; the engine prices them
 * again with the same rules, so an untouched invoice keeps its total.
 */

import type { JournalLine } from '@kis-books/shared';

export type EntryMode = 'category' | 'item';
export type InvoiceLineKind = 'line' | 'discount' | 'subtotal' | 'billable';

export interface InvoiceLine {
  kind: InvoiceLineKind;
  entryMode: EntryMode;
  accountId: string;
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  isTaxable: boolean;
  /** Percent as typed ("8.25" = 8.25 %). */
  taxRate: string;
  tagId: string | null;
  userHasTouchedTag: boolean;
  serviceDate: string | null;
  /** A percent discount's percent ("10.0000"); null otherwise. */
  discountPercent: string | null;
  unitPriceSource: string | null;
  billableSourceLineId: string | null;
  markupPercent: string | null;
}

export function emptyLine(mode: EntryMode, defaultTaxRate: string = '0'): InvoiceLine {
  return {
    kind: 'line',
    entryMode: mode,
    accountId: '',
    itemId: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    isTaxable: true,
    taxRate: defaultTaxRate,
    tagId: null,
    userHasTouchedTag: false,
    serviceDate: null,
    discountPercent: null,
    unitPriceSource: null,
    billableSourceLineId: null,
    markupPercent: null,
  };
}

type StoredLine = JournalLine & {
  /** GET /invoices/:id: the line's account systemTag (review N-1). */
  accountSystemTag?: string | null;
  serviceDate?: string | null;
  discountPercent?: string | null;
  unitPriceSource?: string | null;
  lineRole?: string | null;
  billableSourceLineId?: string | null;
};

// Exact decimal strings (at most 4 places) as integers of 1/10000, so no
// amount goes through floating point.
const SCALE = 10000n;
function toUnits(v: string | null | undefined): bigint {
  const s = (v ?? '').trim();
  const m = /^(-)?(\d*)(?:\.(\d{0,8}))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return 0n;
  const frac = ((m[3] ?? '') + '0000').slice(0, 4);
  const n = BigInt(m[2] || '0') * SCALE + BigInt(frac);
  return m[1] ? -n : n;
}
function fromUnits(n: bigint): string {
  const neg = n < 0n;
  const a = neg ? -n : n;
  return `${neg ? '-' : ''}${a / SCALE}.${(a % SCALE).toString().padStart(4, '0')}`;
}
/** credit - debit, exact, 4 places. */
export function signedAmount(l: Pick<JournalLine, 'credit' | 'debit'>): string {
  return fromUnits(toUnits(l.credit) - toUnits(l.debit));
}
/** A stored rate (fraction, "0.0825") as a percent string ("8.25"), exact. */
export function rateToPercent(rate: string | null | undefined): string {
  const u = toUnits(rate) * 100n;
  return fromUnits(u).replace(/\.?0+$/, '') || '0';
}
/** A percent string ("8.25") as a rate fraction ("0.0825"), exact to the 4 places the engine stores. */
export function percentToRate(percent: string): string {
  const s = (percent ?? '').trim();
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) return '0';
  const digits = (m[2] || '0') + ((m[3] ?? '') + '000000').slice(0, 6); // percent at 6 places = rate at 8 places
  const rate8 = BigInt(digits); // rate x 10^8
  const rounded = (rate8 + 5000n) / 10000n; // half up to 4 places
  return fromUnits(m[1] ? -rounded : rounded).replace(/0+$/, '').replace(/\.$/, '') || '0';
}

const SYSTEM_TAGS = new Set(['accounts_receivable', 'sales_tax_payable']);

export type HydrateResult = { ok: true; lines: InvoiceLine[] } | { ok: false; error: string };

/**
 * The form lines of a stored invoice (GET /invoices/:id). The engine's own
 * lines are told apart by their account's systemTag (`accountSystemTag`:
 * A/R and Sales Tax Payable), never by paging the chart of accounts. When
 * no line is recognised as A/R on an invoice whose total isn't 0, nothing
 * is loaded (an error instead): saving guessed lines could change the
 * books. `markupByLine`: billableCosts markupPercent by sourceLineId.
 */
export function hydrateInvoiceLines(
  lines: readonly StoredLine[],
  opts: { total: string | null | undefined; defaultTaxRatePercent: string; markupByLine?: ReadonlyMap<string, string> },
): HydrateResult {
  const hasReceivable = lines.some((l) => l.accountSystemTag === 'accounts_receivable');
  if (!hasReceivable && toUnits(opts.total) !== 0n) {
    return { ok: false, error: 'This invoice cannot be edited here: its accounts receivable line was not recognised. Reload the page; if it keeps happening, edit it in the app that made it.' };
  }
  return { ok: true, lines: lines
    .filter((l) => l.accountId && !SYSTEM_TAGS.has(l.accountSystemTag ?? '') && l.lineRole !== 'billable_markup')
    .map((l) => {
      const signed = signedAmount(l);
      const base: InvoiceLine = {
        ...emptyLine(l.itemId ? 'item' : 'category', opts.defaultTaxRatePercent),
        accountId: l.accountId,
        itemId: l.itemId ?? '',
        description: l.description || '',
        isTaxable: l.isTaxable ?? false,
        taxRate: l.isTaxable && l.taxRate ? rateToPercent(l.taxRate) : opts.defaultTaxRatePercent,
        tagId: l.tagId ?? null,
        userHasTouchedTag: l.tagId != null,
        serviceDate: l.serviceDate ?? null,
        unitPriceSource: l.unitPriceSource ?? null,
      };
      if (l.billableSourceLineId) {
        return {
          ...base, kind: 'billable', entryMode: 'category', itemId: '',
          quantity: l.quantity ?? '1', unitPrice: l.unitPrice ?? signed,
          billableSourceLineId: l.billableSourceLineId,
          markupPercent: opts.markupByLine?.get(l.billableSourceLineId) ?? null,
        };
      }
      if (l.itemId && l.discountPercent) {
        return { ...base, kind: 'discount', quantity: '', unitPrice: signed, discountPercent: l.discountPercent };
      }
      if (l.itemId && l.unitPriceSource === 'none') {
        return { ...base, kind: 'subtotal', quantity: '', unitPrice: '', isTaxable: false };
      }
      if (l.itemId && (l.quantity === null || l.quantity === undefined) && toUnits(signed) < 0n) {
        return { ...base, kind: 'discount', quantity: '', unitPrice: signed };
      }
      // Keep the stored quantity and price when they give the amount to the
      // cent (U-122), else 1 x the signed amount.
      if (l.quantity && l.unitPrice && toUnits(l.quantity) !== 0n) {
        const product = toUnits(l.quantity) * toUnits(l.unitPrice); // 1/10^8
        const cents = (product < 0n ? product - 500000n : product + 500000n) / 1000000n; // half away from zero
        if (cents * 100n === toUnits(signed)) return { ...base, quantity: l.quantity, unitPrice: l.unitPrice };
      }
      return { ...base, quantity: '1', unitPrice: signed };
    }) };
}

/** Lines the editor would leave out on save (no account, or no price on a plain line). */
function isSendable(l: InvoiceLine): boolean {
  if (l.kind === 'discount' || l.kind === 'subtotal') return !!l.itemId;
  if (l.kind === 'billable') return !!l.billableSourceLineId && !!l.accountId;
  return !!l.accountId && l.unitPrice !== '';
}

/** The PUT / POST lines for the form's lines. */
export function invoiceLinesPayload(lines: readonly InvoiceLine[]): Array<Record<string, unknown>> {
  return lines.filter(isSendable).map((l) => {
    const common = {
      description: l.description || undefined,
      tagId: l.tagId,
      ...(l.serviceDate ? { serviceDate: l.serviceDate } : {}),
    };
    const tax = { isTaxable: l.isTaxable, taxRate: l.isTaxable ? percentToRate(l.taxRate) : '0' };
    switch (l.kind) {
      case 'subtotal':
        return { itemId: l.itemId, accountId: l.accountId || undefined, ...common };
      case 'discount':
        return {
          itemId: l.itemId, accountId: l.accountId || undefined, ...common, ...tax,
          // An amount discount's amount off (the engine takes its size).
          ...(l.discountPercent ? { discountPercent: l.discountPercent } : { unitPrice: fromUnits(toUnits(l.unitPrice)).replace('-', '') }),
        };
      case 'billable':
        return {
          billableSourceLineId: l.billableSourceLineId, accountId: l.accountId, ...common, ...tax,
          ...(l.markupPercent ? { markupPercent: l.markupPercent } : {}),
        };
      default:
        return {
          accountId: l.accountId,
          ...(l.itemId ? { itemId: l.itemId } : {}),
          ...common,
          quantity: l.quantity || '1',
          unitPrice: l.unitPrice,
          ...tax,
        };
    }
  });
}

/**
 * The on-screen line amount and totals, exact, with the engine's discount
 * and subtotal rules (packages/shared/fixtures/invoice-golden.json); tax is
 * estimated per line. The engine's figures win on save.
 */
export function estimateInvoice(lines: readonly InvoiceLine[]): { amounts: string[]; subtotal: string; tax: string; total: string } {
  const round2 = (u8: bigint) => (u8 < 0n ? u8 - 500000n : u8 + 500000n) / 1000000n; // 1/10^8 -> cents
  let group = 0n; // cents
  let underSubtotal: bigint | null = null;
  let subtotal = 0n;
  let taxU8 = 0n; // tax, 1/10^8 of a cent-ish unit: cents x rate units
  const amounts = lines.map((l) => {
    let cents: bigint;
    if (l.kind === 'subtotal') {
      cents = group;
      underSubtotal = group;
      group = 0n;
      return fromUnits(cents * 100n).slice(0, -2);
    }
    if (l.kind === 'discount') {
      const base: bigint = underSubtotal ?? group;
      if (l.discountPercent) {
        cents = base > 0n ? -round2(base * 100n * toUnits(l.discountPercent) / 100n) : 0n;
      } else {
        const a = toUnits(l.unitPrice);
        cents = -((a < 0n ? -a : a) + 50n) / 100n;
      }
      group += cents;
      underSubtotal = underSubtotal === null ? null : underSubtotal + cents;
    } else {
      cents = round2(toUnits(l.quantity || '1') * toUnits(l.unitPrice));
      group += cents;
      underSubtotal = null;
    }
    subtotal += cents;
    if (l.isTaxable) taxU8 += cents * toUnits(percentToRate(l.taxRate));
    return fromUnits(cents * 100n).slice(0, -2);
  });
  const tax = taxU8 > 0n ? (taxU8 + 5000n) / 10000n : 0n; // cents x 10^4 -> cents
  return {
    amounts,
    subtotal: fromUnits(subtotal * 100n).slice(0, -2),
    tax: fromUnits(tax * 100n).slice(0, -2),
    total: fromUnits((subtotal + tax) * 100n).slice(0, -2),
  };
}

/** The billed costs the stored invoice billed that the form no longer has (PUT releaseBillableSourceLineIds, U-128). */
export function releasedBillableIds(stored: readonly string[], lines: readonly InvoiceLine[]): string[] {
  const kept = new Set(lines.flatMap((l) => (l.billableSourceLineId ? [l.billableSourceLineId] : [])));
  return stored.filter((id) => !kept.has(id));
}
