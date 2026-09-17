// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { BillCaptureSummary } from '@kis-books/shared';
import { renderRoute } from '../../../test-utils';
import { aiMocks, companyMocks, passthroughMutation } from '../../../test-mocks';

const h = vi.hoisted(() => ({
  reprocess: vi.fn(),
  discard: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../../api/hooks/useAi', () => aiMocks());
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => h.navigate };
});

function row(over: Partial<BillCaptureSummary>): BillCaptureSummary {
  return {
    id: 'x', fileName: 'file.pdf', mimeType: 'application/pdf', source: 'staff', status: 'ready',
    createdAt: '2026-09-17T10:00:00Z', enteredAt: null, vendorName: null, contactId: null, contactName: null,
    suggestedContactId: null, suggestedContactName: null, total: null, billDate: null, vendorInvoiceNumber: null,
    confidence: null, isDuplicate: false, duplicateOfTransactionId: null, billId: null, billTxnNumber: null,
    billVoided: false, extractionSkippedReason: null, extractionError: null, uploadedByName: 'Sam',
    ...over,
  };
}

const captures: BillCaptureSummary[] = [
  row({ id: 'c1', fileName: 'acme-1001.pdf', status: 'ready', vendorName: 'Acme Supplies', contactId: 'v1', contactName: 'Acme Supplies', vendorInvoiceNumber: 'INV-1001', billDate: '2026-09-01', total: '120.50', isDuplicate: true, duplicateOfTransactionId: 't1' }),
  row({ id: 'c2', fileName: 'unknown-vendor.jpg', mimeType: 'image/jpeg', status: 'ready', vendorName: 'Zed Corp', source: 'portal', uploadedByName: 'Pat Client' }),
  row({ id: 'c3', fileName: 'done.pdf', status: 'entered', billId: 'b9', billTxnNumber: 'BILL-9', contactName: 'Acme Supplies' }),
  row({ id: 'c4', fileName: 'scan.pdf', status: 'ready', extractionSkippedReason: 'ai_consent_blocked' }),
  row({ id: 'c5', fileName: 'busy.pdf', status: 'processing' }),
];

vi.mock('../../../api/hooks/useBillCaptures', () => ({
  useBillCaptures: (filters: { status?: string }) => {
    const rows = filters.status ? captures.filter((c) => c.status === filters.status) : captures;
    return {
      data: { captures: rows, total: rows.length, counts: { received: 0, processing: 1, ready: 3, failed: 0, entered: 1, discarded: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    };
  },
  useUploadBillCaptures: passthroughMutation,
  useDiscardBillCapture: () => ({ mutate: h.discard, isPending: false, variables: undefined }),
  useReprocessBillCapture: () => ({ mutate: h.reprocess, isPending: false, variables: undefined }),
}));

import { BillCapturePage } from './BillCapturePage';

describe('BillCapturePage', () => {
  it('lists captures with status pills, vendor hints and the duplicate badge', () => {
    renderRoute(<BillCapturePage />, { route: '/bills/capture', path: '/bills/capture' });
    expect(screen.getByText('acme-1001.pdf')).toBeTruthy();
    expect(screen.getByText('Duplicate?')).toBeTruthy();
    expect(screen.getAllByText('Ready to review').length).toBeGreaterThan(0);
    expect(screen.getByText('Ready — not scanned')).toBeTruthy();
    expect(screen.getByText('Reading…')).toBeTruthy();
    expect(screen.getAllByText('Entered').length).toBeGreaterThan(1); // chip + pill
    // Unknown vendor is called out as new.
    expect(screen.getByText('Zed Corp')).toBeTruthy();
    expect(screen.getByText('(new)')).toBeTruthy();
    expect(screen.getByText('$120.50')).toBeTruthy();
    expect(screen.getByText('1 still reading…')).toBeTruthy();
  });

  it('opens the review screen from a row and the bill from an entered row', () => {
    renderRoute(<BillCapturePage />, { route: '/bills/capture', path: '/bills/capture' });
    fireEvent.click(screen.getByText('acme-1001.pdf'));
    expect(h.navigate).toHaveBeenCalledWith('/bills/capture/c1');
    const viewBill = screen.getByRole('button', { name: 'View bill' });
    fireEvent.click(viewBill);
    expect(h.navigate).toHaveBeenCalledWith('/bills/b9');
  });

  it('filters by status via the chips', () => {
    renderRoute(<BillCapturePage />, { route: '/bills/capture', path: '/bills/capture' });
    fireEvent.click(screen.getByRole('button', { name: /^Entered/ }));
    expect(screen.getByText('done.pdf')).toBeTruthy();
    expect(screen.queryByText('acme-1001.pdf')).toBeNull();
  });

  it('re-reads a failed or ready capture without navigating', () => {
    renderRoute(<BillCapturePage />, { route: '/bills/capture', path: '/bills/capture' });
    h.navigate.mockClear();
    const rereads = screen.getAllByTitle('Read this bill again from the file');
    fireEvent.click(rereads[0]!);
    expect(h.reprocess).toHaveBeenCalledWith('c1', expect.anything());
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
