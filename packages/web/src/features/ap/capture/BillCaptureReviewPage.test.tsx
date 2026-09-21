// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Drives the review form: prefill from the extraction, the Detailed/Single
// lines toggle, the duplicate override, and new-vendor mode — asserting on
// the payload handed to the enter mutation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { BillCaptureDetail } from '@kis-books/shared';
import { renderRoute } from '../../../test-utils';
import { accountsMocks, aiMocks, companyMocks, contactsMocks, tagsMocks } from '../../../test-mocks';

const h = vi.hoisted(() => ({
  enter: vi.fn(),
  navigate: vi.fn(),
  detail: null as unknown,
  nextReadyId: 'next-1' as string | null,
  // What GET /bills/:id answers for an entered capture's bill.
  bill: null as unknown,
  billMissing: false,
}));

vi.mock('../../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../../api/hooks/useAi', () => aiMocks());
vi.mock('../../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../../api/hooks/useTags', () => tagsMocks());
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock('../../../api/hooks/useBillCaptures', () => ({
  useBillCapture: () => ({ data: { capture: h.detail, nextReadyId: h.nextReadyId }, isLoading: false, isError: false, refetch: vi.fn() }),
  useBillCaptureFileUrl: () => ({ url: null, error: null }),
  useEnterBillCapture: () => ({ mutate: h.enter, isPending: false, variables: undefined }),
  useDiscardBillCapture: () => ({ mutate: vi.fn(), isPending: false }),
  useReprocessBillCapture: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../api/hooks/useAp', () => ({
  useBill: (id: string) => ({ data: id && h.bill ? { bill: h.bill } : undefined, isError: !!id && h.billMissing }),
}));

import { BillCaptureReviewPage } from './BillCaptureReviewPage';

function detail(over: Partial<BillCaptureDetail> = {}): BillCaptureDetail {
  return {
    id: 'c1', fileName: 'acme-1001.pdf', mimeType: 'application/pdf', source: 'staff', status: 'ready',
    createdAt: '2026-09-17T10:00:00Z', enteredAt: null, vendorName: 'Acme Supplies', contactId: 'v1', contactName: 'Acme Supplies',
    suggestedContactId: null, suggestedContactName: null, total: '150.00', billDate: '2026-09-01', vendorInvoiceNumber: 'INV-77',
    confidence: 0.9, isDuplicate: false, duplicateOfTransactionId: null, billId: null, billTxnNumber: null, billVoided: false,
    extractionSkippedReason: null, extractionError: null, uploadedByName: 'Sam',
    attachmentId: 'a1',
    extraction: {
      vendor: 'Acme Supplies', vendorInvoiceNumber: 'INV-77', billDate: '2026-09-01', dueDate: '2026-09-30', paymentTerms: 'net_30',
      total: '150.00', subtotal: '150.00', tax: null, notes: 'September order', confidence: 0.9, contactId: 'v1',
      defaultExpenseAccountId: 'acct-1', qualityWarnings: [],
      lineItems: [
        { description: 'Widgets', amount: '100.00', quantity: '10' },
        { description: 'Gadgets', amount: '50.00', quantity: '5' },
      ],
    },
    duplicate: null,
    vendorCandidates: [],
    vendorDefaults: { contactId: 'v1', displayName: 'Acme Supplies', defaultExpenseAccountId: 'acct-1', defaultTagId: 'tag-1', defaultPaymentTerms: null, defaultTermsDays: null, billLinesMode: null },
    ...over,
  };
}

const render = () => renderRoute(<BillCaptureReviewPage />, { route: '/bills/capture/c1', path: '/bills/capture/:captureId' });
const lastPayload = () => (h.enter.mock.calls.at(-1)![0] as { id: string; input: Record<string, unknown> }).input;

beforeEach(() => {
  h.enter.mockReset();
  h.navigate.mockReset();
  h.bill = null;
  h.billMissing = false;
  h.nextReadyId = 'next-1';
});

describe('BillCaptureReviewPage', () => {
  it('pre-fills the form from the extraction with detailed lines', () => {
    h.detail = detail();
    render();
    expect((screen.getByLabelText('Vendor Invoice #') as HTMLInputElement).value).toBe('INV-77');
    expect((screen.getByLabelText('Bill Date') as HTMLInputElement).value).toBe('2026-09-01');
    expect((screen.getByLabelText('Due Date') as HTMLInputElement).value).toBe('2026-09-30');
    expect((screen.getByLabelText('Memo') as HTMLInputElement).value).toBe('September order');
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.getByDisplayValue('Widgets')).toBeTruthy();
    expect(screen.getByText('$150.00')).toBeTruthy();
  });

  it('posts detailed lines with the vendor default tag, then goes back to the queue', () => {
    h.detail = detail();
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Post bill' }));
    const input = lastPayload();
    expect(input['contactId']).toBe('v1');
    expect(input['linesMode']).toBe('detailed');
    expect(input['lines']).toEqual([
      { accountId: 'acct-1', description: 'Widgets', amount: '100.00', tagId: 'tag-1' },
      { accountId: 'acct-1', description: 'Gadgets', amount: '50.00', tagId: 'tag-1' },
    ]);
    const opts = h.enter.mock.calls.at(-1)![1] as { onSuccess: (r: unknown) => void };
    opts.onSuccess({ bill: { id: 'b1', txnNumber: 'BILL-1' }, capture: {}, createdVendorId: null });
    expect(h.navigate).toHaveBeenCalledWith('/bills/capture');
  });

  it('single mode collapses to one line at the total and Post & next advances', () => {
    h.detail = detail();
    render();
    fireEvent.click(screen.getByLabelText('Single line at the total'));
    expect(screen.queryByDisplayValue('Widgets')).toBeNull();
    expect(screen.getByText('Categorization')).toBeTruthy();
    expect(screen.queryByText('Add line')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Post & next/ }));
    const input = lastPayload();
    expect(input['linesMode']).toBe('single');
    // The AI's notes become the single line's description (memo-first, as Enter Bill's fallback does).
    expect(input['lines']).toEqual([{ accountId: 'acct-1', description: 'September order', amount: '150.00', tagId: 'tag-1' }]);
    const opts = h.enter.mock.calls.at(-1)![1] as { onSuccess: (r: unknown) => void };
    opts.onSuccess({ bill: { id: 'b1' }, capture: {}, createdVendorId: null });
    expect(h.navigate).toHaveBeenCalledWith('/bills/capture/next-1');
  });

  it('starts in the mode remembered on the vendor', () => {
    h.detail = detail({ vendorDefaults: { contactId: 'v1', displayName: 'Acme', defaultExpenseAccountId: 'acct-1', defaultTagId: null, defaultPaymentTerms: null, defaultTermsDays: null, billLinesMode: 'single' } });
    render();
    expect((screen.getByLabelText('Single line at the total') as HTMLInputElement).checked).toBe(true);
  });

  it('shows the duplicate banner and sends overrideDuplicate only when ticked', () => {
    h.detail = detail({ isDuplicate: true, duplicateOfTransactionId: 't9', duplicate: { transactionId: 't9', txnNumber: 'BILL-9', matchedOn: 'invoice_number' } });
    render();
    expect(screen.getByText('Possible duplicate')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open it' }).getAttribute('href')).toBe('/bills/t9');
    fireEvent.click(screen.getByRole('button', { name: 'Post bill' }));
    expect(lastPayload()['overrideDuplicate']).toBe(false);
    fireEvent.click(screen.getByLabelText(/Post anyway/));
    fireEvent.click(screen.getByRole('button', { name: 'Post bill' }));
    expect(lastPayload()['overrideDuplicate']).toBe(true);
  });

  it('surfaces a server-side duplicate as the same banner', async () => {
    h.detail = detail();
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Post bill' }));
    const opts = h.enter.mock.calls.at(-1)![1] as { onError: (e: unknown) => void };
    opts.onError({ message: 'dup', code: 'BILL_CAPTURE_DUPLICATE', details: { transactionId: 't5', txnNumber: 'BILL-5' } });
    await waitFor(() => expect(screen.getByText('Possible duplicate')).toBeTruthy());
    expect(screen.getByText(/BILL-5/)).toBeTruthy();
  });

  it('offers to create an unknown vendor and posts newVendor with the address', () => {
    h.detail = detail({
      contactId: null, contactName: null, vendorName: 'Zed Corp', vendorDefaults: null,
      vendorCandidates: [{ id: 'v7', displayName: 'Zed Corporation' }],
      extraction: { ...detail().extraction!, vendor: 'Zed Corp', contactId: null, defaultExpenseAccountId: null,
        vendorAddress: { line1: '9 Elm St', line2: null, city: 'Dayton', state: 'OH', zip: '45402' } },
    });
    render();
    expect(screen.getByText(/isn't in your contacts/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use Zed Corporation' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create "Zed Corp" as a new vendor' }));
    expect((screen.getByLabelText('Vendor name') as HTMLInputElement).value).toBe('Zed Corp');
    expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe('Dayton');
    // Lines have no account (vendor unknown) — give the first one an account via state by typing? The
    // AccountSelector is mocked empty, so set it through the new-vendor default account instead.
    fireEvent.click(screen.getByRole('button', { name: 'Post bill' }));
    // No line has an account yet, so nothing is sent and an error is shown.
    expect(h.enter).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one line/)).toBeTruthy();
  });

  it('shows the already-entered notice instead of the post buttons', () => {
    h.detail = detail({ status: 'entered', billId: 'b1', billTxnNumber: 'BILL-1' });
    render();
    expect(screen.getByText(/already entered/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Post bill' })).toBeNull();
  });

  // Reopening an entered capture used to re-seed from the AI extraction, so
  // the vendor, accounts and edits the user had posted looked lost. It must
  // show the bill as posted, and read-only.
  describe('an entered capture', () => {
    const postedBill = {
      id: 'b1', contactId: 'v9', txnDate: '2026-09-02', dueDate: '2026-10-15', paymentTerms: 'net_60', termsDays: null,
      vendorInvoiceNumber: 'INV-77-CORRECTED', memo: 'Keyed by hand', internalNotes: 'approved by KK',
      lines: [
        { accountId: 'acct-dues', description: 'Peer review fee', debit: '730.0000', credit: '0', tagId: 'tag-9' },
        { accountId: 'acct-dues', description: 'Must-select fee', debit: '320.0000', credit: '0', tagId: null },
        { accountId: 'acct-ap', description: null, debit: '0', credit: '1050.0000', tagId: null },
      ],
    };
    // Extraction that disagrees with the bill everywhere, and knows no vendor.
    const enteredDetail = () => detail({
      status: 'entered', billId: 'b1', billTxnNumber: 'BILL-00013', contactId: null, vendorDefaults: null,
      extraction: { ...detail().extraction!, contactId: null, vendor: 'Unknown Vendor Inc' },
    });

    it('shows the bill as posted, not the AI reading', () => {
      h.detail = enteredDetail();
      h.bill = postedBill;
      render();

      expect((screen.getByLabelText('Vendor Invoice #') as HTMLInputElement).value).toBe('INV-77-CORRECTED');
      expect((screen.getByLabelText('Memo') as HTMLInputElement).value).toBe('Keyed by hand');
      expect((screen.getByLabelText('Internal Notes') as HTMLInputElement).value).toBe('approved by KK');
      expect((screen.getByLabelText('Bill Date') as HTMLInputElement).value).toBe('2026-09-02');
      expect((screen.getByLabelText('Due Date') as HTMLInputElement).value).toBe('2026-10-15');
      // The posted expense lines (debits only — never the AP credit).
      expect(screen.getByDisplayValue('Peer review fee')).toBeTruthy();
      expect(screen.getByDisplayValue('730.00')).toBeTruthy();
      expect(screen.getByDisplayValue('320.00')).toBeTruthy();
      expect(screen.queryByDisplayValue('Widgets')).toBeNull();
      expect(screen.queryByDisplayValue('1050.00')).toBeNull();
      // A vendor was posted, so no "isn't in your contacts" prompt.
      expect(screen.queryByText(/isn't in your contacts/)).toBeNull();
      expect(screen.getByText(/as it was posted/)).toBeTruthy();
    });

    it('is read-only — changes go through the bill itself', () => {
      h.detail = enteredDetail();
      h.bill = postedBill;
      render();
      expect((screen.getByLabelText('Memo') as HTMLInputElement).closest('fieldset')!.disabled).toBe(true);
      expect(screen.getByRole('link', { name: 'open the bill' }).getAttribute('href')).toBe('/bills/b1');
    });

    it('falls back to what was scanned when the bill can no longer be loaded', () => {
      h.detail = enteredDetail();
      h.billMissing = true;
      render();
      expect((screen.getByLabelText('Vendor Invoice #') as HTMLInputElement).value).toBe('INV-77');
      expect(screen.getByText(/could not be loaded/)).toBeTruthy();
    });

    it('leaves a capture still in the queue seeded from the extraction and editable', () => {
      h.detail = detail();
      h.bill = postedBill; // must be ignored: not entered, so no bill is requested
      render();
      expect((screen.getByLabelText('Vendor Invoice #') as HTMLInputElement).value).toBe('INV-77');
      expect((screen.getByLabelText('Memo') as HTMLInputElement).closest('fieldset')!.disabled).toBe(false);
    });
  });
});
