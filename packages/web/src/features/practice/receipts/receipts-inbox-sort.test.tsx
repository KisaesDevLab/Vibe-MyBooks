// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Receipts inbox: sort is server-side (the inbox paginates); the Status
// popover and the status select share one filter.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ activeCompanyId: 'co1', activeCompanyName: 'Test Co', companies: [] }),
}));

import { ReceiptsInboxPage } from './ReceiptsInboxPage';

const row = {
  id: 'r1', filename: 'lunch.jpg', status: 'unmatched', capturedAt: '2026-05-01T00:00:00.000Z', uploadedBy: 'c1',
  captureSource: 'portal', extractedVendor: 'Deli', extractedTotal: '12.5000', extractedDate: null,
  matchedTransactionId: null, matchScore: null, companyId: 'co1', companyName: 'Test Co',
};
const fetchMock = vi.fn();
const lastQuery = () => new URLSearchParams(String([...fetchMock.mock.calls].reverse().find((a) => String(a[0]).includes('/practice/receipts?'))?.[0]).split('?')[1]);

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ receipts: [row], total: 1 }) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('ReceiptsInboxPage — column sort and status filter', () => {
  it('sends the header sort to the server with the offset reset', async () => {
    renderRoute(<ReceiptsInboxPage />);
    await screen.findByText('lunch.jpg');
    expect(lastQuery().get('sortBy')).toBe('capturedAt');
    fireEvent.click(screen.getByRole('button', { name: /^vendor/i }));
    await waitFor(() => expect(lastQuery().get('sortBy')).toBe('extractedVendor'));
    expect(lastQuery().get('sortDir')).toBe('asc');
    expect(lastQuery().get('offset')).toBe('0');
    expect(JSON.parse(sessionStorage.getItem('vibe:receipts-inbox:view')!)).toMatchObject({ sortCol: 'extractedVendor' });
  });

  it('the Status popover mirrors the status select', async () => {
    renderRoute(<ReceiptsInboxPage />);
    await screen.findByText('lunch.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Unmatched'));   // untick the current one
    fireEvent.click(screen.getByLabelText('Dismissed'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(lastQuery().get('status')).toBe('dismissed'));
    expect((screen.getByDisplayValue('Dismissed') as HTMLSelectElement).value).toBe('dismissed');
  });
});
