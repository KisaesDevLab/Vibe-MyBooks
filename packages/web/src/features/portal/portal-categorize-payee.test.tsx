// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The client can say WHO a row was paid to or came from: a contact from the
// sanitized payee list, or a typed name. A payee on its own is a complete
// answer (sent as "not sure" with the payee), and an answered row reads the
// payee back.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

vi.mock('./PortalLayout', () => ({
  usePortal: () => ({
    me: {
      contact: {
        id: 'c1', email: 'client@example.com', firstName: 'Cli', lastName: 'Ent',
        companies: [{
          companyId: 'co1', companyName: 'Co One', role: 'owner', assignable: true,
          financialsAccess: true, filesAccess: true, questionsForUsAccess: true,
          bankingAccess: false, billPayAccess: false, categorizeAccess: true,
        }],
      },
      preview: null,
    },
    activeCompanyId: 'co1',
    fullName: 'Cli Ent',
    refresh: async () => {},
  }),
}));

import { PortalCategorizePage } from './PortalCategorizePage';

const unanswered = {
  targetKind: 'bank_feed_item',
  targetId: 'feed-1',
  date: '2026-08-28',
  description: 'MYSTERY VENDOR',
  bankDescription: null,
  amount: '42.50',
  direction: 'money_out',
  existingSuggestion: null,
  myAttachmentCount: 0,
};

const answered = {
  ...unanswered,
  targetKind: 'transaction',
  targetId: 'txn-1',
  description: 'Check 1748',
  existingSuggestion: {
    id: 'sug-1', status: 'pending', label: 'Not sure', note: null,
    payeeLabel: 'Ultimate Wellness', rejectionReason: null,
  },
};

const categories = [{ id: 'acct-rent', label: 'Rent', group: 'Money out', hint: null }];
const payees = [
  { id: 'ct-hd', label: 'Home Depot', kind: 'vendor' },
  { id: 'ct-wh', label: 'Wallace Harner', kind: 'customer' },
];

const fetchMock = vi.fn();
const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

function wireLoad(items: unknown[], submit?: unknown) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return ok(submit ?? { accepted: ['feed-1'], failed: [] });
    if (String(url).includes('/queue')) return ok({ featureEnabled: true, items, total: items.length });
    if (String(url).includes('/categories')) return ok({ featureEnabled: true, categories });
    if (String(url).includes('/payees')) return ok({ featureEnabled: true, payees });
    return ok({});
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BASE_URL', '/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function submitBody() {
  const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
  return JSON.parse((call![1] as RequestInit).body as string);
}

describe('portal categorize — the payee', () => {
  it('offers every contact grouped by kind; a payee alone sends as "not sure" with the contact', async () => {
    wireLoad([unanswered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    const payee = screen.getByLabelText('Who was it paid to or from?') as HTMLSelectElement;
    expect(payee.querySelector('optgroup[label="Vendors"] option[value="ct-hd"]')).toBeTruthy();
    expect(payee.querySelector('optgroup[label="Customers"] option[value="ct-wh"]')).toBeTruthy();

    fireEvent.change(payee, { target: { value: 'ct-hd' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(true));
    const body = submitBody();
    expect(body.items[0]).toMatchObject({ targetId: 'feed-1', categoryId: 'not_sure', contactId: 'ct-hd' });
    expect(body.items[0].contactLabel).toBeUndefined();
    // No "add a note" notice: the payee is the answer.
    expect(screen.queryByText(/add a note/i)).toBeNull();
  });

  it('"Someone not in this list…" reveals a name box and sends the typed name', async () => {
    wireLoad([unanswered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    fireEvent.change(screen.getByLabelText('Who was it paid to or from?'), { target: { value: '__other' } });
    const name = screen.getByLabelText('Their name');
    fireEvent.change(name, { target: { value: 'Joe the plumber' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(true));
    expect(submitBody().items[0]).toMatchObject({ categoryId: 'not_sure', contactLabel: 'Joe the plumber' });
    expect(submitBody().items[0].contactId).toBeUndefined();
  });

  it('still asks for a note when "I am not sure" has neither a note nor a payee', async () => {
    wireLoad([unanswered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'not_sure' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText(/add a note saying what you do know, or say who it was paid to/i)).toBeTruthy();
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('reads the payee back on an answered row', async () => {
    wireLoad([answered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('Check 1748'));
    expect(screen.getByText('Ultimate Wellness')).toBeTruthy();
    expect(screen.getByText(/paid to\/from/i)).toBeTruthy();
  });
});
