// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A/R Aging is built from the ledger and nets a customer's unapplied
// payments and credits against the open invoices. Customer Balance Summary
// adds up open invoice balances only. The two can differ for the same
// customer (e.g. $60 open, $10 credit, $30 unapplied payment: aging $20,
// balance summary $60), so each page says what it counts and points to the
// other.

import { Link } from 'react-router-dom';

/** Display names for the engine's A/R aging item kinds. */
export const AR_KIND_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  credit: 'Credit / unapplied payment',
  charge: 'Charge',
  other: 'Other',
};

export function CustomerBalanceNote() {
  return (
    <>
      Shows open invoice balances only. Unapplied payments, overpayment credits and credit memos are not
      subtracted here, so a customer with credits can show more than on{' '}
      <Link to="/reports/ar-aging-summary" className="font-medium underline">A/R Aging Summary</Link>, which nets
      them against the invoices and lists each credit.
    </>
  );
}

export function ArAgingNote() {
  return (
    <>
      Unapplied payments and credits are listed as negative amounts (type “Credit / unapplied payment”) and reduce
      the customer’s total, so totals can be lower than{' '}
      <Link to="/reports/customer-balance-summary" className="font-medium underline">Customer Balance Summary</Link>,
      which shows open invoices only.
    </>
  );
}
