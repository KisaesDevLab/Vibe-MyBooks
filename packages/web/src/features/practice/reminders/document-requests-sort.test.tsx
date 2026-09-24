// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Document requests grid: sort is server-side (the grid paginates). No sort
// = the inbox order, so the first request carries no sortBy.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('./RemindersPage', () => ({ api: (...args: unknown[]) => apiMock(...args) }));

import { DocumentRequestsTab } from './DocumentRequestsTab';

const row = {
  id: 'd1', tenantId: 't1', companyId: null, recurringId: null, contactId: 'c1', contactEmail: 'pat@example.com', contactName: 'Pat Client',
  documentType: 'bank_statement', description: 'June statement', periodLabel: '2026-06', requestedAt: '2026-07-01T00:00:00.000Z',
  dueDate: null, status: 'pending', submittedAt: null, submittedReceiptId: null, submittedFilename: null, reviewedAt: null, unread: false,
  lastRemindedAt: null, lastOpenedAt: null, lastClickedAt: null, reminderSendCount: 0,
};
const lastQuery = () => new URLSearchParams(String([...apiMock.mock.calls].reverse().find((a) => String(a[0]).startsWith('/practice/document-requests?'))?.[0]).split('?')[1]);

beforeEach(() => {
  sessionStorage.clear();
  apiMock.mockReset();
  apiMock.mockResolvedValue({ items: [row], total: 1 });
});

describe('DocumentRequestsTab — column sort', () => {
  it('sends the header sort to the server with the offset reset', async () => {
    renderRoute(<DocumentRequestsTab />);
    await screen.findByText('Pat Client');
    expect(lastQuery().get('sortBy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^due/i }));
    await waitFor(() => expect(lastQuery().get('sortBy')).toBe('dueDate'));
    expect(lastQuery().get('sortDir')).toBe('desc');
    expect(lastQuery().get('offset')).toBe('0');
    expect(JSON.parse(sessionStorage.getItem('vibe:document-requests:view')!)).toMatchObject({ sortCol: 'dueDate' });
  });
});
