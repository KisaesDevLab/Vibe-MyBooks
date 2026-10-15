// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Keyboard entry in the Journal Entry form (Kurt): pick a line's account
// with Enter → focus lands on that line's Debit; type "145.15-50" + Enter
// → the debit becomes 95.15 and the form is not submitted. Covers both the
// two-line SplitRowV2 layout (prod) and the legacy table layout.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test-utils';
import {
  transactionsMocks, contactsMocks, tagsMocks, itemsMocks, aiMocks,
  companyMocks, companyProviderMocks, jeTemplatesMocks,
} from '../../test-mocks';

const flags = vi.hoisted(() => ({ v2: true }));
const createMutate = vi.hoisted(() => vi.fn());

vi.mock('../../utils/feature-flags', () => ({
  get ENTRY_FORMS_V2() { return flags.v2; },
}));
vi.mock('../../api/hooks/useTransactions', () => ({
  ...transactionsMocks(),
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

beforeEach(() => { createMutate.mockClear(); });

for (const v2 of [true, false]) {
  describe(`JournalEntryForm keyboard entry (${v2 ? 'SplitRowV2' : 'legacy table'})`, () => {
    beforeEach(() => { flags.v2 = v2; });

    it('Enter-picking an account moves focus to that line\'s Debit, and Debit takes math', async () => {
      const user = userEvent.setup();
      renderRoute(<JournalEntryForm />);
      const accountInputs = screen.getAllByPlaceholderText('Search accounts...');
      // Second line, to prove it targets the same line (not line 1).
      await user.click(accountInputs[1]!);
      await user.keyboard('rent');
      await user.keyboard('{Enter}');

      const debit2 = screen.getByRole('textbox', { name: 'Line 2 debit' }) as HTMLInputElement;
      expect(document.activeElement).toBe(debit2);
      expect((accountInputs[1] as HTMLInputElement).value).toBe('62000 — Rent Expense');

      await user.keyboard('145.15-50{Enter}');
      expect(debit2.value).toBe('95.15');
      expect(document.activeElement).toBe(debit2);
      expect(createMutate).not.toHaveBeenCalled();
      // The running total reflects the evaluated amount.
      expect(within(document.body).getAllByText(/95\.15/).length).toBeGreaterThan(0);
    });
  });
}
