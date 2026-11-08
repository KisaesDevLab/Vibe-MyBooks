// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Owner decision E3 (engine QA 2026-11-08): the engine refuses to void an
// invoice with payments or credits applied (409 INVOICE_HAS_PAYMENTS); the
// Void dialog says what is applied and what to do.

import { describe, it, expect } from 'vitest';
import { ApiError } from '../../api/client';
import { isNonZeroAmount, voidInvoiceErrorMessage } from './voidInvoiceError';

describe('voidInvoiceErrorMessage', () => {
  it('names the payments and credits applied', () => {
    const err = new ApiError('This invoice has payments or credits applied.', 'INVOICE_HAS_PAYMENTS', { payments: 2, credits: 1 }, 409);
    expect(voidInvoiceErrorMessage(err)).toBe(
      'This invoice still has 2 payments and 1 credit applied. Void those first (see Related Transactions on this page), then void the invoice.',
    );
  });

  it('falls back to a generic phrase without details', () => {
    const err = new ApiError('x', 'INVOICE_HAS_PAYMENTS', undefined, 409);
    expect(voidInvoiceErrorMessage(err)).toMatch(/still has payments or credits applied/);
  });

  it('shows any other error as the server sent it', () => {
    expect(voidInvoiceErrorMessage(new ApiError('Period is closed', 'TB_PERIOD_LOCKED', undefined, 423))).toBe('Period is closed');
    expect(voidInvoiceErrorMessage('nope')).toBe('The invoice could not be voided.');
  });
});

describe('isNonZeroAmount', () => {
  it('reads decimal strings without float math', () => {
    expect(isNonZeroAmount('0.0000')).toBe(false);
    expect(isNonZeroAmount(null)).toBe(false);
    expect(isNonZeroAmount('0.0001')).toBe(true);
    expect(isNonZeroAmount('25.00')).toBe(true);
  });
});
