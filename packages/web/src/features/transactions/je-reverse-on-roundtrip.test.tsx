// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Editing a journal entry that has an automatic reversal (U-61): the form
// sends back the reverseOn that GET returned, so saving keeps the reversal
// on its date (the engine re-posts it there when the lines changed). An
// entry without one sends null. A new entry sends no reverseOn.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test-utils';
import {
  transactionsMocks, contactsMocks, tagsMocks, itemsMocks, aiMocks,
  companyMocks, companyProviderMocks, jeTemplatesMocks,
} from '../../test-mocks';

const updateMutate = vi.hoisted(() => vi.fn());
const createMutate = vi.hoisted(() => vi.fn());
const existing = vi.hoisted(() => ({ reverseOn: '2026-08-01' as string | null }));

vi.mock('../../api/hooks/useTransactions', () => ({
  ...transactionsMocks(),
  useTransaction: (id: string) => ({
    data: id ? {
      transaction: {
        id, txnType: 'journal_entry', txnDate: '2026-07-31', memo: 'Accrue', basis: 'both',
        reverseOn: existing.reverseOn,
        lines: [
          { accountId: 'a-rent', description: 'Rent', debit: '1200.0000', credit: '0.0000', tagId: null, contactId: null },
          { accountId: 'a-cash', description: '', debit: '0.0000', credit: '1200.0000', tagId: null, contactId: null },
        ],
      },
    } : undefined,
    isLoading: false,
  }),
  useUpdateTransaction: () => ({ mutate: updateMutate, isPending: false, error: null }),
  useCreateTransaction: () => ({ mutate: createMutate, isPending: false, error: null }),
}));
vi.mock('../../api/hooks/useJeTemplates', () => jeTemplatesMocks());
vi.mock('../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({
    data: {
      data: [
        { id: 'a-cash', accountNumber: '10100', name: 'Operating Cash', accountType: 'asset' },
        { id: 'a-rent', accountNumber: '62000', name: 'Rent Expense', accountType: 'expense' },
      ],
      total: 2,
    },
    isLoading: false,
  }),
  useCreateAccount: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());
vi.mock('../../api/hooks/useAuth', () => ({ useMe: () => ({ data: { user: { isSuperAdmin: false } } }) }));
vi.mock('../../api/hooks/useFirms', () => ({ useFirms: () => ({ data: { firms: [] } }) }));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], attachments: [] }) };
});

import { JournalEntryForm } from './JournalEntryForm';

beforeEach(() => { updateMutate.mockClear(); createMutate.mockClear(); });

describe('JournalEntryForm reverseOn round trip (U-61)', () => {
  it('an edit sends back the reverseOn GET returned', async () => {
    existing.reverseOn = '2026-08-01';
    const user = userEvent.setup();
    renderRoute(<JournalEntryForm />, { route: '/transactions/je-1/edit', path: '/transactions/:id/edit' });
    await user.click(await screen.findByRole('button', { name: 'Save Changes' }));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]![0]).toMatchObject({ id: 'je-1', reverseOn: '2026-08-01' });
  });

  it('an edit of an entry without a reversal sends null', async () => {
    existing.reverseOn = null;
    const user = userEvent.setup();
    renderRoute(<JournalEntryForm />, { route: '/transactions/je-2/edit', path: '/transactions/:id/edit' });
    await user.click(await screen.findByRole('button', { name: 'Save Changes' }));
    expect(updateMutate.mock.calls[0]![0]).toMatchObject({ id: 'je-2', reverseOn: null });
  });
});
