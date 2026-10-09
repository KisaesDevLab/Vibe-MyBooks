// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PortalUploadsList } from './PortalUploadsList';

const rows = {
  receipt: [{ id: '11111111-1111-1111-1111-111111111111', filename: 'lunch.pdf', mimeType: 'application/pdf', status: 'pending_ocr', capturedAt: '2026-10-01T12:00:00Z', documentRequestId: null, requestDescription: null, requestPeriodLabel: null }],
  request: [{ id: '22222222-2222-2222-2222-222222222222', filename: 'september 2025.pdf', mimeType: 'application/pdf', status: 'statement_imported', capturedAt: '2026-10-09T13:01:00Z', documentRequestId: 'r1', requestDescription: 'Sept 2025 Amex statement', requestPeriodLabel: 'Sept 2025' }],
};

afterEach(() => vi.unstubAllGlobals());

describe('PortalUploadsList', () => {
  it('lists receipts by default, switches to requested documents, and previews a file', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify({
      receipts: url.includes('kind=request') ? rows.request : rows.receipt,
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    render(<PortalUploadsList companyId="co-1" />);
    await waitFor(() => expect(screen.getByText('lunch.pdf')).toBeTruthy());
    expect(fetchMock.mock.calls[0]![0]).toContain('kind=receipt');

    fireEvent.click(screen.getByRole('tab', { name: 'Requested documents' }));
    await waitFor(() => expect(screen.getByText('september 2025.pdf')).toBeTruthy());
    expect(screen.getByText(/Sept 2025 Amex statement/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Preview september 2025.pdf' }));
    const frame = screen.getByTitle('september 2025.pdf') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toContain('/api/portal/receipts/22222222-2222-2222-2222-222222222222/file?inline=1');
  });
});
