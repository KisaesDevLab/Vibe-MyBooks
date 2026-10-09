// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocRequestRow } from './PortalDashboardPage';

afterEach(() => vi.unstubAllGlobals());

const base = {
  id: '33333333-3333-3333-3333-333333333333', description: 'September receipts', documentType: 'receipt_batch',
  periodLabel: 'Sept 2025', requestedAt: '2026-10-01T00:00:00Z', dueDate: null, status: 'pending',
};

describe('portal DocRequestRow (multi-file)', () => {
  it('uploads every picked file with keepOpen and no I\'m done until a file exists', async () => {
    const bodies: FormData[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      bodies.push(init!.body as FormData);
      return Promise.resolve(new Response(JSON.stringify({ id: 'x', duplicate: false }), { status: 201 }));
    }));
    const onUploaded = vi.fn();
    const { container } = render(<MemoryRouter><DocRequestRow req={{ ...base, files: [] }} companyId="co" onUploaded={onUploaded} onCompleted={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /I'm done/ })).toBeNull();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    const a = new File(['a'], 'a.pdf', { type: 'application/pdf' });
    const b = new File(['b'], 'b.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [a, b] } });
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(bodies).toHaveLength(2);
    expect(bodies.every((f) => f.get('keepOpen') === '1' && f.get('documentRequestId') === base.id)).toBe(true);
  });

  it('lists uploaded files and completes the request on I\'m done', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ fileCount: 2 }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const onCompleted = vi.fn();
    render(<MemoryRouter><DocRequestRow
      req={{ ...base, files: [
        { receiptId: 'r1', filename: 'a.pdf', uploadedAt: '2026-10-09T00:00:00Z' },
        { receiptId: 'r2', filename: 'b.pdf', uploadedAt: '2026-10-09T00:01:00Z' },
      ] }}
      companyId="co" onUploaded={vi.fn()} onCompleted={onCompleted}
    /></MemoryRouter>);
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText(/2 files uploaded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /I'm done/ }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(`/api/portal/document-requests/${base.id}/complete`);
  });
});
