// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { isApiError } from '../../api/client';

/**
 * The Void dialog's error text. The engine refuses to void an invoice that
 * still has payments or credits applied (409 INVOICE_HAS_PAYMENTS, details
 * {payments, credits}); say what is applied and what to do (owner decision
 * E3, engine QA 2026-11-08).
 */
export function voidInvoiceErrorMessage(err: unknown): string {
  if (isApiError(err) && err.code === 'INVOICE_HAS_PAYMENTS') {
    const d = (err.details ?? {}) as { payments?: number; credits?: number };
    const parts: string[] = [];
    if (d.payments) parts.push(`${d.payments} payment${d.payments === 1 ? '' : 's'}`);
    if (d.credits) parts.push(`${d.credits} credit${d.credits === 1 ? '' : 's'}`);
    const what = parts.length > 0 ? parts.join(' and ') : 'payments or credits';
    return `This invoice still has ${what} applied. Void those first (see Related Transactions on this page), then void the invoice.`;
  }
  return err instanceof Error && err.message ? err.message : 'The invoice could not be voided.';
}

/** True when a decimal string is a non-zero amount (no float math on money). */
export function isNonZeroAmount(amount: string | null | undefined): boolean {
  return /[1-9]/.test(amount ?? '');
}
