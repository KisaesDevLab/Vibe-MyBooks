// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bank Feed expanded editor: selecting a NAME (contact) autofills the
// category ACCOUNT. The contact's configured default expense account wins;
// otherwise the feed falls back to the most-recently-used category account
// for that contact (server lookup via /banking/feed/suggest-account). A
// manual account choice is never clobbered by a later name selection.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks,
} from '../../test-mocks';

// One pending, expandable feed item with no suggestion — the "needs
// categorization" case where the user picks a name by hand.
const feedItem = {
  id: 'item-1',
  tenantId: 't1',
  bankConnectionId: 'conn-1',
  providerTransactionId: null,
  feedDate: '2026-06-01',
  description: 'UNRESOLVED DESCRIPTOR',
  originalDescription: 'UNRESOLVED DESCRIPTOR RAW',
  amount: '42.0000',
  category: null,
  status: 'pending',
  matchedTransactionId: null,
  suggestedAccountId: null,
  suggestedAccountName: null,
  suggestedContactId: null,
  suggestedContactName: null,
  confidenceScore: null,
  matchType: null,
  payeeNameOnCheck: null,
  checkNumber: null,
  memo: null,
  bankAccountName: 'Checking',
  institutionName: 'Test Bank',
  suggestedTagId: null,
  suggestedTagName: null,
  lineTags: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

// Two contacts: one with a configured default expense account (the "default"
// path), one without (forcing the "recent" server fallback).
const contacts = [
  { id: 'c-acme', displayName: 'Acme Supplies', contactType: 'vendor', defaultExpenseAccountId: 'acct-office', defaultTagId: null, isActive: true },
  { id: 'c-rent', displayName: 'Rent LLC', contactType: 'vendor', defaultExpenseAccountId: null, defaultTagId: null, isActive: true },
];

const accounts = [
  { id: 'acct-office', accountNumber: '6000', name: 'Office Supplies', accountType: 'expense', isActive: true },
  { id: 'acct-rent', accountNumber: '6100', name: 'Rent Expense', accountType: 'expense', isActive: true },
];

// Spy on the staged-assign mutation so we can assert the ACCOUNT that a name
// selection autofilled — the persisted end effect, not dropdown internals.
const assignMutate = vi.fn();
// The recent-account fallback: resolves to acct-rent for any contact.
const suggestMutate = vi.fn((_contactId: string, opts?: { onSuccess?: (r: { accountId: string | null; source: string | null }) => void }) =>
  opts?.onSuccess?.({ accountId: 'acct-rent', source: 'recent' }),
);

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: () => ({
    data: { data: [feedItem], total: 1 },
    isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
  }),
  useAssignFeedItem: () => ({ mutate: assignMutate, isPending: false }),
  useSuggestAccountForContact: () => ({ mutate: suggestMutate, isPending: false }),
}));
vi.mock('../../api/hooks/useAccounts', () => ({
  ...accountsMocks(),
  useAccounts: () => ({ data: { data: accounts, total: accounts.length }, isLoading: false }),
}));
vi.mock('../../api/hooks/useContacts', () => ({
  ...contactsMocks(),
  useContacts: () => ({ data: { data: contacts, total: contacts.length }, isLoading: false, refetch: vi.fn() }),
}));
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePlaid', () => plaidMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], connections: [] }) };
});

import { BankFeedPage } from './BankFeedPage';

beforeEach(() => {
  sessionStorage.clear();
  assignMutate.mockClear();
  suggestMutate.mockClear();
});

// Expand the row, then pick a contact by display name in the ContactSelector.
function expandAndSelectName(name: string) {
  fireEvent.doubleClick(screen.getByText('UNRESOLVED DESCRIPTOR'));
  fireEvent.focus(screen.getByPlaceholderText('Search contacts...'));
  fireEvent.click(screen.getByText(name));
}

describe('BankFeedPage — name → account autofill in the expanded editor', () => {
  it("fills the account from the contact's default expense account", async () => {
    renderRoute(<BankFeedPage />);
    expandAndSelectName('Acme Supplies');

    // The account is now set, so the action button reads "Assign" (not "Save").
    fireEvent.click(await screen.findByRole('button', { name: 'Assign' }));

    await waitFor(() => expect(assignMutate).toHaveBeenCalledTimes(1));
    expect(assignMutate.mock.calls[0]![0]).toMatchObject({ id: 'item-1', accountId: 'acct-office', contactId: 'c-acme' });
    // Default path — no server round-trip for a recent account.
    expect(suggestMutate).not.toHaveBeenCalled();
  });

  it('falls back to the most-recent account when the contact has no default', async () => {
    renderRoute(<BankFeedPage />);
    expandAndSelectName('Rent LLC');

    // No configured default → the recent-account lookup fires for this contact.
    await waitFor(() => expect(suggestMutate).toHaveBeenCalledWith('c-rent', expect.anything()));

    fireEvent.click(await screen.findByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(assignMutate).toHaveBeenCalledTimes(1));
    expect(assignMutate.mock.calls[0]![0]).toMatchObject({ id: 'item-1', accountId: 'acct-rent', contactId: 'c-rent' });
  });
});
