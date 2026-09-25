// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Client connection invites on Bank Connections: the list sits below the
// connections, and filters/paging are passed to the server query.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { bankingMocks, plaidMocks, passthroughQuery, passthroughMutation } from '../../test-mocks';
import type { BankConnectInviteFilters, BankConnectInviteRow } from '../../api/hooks/useBankConnectInvites';

vi.mock('../../api/hooks/useBanking', () => bankingMocks());
vi.mock('../../api/hooks/usePlaid', () => ({
  ...plaidMocks(),
  usePlaidItems: passthroughQuery({
    items: [{ id: 'item-1', institutionName: 'First Bank', itemStatus: 'active', accounts: [], hiddenAccountCount: 0, lastSyncAt: null }],
  }),
}));
vi.mock('../../api/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => true, useFeatureFlags: () => ({ data: {} }) }));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], connections: [] }) };
});

function row(i: number, over: Partial<BankConnectInviteRow> = {}): BankConnectInviteRow {
  return {
    id: `inv-${i}`, kind: 'connect', autoSent: false, recipientName: `Client ${i}`,
    recipientEmail: `c${i}@example.com`, recipientPhone: null, status: 'sent', sentVia: 'email',
    sentAt: '2026-09-19T12:00:00Z', expiresAt: '2026-09-26T12:00:00Z', viewedAt: null,
    connectedAt: null, connectedPlaidItemId: null, connectionsCount: 0, createdByName: null, ...over,
  };
}

const calls: BankConnectInviteFilters[] = [];
const all = Array.from({ length: 23 }, (_, i) => row(i + 1, i === 0 ? { recipientName: 'Harrish', kind: 'repair' } : {}));

vi.mock('../../api/hooks/useBankConnectInvites', () => ({
  useBankConnectInvites: (f: BankConnectInviteFilters) => {
    calls.push(f);
    let rows = all;
    if (f.kind) rows = rows.filter((r) => r.kind === f.kind);
    if (f.search) rows = rows.filter((r) => r.recipientName.toLowerCase().includes(f.search!.toLowerCase()));
    const offset = f.offset ?? 0;
    return { data: { invites: rows.slice(offset, offset + (f.limit ?? 50)), total: rows.length }, isLoading: false };
  },
  useResendBankConnectInvite: passthroughMutation,
  useRevokeBankConnectInvite: passthroughMutation,
}));

import { BankConnectionsPage } from './BankConnectionsPage';

describe('Client connection invites card', () => {
  beforeEach(() => { calls.length = 0; });

  it('renders below the bank connections', () => {
    renderRoute(<BankConnectionsPage />);
    const invites = screen.getByText('Client connection invites');
    const plaid = screen.getByText('Connected via Plaid');
    // eslint-disable-next-line no-bitwise
    expect(plaid.compareDocumentPosition(invites) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows 10 per page and pages through the rest', () => {
    renderRoute(<BankConnectionsPage />);
    expect(screen.getAllByText(/^Client \d+$|^Harrish$/)).toHaveLength(10);
    expect(screen.getByText(/Showing 1-10 of 23 invites/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(calls.at(-1)).toMatchObject({ limit: 10, offset: 10 });
  });

  it('passes type and search filters to the server query and can clear them', async () => {
    renderRoute(<BankConnectionsPage />);
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'repair' } });
    expect(calls.at(-1)).toMatchObject({ kind: 'repair', offset: 0 });
    expect(screen.getByText('Harrish')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'open' } });
    expect(calls.at(-1)).toMatchObject({ kind: 'repair', status: 'open' });

    fireEvent.change(screen.getByLabelText('Search invites'), { target: { value: 'nobody' } });
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ search: 'nobody' }));
    expect(screen.getByText('No invites match these filters.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getByText(/Showing 1-10 of 23 invites/)).toBeTruthy());
    expect(calls.at(-1)).not.toHaveProperty('kind');
  });
});
