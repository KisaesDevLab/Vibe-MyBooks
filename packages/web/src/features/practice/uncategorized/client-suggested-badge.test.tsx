// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The Client suggested tab now lists team-member suggestions (Banking →
// Uncategorized) alongside portal-contact ones, with a badge saying which.
// A row without the field (older server) reads as a client answer.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { accountsMocks, companyMocks, contactsMocks, passthroughMutation } from '../../../test-mocks';

const base = {
  targetKind: 'transaction', targetId: 'txn-1', suggestedAccountId: null, suggestedLabel: 'Office Supplies',
  clientNote: null, isPersonal: false, status: 'pending', submittedAt: '2026-09-15T10:00:00.000Z', reviewedAt: null,
  snapshotAmount: '10.00', snapshotDate: '2026-09-15', snapshotDescription: 'Mystery', driftedFields: [], isStale: false,
};
const rows = [
  { ...base, id: 's-team', contactName: 'Pat Bookkeeper', submittedBy: 'team_member', submittedByUserId: 'u2' },
  { ...base, id: 's-client', targetId: 'txn-2', contactName: 'Cli Ent' },
  // A picked contact: the live name shows, no badge.
  { ...base, id: 's-payee', targetId: 'txn-3', contactName: 'Pay Ee', suggestedContactId: 'ct-1', suggestedContactLabel: 'Home Depot', suggestedContactName: 'Home Depot' },
  // Free text: the label shows with a "Not in contacts" badge.
  { ...base, id: 's-typed', targetId: 'txn-4', contactName: 'Ty Ped', suggestedContactId: null, suggestedContactLabel: 'Joe the plumber', suggestedContactName: null },
];

vi.mock('../../../api/hooks/useUncategorized', () => ({
  useSuggestions: () => ({ data: { rows, total: rows.length }, isLoading: false, isError: false, refetch: vi.fn() }),
  useApproveSuggestions: passthroughMutation,
  useRejectSuggestions: passthroughMutation,
  useMarkSuggestionsReviewed: passthroughMutation,
}));
vi.mock('../../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../../api/hooks/useCompany', () => companyMocks());

const { ClientSuggestedTab } = await import('./ClientSuggestedTab');

describe('ClientSuggestedTab — the payee', () => {
  it('shows the picked contact by name and flags a typed name as not in contacts', () => {
    renderRoute(<ClientSuggestedTab />);
    expect(screen.getByRole('columnheader', { name: 'Payee' })).toBeTruthy();
    expect(screen.getByText('Home Depot')).toBeTruthy();
    expect(screen.getByText('Joe the plumber')).toBeTruthy();
    expect(screen.getAllByText('Not in contacts')).toHaveLength(1);
    // The override payee picker sits beside the override account picker.
    expect(screen.getByPlaceholderText(/search contacts/i)).toBeTruthy();
  });
});

describe('ClientSuggestedTab — who answered', () => {
  it('badges team-member suggestions and defaults the rest to Client', () => {
    renderRoute(<ClientSuggestedTab />);
    expect(screen.getByText('Pat Bookkeeper').textContent).toContain('Team member');
    expect(screen.getByText('Cli Ent').textContent).toContain('Client');
    expect(screen.getByRole('columnheader', { name: 'From' })).toBeTruthy();
  });
});
