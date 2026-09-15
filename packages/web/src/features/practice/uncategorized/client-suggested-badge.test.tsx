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

describe('ClientSuggestedTab — who answered', () => {
  it('badges team-member suggestions and defaults the rest to Client', () => {
    renderRoute(<ClientSuggestedTab />);
    expect(screen.getByText('Pat Bookkeeper').textContent).toContain('Team member');
    expect(screen.getByText('Cli Ent').textContent).toContain('Client');
    expect(screen.getByRole('columnheader', { name: 'From' })).toBeTruthy();
  });
});
