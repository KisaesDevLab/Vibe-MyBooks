// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Record Payment: the default amount is the balance in exact cents rounded
// half away from zero (the engine's cap), and an amount above the balance
// shows that the excess becomes a credit for the customer (allowed, not an
// error) and is sent as entered.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { Transaction } from '@kis-books/shared';
import { renderRoute } from '../../test-utils';
import { invoicesMocks, passthroughMutation } from '../../test-mocks';

const recordMutate = vi.fn();
vi.mock('../../api/hooks/useInvoices', () => ({
  ...invoicesMocks(),
  useRecordPayment: () => ({ ...passthroughMutation(), mutate: recordMutate }),
}));
vi.mock('../../components/forms/AccountSelector', () => ({ AccountSelector: () => null }));
vi.mock('../../components/forms/PaymentMethodSelect', () => ({ PaymentMethodSelect: () => null }));

import { RecordPaymentModal } from './RecordPaymentModal';

const invoice = (over: Partial<Transaction>): Transaction => ({
  id: 'inv-1',
  total: '50.0000',
  amountPaid: '0.0000',
  balanceDue: '50.0000',
  invoiceStatus: 'sent',
  ...over,
} as Transaction);

const amountInput = () => screen.getByLabelText(/payment amount/i) as HTMLInputElement;

beforeEach(() => { recordMutate.mockReset(); });

describe('RecordPaymentModal', () => {
  it('defaults to the balance rounded half up to cents, not float toFixed', () => {
    renderRoute(<RecordPaymentModal invoice={invoice({ total: '10.0050', balanceDue: '10.0050' })} onClose={vi.fn()} />);
    expect(amountInput().value).toBe('10.01');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('an amount above the balance shows the credit notice and is sent as entered', async () => {
    renderRoute(<RecordPaymentModal invoice={invoice({})} onClose={vi.fn()} />);
    const input = amountInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.blur(input);
    const note = await screen.findByRole('note');
    expect(note.textContent).toMatch(/\$10\.00 more than the balance due/);
    expect(note.textContent).toMatch(/\$50\.00 pays this invoice in full/);
    expect(note.textContent).toMatch(/credit for the customer/);
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
    await waitFor(() => expect(recordMutate).toHaveBeenCalledTimes(1));
    const sent = recordMutate.mock.calls[0]![0] as { invoiceId: string; amount: string };
    expect(sent.invoiceId).toBe('inv-1');
    // Not capped by the web: the engine applies $50 and keeps $10 as credit.
    expect(Number(sent.amount)).toBe(60);
  });

  it('no notice at or below the balance', () => {
    renderRoute(<RecordPaymentModal invoice={invoice({})} onClose={vi.fn()} />);
    const input = amountInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.blur(input);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a paid invoice defaults to 0.00: any payment is all credit', () => {
    renderRoute(<RecordPaymentModal invoice={invoice({ balanceDue: '0.0000', amountPaid: '50.0000', invoiceStatus: 'paid' })} onClose={vi.fn()} />);
    expect(amountInput().value).toBe('0.00');
  });
});
