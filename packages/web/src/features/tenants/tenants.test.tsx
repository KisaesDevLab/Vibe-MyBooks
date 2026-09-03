// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, act } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

// lastAccessedAt is distinct and ordered so the page's default sort
// (lastAccessed, descending) does NOT already match backlog order — otherwise
// the sort test would pass without the click doing anything.
const TENANTS = [
  { tenantId: 't1', tenantName: 'Busy Client', role: 'accountant', lastAccessedAt: '2026-08-01T00:00:00.000Z' },
  { tenantId: 't2', tenantName: 'Quiet Client', role: 'accountant', lastAccessedAt: '2026-08-03T00:00:00.000Z' },
  { tenantId: 't3', tenantName: 'No Bank Client', role: 'accountant', lastAccessedAt: '2026-08-02T00:00:00.000Z' },
];

const BANKING = [
  { tenantId: 't1', unprocessedBankTxns: 206, lastPlaidSyncAt: '2026-08-27T15:10:13.000Z', plaidConnectionCount: 2, plaidNeedsAttention: false },
  { tenantId: 't2', unprocessedBankTxns: 0, lastPlaidSyncAt: '2026-08-25T05:50:38.000Z', plaidConnectionCount: 1, plaidNeedsAttention: true },
  { tenantId: 't3', unprocessedBankTxns: 0, lastPlaidSyncAt: null, plaidConnectionCount: 0, plaidNeedsAttention: false },
];

// Mutable so one test can put the banking query into its failed state.
const bankingResult = {
  data: { data: BANKING } as { data: typeof BANKING } | undefined,
  isPending: false,
  isError: false,
};

// Document-request attention icons: t1 has both signals, t2 only overdue,
// t3 nothing (and so must render neither icon).
const ACTIVITY = [
  { tenantId: 't1', unreadSubmissions: 2, overdueDocRequests: 1 },
  { tenantId: 't2', unreadSubmissions: 0, overdueDocRequests: 3 },
  { tenantId: 't3', unreadSubmissions: 0, overdueDocRequests: 0 },
];

vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => ({ data: { accessibleTenants: TENANTS, activeTenantId: 't1' }, isPending: false }),
  useClientBankingStatus: () => bankingResult,
  useClientPortalActivity: () => ({ data: { data: ACTIVITY }, isPending: false, isError: false }),
}));
vi.mock('../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ clearActiveCompany: vi.fn() }),
}));

import { ClientSwitcherPage } from './ClientSwitcherPage';

const rowFor = (name: string) => screen.getByText(name).closest('tr')!;

afterEach(() => {
  bankingResult.data = { data: BANKING };
  bankingResult.isPending = false;
  bankingResult.isError = false;
});

describe('ClientSwitcherPage document-request icons', () => {
  it('shows an unread-submissions badge and an overdue badge with counts', () => {
    renderRoute(<ClientSwitcherPage />);
    const busy = rowFor('Busy Client');
    expect(within(busy).getByLabelText('2 unread client submissions')).toHaveTextContent('2');
    expect(within(busy).getByLabelText('1 document requests past due')).toHaveTextContent('1');
  });

  it('shows only the overdue badge when nothing is unread', () => {
    renderRoute(<ClientSwitcherPage />);
    const row = rowFor(TENANTS[1]!.tenantName);
    expect(within(row).queryByLabelText(/unread client submissions/)).toBeNull();
    expect(within(row).getByLabelText('3 document requests past due')).toBeTruthy();
  });

  it('renders no badge at all for a client with nothing waiting', () => {
    renderRoute(<ClientSwitcherPage />);
    const row = rowFor(TENANTS[2]!.tenantName);
    expect(within(row).queryByLabelText(/unread client submissions/)).toBeNull();
    expect(within(row).queryByLabelText(/past due/)).toBeNull();
  });
});

describe('ClientSwitcherPage banking columns', () => {
  it('shows each client’s unprocessed bank-transaction count', () => {
    renderRoute(<ClientSwitcherPage />);
    expect(within(rowFor('Busy Client')).getByText('206')).toBeTruthy();
  });

  it('shows the last Plaid sync time for a connected client', () => {
    renderRoute(<ClientSwitcherPage />);
    const cellText = within(rowFor('Busy Client')).getByText(
      new Date('2026-08-27T15:10:13.000Z').toLocaleString(),
    );
    expect(cellText).toBeTruthy();
  });

  it('names Plaid specifically when a client has no Plaid connection', () => {
    // Not "no bank connected": a client importing CSV/OFX statements has a
    // real bank feed and no Plaid item, so that wording would contradict the
    // backlog sitting in the column next to it.
    renderRoute(<ClientSwitcherPage />);
    expect(within(rowFor('No Bank Client')).getByText('No Plaid connection')).toBeTruthy();
  });

  it('flags a client whose bank connection needs attention', () => {
    // A stale-but-present timestamp is exactly when the warning matters: the
    // sync ran, it just did not work.
    renderRoute(<ClientSwitcherPage />);
    expect(
      within(rowFor('Quiet Client')).getByLabelText(/needs attention/i),
    ).toBeTruthy();
    expect(
      within(rowFor('Busy Client')).queryByLabelText(/needs attention/i),
    ).toBeNull();
  });

  it('shows nothing rather than a reassuring zero when the lookup fails', () => {
    // "0 unprocessed / No bank connected" would read as good news when the
    // truth is that we don't know.
    bankingResult.data = undefined;
    bankingResult.isError = true;

    renderRoute(<ClientSwitcherPage />);
    const row = rowFor('Busy Client');
    expect(within(row).queryByText('206')).toBeNull();
    expect(within(row).queryByText('No Plaid connection')).toBeNull();
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  const firstRowName = (container: HTMLElement) =>
    container.querySelector('tbody tr td')?.textContent ?? '';

  it('sorts by backlog, biggest first', () => {
    const { container } = renderRoute(<ClientSwitcherPage />);
    // Default sort is most-recently-accessed, which puts Quiet Client first.
    expect(firstRowName(container)).toContain('Quiet Client');

    act(() => { screen.getByText(/Unprocessed bank txns/i).click(); });
    expect(firstRowName(container)).toContain('Busy Client');
  });

  it('does not pretend to sort a column whose data has not arrived', () => {
    bankingResult.data = undefined;
    bankingResult.isPending = true;

    const { container } = renderRoute(<ClientSwitcherPage />);
    const before = firstRowName(container);
    act(() => { screen.getByText(/Unprocessed bank txns/i).click(); });
    // Every row would compare equal, so honouring the click would light the
    // sort arrow and then silently reshuffle once the request resolved.
    expect(firstRowName(container)).toBe(before);
  });
});
