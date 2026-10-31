// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Review B-1: the invoice editor must not drop discount, subtotal or other
// negative lines when it loads and saves an invoice.

import { describe, it, expect } from 'vitest';
import type { JournalLine } from '@kis-books/shared';
import {
  hydrateInvoiceLines, invoiceLinesPayload, estimateInvoice, percentToRate, rateToPercent, signedAmount, releasedBillableIds,
} from './invoiceFormLines';

const AR = 'acct-ar';
const TAX = 'acct-tax';
const REV = 'acct-rev';
const MARKUP = 'acct-markup';

function line(p: Partial<JournalLine> & Record<string, unknown>): JournalLine {
  return {
    id: `l-${Math.random()}`, tenantId: 't', transactionId: 'inv', accountId: REV, debit: '0.0000', credit: '0.0000',
    description: null, quantity: null, unitPrice: null, isTaxable: false, taxRate: '0.0000', taxAmount: '0.0000',
    lineOrder: 0, tagId: null, contactId: null, createdAt: '2026-11-03T00:00:00Z', ...p,
  } as JournalLine;
}

// Invoice 1043 as GET /invoices/:id returns it: 1,068.00 taxable at 8.25 %,
// a 10 % discount (-106.80, a debit), tax 79.30, total 1,040.50.
const invoice1043 = [
  line({ accountId: AR, accountSystemTag: 'accounts_receivable', debit: '1040.5000' }),
  line({ credit: '1068.0000', quantity: '12.0000', unitPrice: '89.0000', isTaxable: true, taxRate: '0.0825', taxAmount: '88.1100',
    itemId: 'item-labor', unitPriceSource: 'input', serviceDate: '2026-10-28', description: 'Spring cleanup' }),
  line({ debit: '106.8000', isTaxable: true, taxRate: '0.0825', taxAmount: '-8.8100', itemId: 'item-disc10',
    discountPercent: '10.0000', unitPriceSource: 'item', description: 'Loyal client' }),
  line({ accountId: TAX, accountSystemTag: 'sales_tax_payable', credit: '79.3000', description: 'Sales Tax' }),
];
const opts = { total: '1040.5000', defaultTaxRatePercent: '8.25' };
const loaded = (r: ReturnType<typeof hydrateInvoiceLines>) => { if (!r.ok) throw new Error(r.error); return r.lines; };

describe('invoice editor lines (B-1)', () => {
  it('a discounted invoice survives load + save with the same total', () => {
    const form = loaded(hydrateInvoiceLines(invoice1043, opts));
    expect(form.map((l) => l.kind)).toEqual(['line', 'discount']);
    expect(estimateInvoice(form)).toEqual({ amounts: ['1068.00', '-106.80'], subtotal: '961.20', tax: '79.30', total: '1040.50' });

    expect(invoiceLinesPayload(form)).toEqual([
      {
        accountId: REV, itemId: 'item-labor', description: 'Spring cleanup', tagId: null, serviceDate: '2026-10-28',
        quantity: '12.0000', unitPrice: '89.0000', isTaxable: true, taxRate: '0.0825',
      },
      {
        itemId: 'item-disc10', accountId: REV, description: 'Loyal client', tagId: null,
        isTaxable: true, taxRate: '0.0825', discountPercent: '10.0000',
      },
    ]);
  });

  it('keeps subtotals, amount discounts, negative lines and billed costs; drops nothing but A/R and tax', () => {
    const stored = [
      line({ accountId: AR, accountSystemTag: 'accounts_receivable', debit: '311.5000' }),
      line({ credit: '300.0000', quantity: '3.0000', unitPrice: '100.0000' }),
      line({ debit: '20.0000', quantity: '-1.0000', unitPrice: '20.0000', description: 'Return' }),
      line({ itemId: 'item-sub', unitPriceSource: 'none' }),
      line({ debit: '15.0000', itemId: 'item-off15', unitPrice: '-15.0000', unitPriceSource: 'item' }),
      line({ credit: '42.0000', quantity: '1.0000', unitPrice: '42.0000', lineRole: 'billable_cost', billableSourceLineId: 'src-1', itemId: 'item-pavers' }),
      line({ accountId: MARKUP, credit: '4.5000', lineRole: 'billable_markup', billableSourceLineId: 'src-1' }),
    ];
    const form = loaded(hydrateInvoiceLines(stored, { ...opts, total: '311.5000', markupByLine: new Map([['src-1', '10.0000']]) }));
    expect(form.map((l) => l.kind)).toEqual(['line', 'line', 'subtotal', 'discount', 'billable']);
    expect(invoiceLinesPayload(form)).toEqual([
      { accountId: REV, description: undefined, tagId: null, quantity: '3.0000', unitPrice: '100.0000', isTaxable: false, taxRate: '0' },
      { accountId: REV, description: 'Return', tagId: null, quantity: '-1.0000', unitPrice: '20.0000', isTaxable: false, taxRate: '0' },
      { itemId: 'item-sub', accountId: REV, description: undefined, tagId: null },
      { itemId: 'item-off15', accountId: REV, description: undefined, tagId: null, isTaxable: false, taxRate: '0', unitPrice: '15.0000' },
      { billableSourceLineId: 'src-1', accountId: REV, description: undefined, tagId: null, isTaxable: false, taxRate: '0', markupPercent: '10.0000' },
    ]);
  });

  it('a line whose stored price does not give its amount goes back as 1 x the amount', () => {
    const form = loaded(hydrateInvoiceLines([line({ credit: '33.3400', quantity: '3.0000', unitPrice: '11.1111' })], { ...opts, total: '0' }));
    expect([form[0]!.quantity, form[0]!.unitPrice]).toEqual(['1', '33.3400']);
  });

  it('refuses to load when no line is recognised as A/R on a non-zero invoice (N-1)', () => {
    // E.g. the response lost accountSystemTag: guessing would save the A/R line as revenue.
    const untagged = invoice1043.map((l) => ({ ...l, accountSystemTag: null }));
    const r = hydrateInvoiceLines(untagged, opts);
    expect(r.ok).toBe(false);
    // A $0 invoice with no A/R line loads.
    expect(hydrateInvoiceLines([], { ...opts, total: '0.0000' }).ok).toBe(true);
  });

  it('a billed-cost row removed in the editor is released on save (U-128)', () => {
    const form = loaded(hydrateInvoiceLines([
      line({ accountId: AR, accountSystemTag: 'accounts_receivable', debit: '84.0000' }),
      line({ credit: '42.0000', lineRole: 'billable_cost', billableSourceLineId: 'src-1' }),
      line({ credit: '42.0000', lineRole: 'billable_cost', billableSourceLineId: 'src-2' }),
    ], { ...opts, total: '84.0000' }));
    expect(releasedBillableIds(['src-1', 'src-2'], form)).toEqual([]);
    expect(releasedBillableIds(['src-1', 'src-2'], form.slice(1))).toEqual(['src-1']);
  });

  it('rates and amounts convert exactly', () => {
    expect(rateToPercent('0.0725')).toBe('7.25');
    expect(percentToRate('7.25')).toBe('0.0725');
    expect(percentToRate('8.25')).toBe('0.0825');
    expect(percentToRate('0')).toBe('0');
    expect(signedAmount({ credit: '0.0000', debit: '106.8000' })).toBe('-106.8000');
  });
});
