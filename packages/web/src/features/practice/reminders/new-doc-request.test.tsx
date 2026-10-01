// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// One-off document request: New request on the Open requests tab creates
// and sends a single request (no standing rule).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('./RemindersPage', () => ({ api: (...args: unknown[]) => apiMock(...args) }));
vi.mock('../../../api/hooks/usePortalContacts', () => ({
  usePortalContacts: () => ({
    data: { contacts: [{ id: 'c1', firstName: 'Pat', lastName: 'Client', email: 'pat@example.com', phone: null }] },
  }),
}));
const flags = vi.hoisted(() => ({ DOC_REQUEST_SMS_V1: false, STATEMENT_AUTO_IMPORT_V1: false } as Record<string, boolean>));
vi.mock('../../../api/hooks/useFeatureFlag', () => ({ useFeatureFlag: (k: string) => flags[k] ?? false }));

import { DocumentRequestsTab } from './DocumentRequestsTab';
import { sendOutcomeMessage } from './NewDocRequestModal';

const posts = () => apiMock.mock.calls.filter((c) => c[0] === '/practice/document-requests' && c[1]?.method === 'POST');

beforeEach(() => {
  sessionStorage.clear();
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/company/users') return { users: [{ id: 'u1', email: 'kim@firm.com', displayName: 'Kim', userType: 'staff', isActive: true }] };
    if (path === '/practice/bank-connections') return { connections: [] };
    if (path === '/practice/document-requests' && init?.method === 'POST') return { requestId: 'd9', sendResult: 'sent' };
    return { items: [], total: 0 };
  });
});

describe('Open requests — New request', () => {
  it('creates and sends a one-time request with contact, description, period, due date and staff notify', async () => {
    renderRoute(<DocumentRequestsTab />);
    fireEvent.click(await screen.findByRole('button', { name: /new request/i }));
    const dialog = await screen.findByRole('dialog', { name: /new document request/i });
    expect(dialog).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Contact/), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/^What do you need\?/), { target: { value: '2025 Form 1098 from Chase' } });
    fireEvent.change(screen.getByLabelText('For period'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText(/^Due date/), { target: { value: '2026-10-15' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: /Kim/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    const body = JSON.parse(String(posts()[0]![1].body));
    expect(body).toMatchObject({
      contactId: 'c1', documentType: 'other', description: '2025 Form 1098 from Chase', periodLabel: '2025',
      dueDate: '2026-10-15', reminderChannel: 'email', notifyUserIds: ['u1'],
    });
    // No channel picker without the SMS flag, no routing for a non-statement.
    expect(body).not.toHaveProperty('statementRouting');
    expect(await screen.findByText('Request sent to Pat Client.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers the SMS channel and statement routing when those features are on', async () => {
    flags['DOC_REQUEST_SMS_V1'] = true;
    flags['STATEMENT_AUTO_IMPORT_V1'] = true;
    try {
      renderRoute(<DocumentRequestsTab />);
      fireEvent.click(await screen.findByRole('button', { name: /new request/i }));
      expect(screen.getByLabelText(/^Send by/)).toBeTruthy();
      expect(screen.queryByLabelText(/^When the statement arrives/)).toBeNull();
      fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'bank_statement' } });
      expect(screen.getByLabelText(/^When the statement arrives/)).toBeTruthy();
    } finally {
      flags['DOC_REQUEST_SMS_V1'] = false;
      flags['STATEMENT_AUTO_IMPORT_V1'] = false;
    }
  });

  it('says plainly when the request was created but not delivered', () => {
    expect(sendOutcomeMessage('sent', 'Pat').ok).toBe(true);
    expect(sendOutcomeMessage('suppressed', 'Pat')).toMatchObject({ ok: false, text: expect.stringMatching(/opted out/) });
    expect(sendOutcomeMessage('error', 'Pat')).toMatchObject({ ok: false, text: expect.stringMatching(/Remind now/) });
  });
});
