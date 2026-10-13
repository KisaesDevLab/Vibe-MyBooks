// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Enter after picking a line's account lands on that line's amount in the
// other entry forms (Kurt: "the next field should be the next logical
// field such as the amount field next to the account dropdown").

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test-utils';
import {
  transactionsMocks, contactsMocks, tagsMocks, itemsMocks, aiMocks,
  companyMocks, companyProviderMocks, jeTemplatesMocks, checksMocks, apMocks,
} from '../../test-mocks';

const flags = vi.hoisted(() => ({ v2: true }));
vi.mock('../../utils/feature-flags', () => ({
  get ENTRY_FORMS_V2() { return flags.v2; },
}));
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/hooks/useJeTemplates', () => jeTemplatesMocks());
vi.mock('../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({
    data: {
      data: [
        { id: 'a-cash', accountNumber: '10100', name: 'Operating Cash', accountType: 'asset' },
        { id: 'a-sav', accountNumber: '10200', name: 'Savings', accountType: 'asset' },
        { id: 'a-rent', accountNumber: '62000', name: 'Rent Expense', accountType: 'expense' },
        { id: 'a-inc', accountNumber: '40000', name: 'Sales Income', accountType: 'revenue' },
      ],
      total: 4,
    },
    isLoading: false,
  }),
  useCreateAccount: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/useCompany', () => ({
  ...companyMocks(),
  useCompanySettings: () => ({ data: { settings: { categoryFilterMode: 'all' } } }),
}));
vi.mock('../../api/hooks/useChecks', () => checksMocks());
vi.mock('../../api/hooks/useAp', () => apMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());
vi.mock('../../api/hooks/useAuth', () => ({ useMe: () => ({ data: { user: { isSuperAdmin: false } } }) }));
vi.mock('../../api/hooks/useFirms', () => ({ useFirms: () => ({ data: { firms: [] } }) }));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], attachments: [] }) };
});

import { ExpenseForm } from './ExpenseForm';
import { DepositForm } from './DepositForm';
import { TransferForm } from './TransferForm';
import { WriteCheckPage } from '../checks/WriteCheckPage';
import { AjeFormPage } from '../tb/AjeFormPage';

async function pickAccount(input: HTMLElement, text: string) {
  const user = userEvent.setup();
  await user.click(input);
  await user.keyboard(text);
  await user.keyboard('{Enter}');
}

/** The account input of the first line (after any header account pickers). */
function lineAccountInput(headerPickers: number): HTMLElement {
  return screen.getAllByPlaceholderText('Search accounts...')[headerPickers]!;
}

function expectFocusOnAmountInSameRow(accountInput: HTMLElement, rowSelector = 'tr, [role="group"]') {
  const active = document.activeElement as HTMLInputElement;
  expect(active.tagName).toBe('INPUT');
  expect(active.getAttribute('inputmode')).toBe('decimal'); // a MoneyInput
  const row = accountInput.closest(rowSelector);
  expect(row).not.toBeNull();
  expect(row!.contains(active)).toBe(true);
}

for (const v2 of [true, false]) {
  describe(`Enter after account → amount (${v2 ? 'V2' : 'legacy'})`, () => {
    beforeEach(() => { flags.v2 = v2; });

    it('ExpenseForm: Category → Amount', async () => {
      renderRoute(<ExpenseForm />);
      const input = lineAccountInput(1); // header: Pay From Account
      await pickAccount(input, 'rent');
      expectFocusOnAmountInSameRow(input);
    });

    it('DepositForm: Account → Amount', async () => {
      renderRoute(<DepositForm />);
      const input = lineAccountInput(1); // header: Deposit To
      await pickAccount(input, 'sales');
      // Deposit lines are flex rows (div), not table rows.
      expectFocusOnAmountInSameRow(input, 'div.flex-wrap');
    });

    it('WriteCheckPage: line Account → Amount', async () => {
      renderRoute(<WriteCheckPage />);
      const input = lineAccountInput(1); // header: Bank Account
      await pickAccount(input, 'rent');
      expectFocusOnAmountInSameRow(input);
    });

    it('AjeFormPage: Account → Debit (skipping Description and Tag)', async () => {
      renderRoute(<AjeFormPage />);
      const input = lineAccountInput(0);
      await pickAccount(input, 'rent');
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Line 1 debit' }));
    });
  });
}

describe('TransferForm', () => {
  it('From → To → Amount', async () => {
    renderRoute(<TransferForm />);
    const [from, to] = screen.getAllByPlaceholderText('Search accounts...');
    await pickAccount(from!, 'operating');
    expect(document.activeElement).toBe(to);
    await pickAccount(to!, 'savings');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Amount' }));
  });
});
