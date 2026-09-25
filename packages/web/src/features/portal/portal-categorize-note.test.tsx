// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PORTAL_CATEGORIZE_V1 — the client's note.
//
// The note is not an accessory to the category, it is often the whole answer:
// a client who cannot name an account can nearly always say what the payment
// was for. So the box is never gated on picking a category, a note on its own
// is a valid submission, and a row the server turns down says why instead of
// disappearing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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

import { PortalCategorizePage, describeSaveFailure } from './PortalCategorizePage';

const unanswered = {
  targetKind: 'bank_feed_item',
  targetId: 'feed-1',
  date: '2026-08-28',
  description: 'MYSTERY VENDOR',
  bankDescription: 'POS DEBIT 1234 MYSTERY VENDOR CARD 9876',
  amount: '42.50',
  direction: 'money_out',
  existingSuggestion: null,
  myAttachmentCount: 0,
};

const answered = {
  targetKind: 'transaction',
  targetId: 'txn-1',
  date: '2026-08-14',
  description: 'Check 1748 - Ultimate Wellness',
  amount: '150.50',
  direction: 'money_out',
  existingSuggestion: {
    id: 'sug-1', status: 'pending', label: 'Not sure',
    note: 'Deposit for the Miller job', rejectionReason: null,
  },
  myAttachmentCount: 0,
};

const categories = [{ id: 'acct-rent', label: 'Rent', group: 'Money out', hint: null }];

const fetchMock = vi.fn();
const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

/** Queue + categories on load; anything else is the submit. */
function wireLoad(items: unknown[], submit?: unknown) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return ok(submit ?? { accepted: [], failed: [] });
    if (String(url).includes('/queue')) return ok({ featureEnabled: true, items, total: items.length });
    if (String(url).includes('/categories')) return ok({ featureEnabled: true, categories });
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

describe('portal categorize — the client note', () => {
  it('shows the bank\'s own wording under the cleaned name', async () => {
    wireLoad([unanswered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    expect(screen.getByText('On your statement:')).toBeTruthy();
    expect(screen.getByText(/POS DEBIT 1234 MYSTERY VENDOR CARD 9876/)).toBeTruthy();
  });

  it('offers the note box without needing a category first', async () => {
    wireLoad([unanswered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    expect(screen.getByPlaceholderText(/add a note for your bookkeeper/i)).toBeTruthy();
  });

  it('sends a note with no category as "I am not sure"', async () => {
    wireLoad([unanswered], { accepted: ['feed-1'], failed: [] });
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));

    fireEvent.change(screen.getByPlaceholderText(/add a note for your bookkeeper/i), {
      target: { value: 'Parts for the Henderson repair' },
    });
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: /save all/i })));

    await waitFor(() => expect(submitBody().items).toHaveLength(1));
    const [item] = submitBody().items;
    expect(item.categoryId).toBe('not_sure');
    expect(item.note).toBe('Parts for the Henderson repair');
    expect(item.targetId).toBe('feed-1');
  });

  it('refuses to send "not sure" with no note, and says why', async () => {
    wireLoad([unanswered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'not_sure' } });
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: /save all/i })));

    await waitFor(() => expect(screen.getByText(/add a note saying what you do know/i)).toBeTruthy());
    // Nothing was posted.
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('tells the client when the server turned a row down, and keeps the draft', async () => {
    wireLoad([unanswered], { accepted: [], failed: [{ targetId: 'feed-1', reason: 'not_found' }] });
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));

    fireEvent.change(screen.getByPlaceholderText(/add a note for your bookkeeper/i), {
      target: { value: 'Fuel for the truck' },
    });
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: /save all/i })));

    await waitFor(() => expect(screen.getByText(/did not go through/i)).toBeTruthy());
    expect(screen.getAllByText(/no longer on your list/i).length).toBeGreaterThan(0);
    // The typed note survives so nothing the client wrote is thrown away.
    await waitFor(() => {
      const box = screen.getByPlaceholderText(/add a note for your bookkeeper/i) as HTMLTextAreaElement;
      expect(box.value).toBe('Fuel for the truck');
    });
  });

  it('reads an already-sent note back to the client', async () => {
    wireLoad([answered]);
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText(/Check 1748/));
    expect(screen.getByText(/Deposit for the Miller job/)).toBeTruthy();
  });

  it('saves one card on its own with the card\'s Save button', async () => {
    const second = { ...unanswered, targetId: 'feed-2', description: 'OTHER VENDOR' };
    wireLoad([unanswered, second], { accepted: ['feed-1'], failed: [] });
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    const notes = screen.getAllByPlaceholderText(/add a note for your bookkeeper/i);
    fireEvent.change(notes[0]!, { target: { value: 'Paint for the shop' } });
    fireEvent.change(notes[1]!, { target: { value: 'Still thinking' } });
    fireEvent.click(screen.getAllByRole('button', { name: /save answer/i })[0]!);
    await waitFor(() => expect(submitBody().items).toHaveLength(1));
    expect(submitBody().items[0]).toMatchObject({ targetId: 'feed-1', note: 'Paint for the shop' });
    // The other card's draft is untouched.
    await waitFor(() => expect(screen.getByDisplayValue('Still thinking')).toBeTruthy());
  });

  it('says why a save failed and keeps the list and the draft', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ error: { code: 'PREVIEW_READ_ONLY' } }) } as Response);
      }
      if (String(url).includes('/queue')) return ok({ featureEnabled: true, items: [unanswered], total: 1 });
      if (String(url).includes('/categories')) return ok({ featureEnabled: true, categories });
      return ok({});
    });
    renderRoute(<PortalCategorizePage />);
    await waitFor(() => screen.getByText('MYSTERY VENDOR'));
    fireEvent.change(screen.getByPlaceholderText(/add a note for your bookkeeper/i), { target: { value: 'Paint' } });
    fireEvent.click(screen.getByRole('button', { name: /save answer/i }));
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toMatch(/staff preview/i);
    expect(screen.getByText('MYSTERY VENDOR')).toBeTruthy();
    expect(screen.getByDisplayValue('Paint')).toBeTruthy();
    expect(screen.queryByText(/could not send your answers/i)).toBeNull();
  });
});

describe('describeSaveFailure', () => {
  it('names the real cause', () => {
    expect(describeSaveFailure(401)).toMatch(/signed out/i);
    expect(describeSaveFailure(403, 'PREVIEW_READ_ONLY')).toMatch(/preview/i);
    expect(describeSaveFailure(429)).toMatch(/wait a minute/i);
    expect(describeSaveFailure(500)).toMatch(/still here/i);
  });
});
