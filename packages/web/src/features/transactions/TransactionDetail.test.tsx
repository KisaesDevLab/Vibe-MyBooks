// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { RelatedTransactionsResult, Transaction } from '@kis-books/shared';
import { renderRoute } from '../../test-utils';
import { transactionsMocks } from '../../test-mocks';

const state: { txn: Partial<Transaction> | null; related: RelatedTransactionsResult } = {
  txn: null,
  related: { related: [], truncated: false },
};

vi.mock('../../api/hooks/useTransactions', () => ({
  ...transactionsMocks(),
  useTransaction: () => ({ data: state.txn ? { transaction: state.txn } : undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useRelatedTransactions: () => ({ data: state.related, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ activeCompanyId: 'company-1', activeCompanyName: 'Test Co', companies: [] }),
}));
vi.mock('../../api/hooks/usePortalQuestions', () => ({
  useCreateQuestion: () => ({ mutate: vi.fn(), isPending: false }),
}));
// AttachmentPanel has its own tests; here it would only add network noise.
vi.mock('../attachments/AttachmentPanel', () => ({
  AttachmentPanel: ({ attachableType }: { attachableType: string }) => <div data-testid="attachments">{attachableType}</div>,
}));

import { TransactionDetail } from './TransactionDetail';

const base: Partial<Transaction> = {
  id: '11111111-1111-4111-8111-111111111111', tenantId: 't', status: 'posted', txnDate: '2026-09-10',
  taxAmount: '0', amountPaid: '0', lines: [],
};

const render = () => renderRoute(<TransactionDetail />, { route: `/transactions/${base.id}`, path: '/transactions/:id' });

beforeEach(() => {
  state.txn = null;
  state.related = { related: [], truncated: false };
});
afterEach(() => vi.unstubAllGlobals());

describe('TransactionDetail', () => {
  it('shows a bill with its vendor, vendor invoice number and bill status', () => {
    state.txn = {
      ...base, txnType: 'bill', txnNumber: 'BILL-00012', contactName: 'Spire', vendorInvoiceNumber: '4394722222',
      dueDate: '2026-09-28', billStatus: 'paid', total: '68.9500', balanceDue: '0',
    };
    render();
    // Was "bill #BILL-00012": the label map had no entry for bills.
    expect(screen.getByRole('heading', { name: 'Bill #BILL-00012' })).toBeInTheDocument();
    expect(screen.getByText('Vendor:')).toBeInTheDocument();
    expect(screen.getByText('Spire')).toBeInTheDocument();
    expect(screen.getByText('Vendor invoice #:')).toBeInTheDocument();
    expect(screen.getByText('4394722222')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('shows a check with its payee, check number and the memo printed on it', () => {
    state.txn = {
      ...base, txnType: 'expense', contactName: 'City Water', total: '40.00',
      checkNumber: 1042, printStatus: 'printed', printedMemo: 'Acct 00-4471-A',
    };
    render();
    expect(screen.getByRole('heading', { name: 'Check #1042' })).toBeInTheDocument();
    expect(screen.getByText('Payee:')).toBeInTheDocument();
    expect(screen.getByText('Check #:')).toBeInTheDocument();
    expect(screen.getByText('Payment method:')).toBeInTheDocument();
    expect(screen.getByText('Acct 00-4471-A')).toBeInTheDocument();
  });

  it('shows a bill payment with method, reference, bank account and the bill it paid', () => {
    state.txn = {
      ...base, txnType: 'bill_payment', contactName: 'Spire', total: '68.95', paymentMethod: 'ach', referenceNumber: 'ACH-7781',
      bankAccounts: [{ accountId: 'a', name: 'Cash in Bank - Operating', accountNumber: '1060', side: 'from' }],
    };
    state.related = {
      truncated: false,
      related: [{
        id: '22222222-2222-4222-8222-222222222222', txnType: 'bill', txnNumber: 'BILL-00012', txnDate: '2026-09-10', status: 'posted',
        contactName: 'Spire', total: '68.95', relation: 'paid_bill', appliedAmount: '68.95', checkNumber: null,
        paymentMethod: null, referenceNumber: null, vendorInvoiceNumber: '4394722222', attachmentCount: 1,
      }],
    };
    render();
    expect(screen.getByText('ACH')).toBeInTheDocument();
    expect(screen.getByText('ACH-7781')).toBeInTheDocument();
    expect(screen.getByText('Cash in Bank - Operating (1060)')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Bill #BILL-00012' });
    expect(link).toHaveAttribute('href', '/bills/22222222-2222-4222-8222-222222222222');
    expect(screen.getByText('Bill paid')).toBeInTheDocument();
  });

  it("looks for an AJE's attachments where they are stored", () => {
    state.txn = { ...base, txnType: 'aje', ajeNumber: 3 };
    render();
    expect(screen.getByTestId('attachments')).toHaveTextContent('journal_entry');
  });

  it('reports a failed Transaction Report instead of leaving a blank tab open', async () => {
    state.txn = { ...base, txnType: 'bill', txnNumber: 'BILL-1' };
    const tab = { document: { title: '' }, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => tab));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ error: { message: 'Chromium failed to start' } }),
    }));
    render();
    fireEvent.click(screen.getByRole('button', { name: /Transaction Report/ }));
    await waitFor(() => expect(screen.getByText('Chromium failed to start')).toBeInTheDocument());
    expect(tab.close).toHaveBeenCalled();
  });
});
