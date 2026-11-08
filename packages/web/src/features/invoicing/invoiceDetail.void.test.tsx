// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Owner decision E3 (engine QA 2026-11-08): the engine refuses to void an
// invoice with payments applied (409 INVOICE_HAS_PAYMENTS). The Void dialog
// explains that up front, and shows the server's refusal instead of sitting
// silently.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  invoicesMocks, contactsMocks, accountsMocks, itemsMocks, companyMocks,
  tagsMocks, aiMocks, paymentsMocks, transactionsMocks, passthroughMutation,
} from '../../test-mocks';
import { ApiError } from '../../api/client';

const state = vi.hoisted(() => ({
  invoice: null as unknown,
  voidMutation: null as unknown,
}));

vi.mock('../../api/hooks/useInvoices', () => ({
  ...invoicesMocks(),
  useInvoice: () => ({ data: { invoice: state.invoice }, isLoading: false, isError: false, refetch: vi.fn() }),
  useVoidInvoice: () => state.voidMutation,
}));
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePayments', () => paymentsMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], total: 0 }) };
});

import { InvoiceDetailPage } from './InvoiceDetailPage';

const invoice = (p: Record<string, unknown>) => ({
  id: 'i1', txnType: 'invoice', contactId: 'c1', txnDate: '2026-11-03', txnNumber: '1043',
  invoiceStatus: 'sent', total: '100.0000', subtotal: '100.0000', taxAmount: '0.0000',
  amountPaid: '0.0000', balanceDue: '100.0000', lines: [], ...p,
});

const openVoid = () => {
  renderRoute(<InvoiceDetailPage />, { route: '/invoices/i1', path: '/invoices/:id' });
  fireEvent.click(screen.getByRole('button', { name: /Void/ }));
};

beforeEach(() => { state.voidMutation = passthroughMutation(); });

describe('Void invoice (E3)', () => {
  it('explains instead of offering Void when payments are applied', () => {
    state.invoice = invoice({ invoiceStatus: 'partial', amountPaid: '40.0000', balanceDue: '60.0000' });
    openVoid();
    expect(screen.getByRole('status').textContent).toMatch(/has payments applied, so it can't be voided yet\. Void the payments first/);
    const dialogButtons = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(dialogButtons).toContain('Close');
    // Only the page's own Void button remains; the dialog offers no Void.
    expect(dialogButtons.filter((t) => t === 'Void')).toHaveLength(1);
    expect(screen.queryByPlaceholderText('Reason...')).toBeNull();
    expect((state.voidMutation as { mutate: ReturnType<typeof vi.fn> }).mutate).not.toHaveBeenCalled();
  });

  it('shows the engine refusal when the void is rejected', () => {
    state.invoice = invoice({});
    state.voidMutation = {
      ...passthroughMutation(),
      isError: true,
      error: new ApiError('This invoice has payments or credits applied.', 'INVOICE_HAS_PAYMENTS', { payments: 0, credits: 1 }, 409),
    };
    openVoid();
    expect(screen.getByRole('alert').textContent).toBe(
      'This invoice still has 1 credit applied. Void those first (see Related Transactions on this page), then void the invoice.',
    );
  });

  it('still voids an unpaid invoice', () => {
    state.invoice = invoice({});
    openVoid();
    fireEvent.change(screen.getByPlaceholderText('Reason...'), { target: { value: 'Duplicate' } });
    const voids = screen.getAllByRole('button', { name: 'Void' });
    fireEvent.click(voids[voids.length - 1]!);
    expect((state.voidMutation as { mutate: ReturnType<typeof vi.fn> }).mutate)
      .toHaveBeenCalledWith({ id: 'i1', reason: 'Duplicate' }, expect.anything());
  });
});
