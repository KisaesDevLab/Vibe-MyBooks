// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  transactionsMocks, accountsMocks, contactsMocks, tagsMocks, itemsMocks,
  batchMocks, aiMocks, companyMocks,
} from '../../test-mocks';

// vi.mock is hoisted above imports. Using the factory helpers from
// test-mocks keeps per-page test files compact and makes "new hook added"
// churn a one-line fix rather than N test files.
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/hooks/useBatch', () => batchMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
// Some pages (DuplicateReviewPage, RecurringListPage) skip the hook layer
// and call apiClient directly via inline useQuery. Stub apiClient so those
// queries resolve to empty data instead of hanging in isLoading.
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], schedules: [] }) };
});

import { TransactionListPage } from './TransactionListPage';
import { TransactionDetail } from './TransactionDetail';
import { JournalEntryForm } from './JournalEntryForm';
import { ExpenseForm } from './ExpenseForm';
import { TransferForm } from './TransferForm';
import { DepositForm } from './DepositForm';
import { CashSaleForm } from './CashSaleForm';
import { BatchEntryPage } from './BatchEntryPage';
import { DuplicateReviewPage } from './DuplicateReviewPage';
import { RecurringListPage } from './RecurringListPage';

describe('transactions pages', () => {
  it('TransactionListPage shows the empty state on a fresh tenant', () => {
    renderRoute(<TransactionListPage />);
    expect(screen.getByRole('heading', { name: /^transactions$/i })).toBeInTheDocument();
    expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
  });

  it('TransactionDetail renders without crash when id present but no data', () => {
    renderRoute(<TransactionDetail />, { route: '/transactions/t1', path: '/transactions/:id' });
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  // Smoke check for every form / list page: it mounted without throwing.
  // We look for either a heading (the usual case) or a role=status loading
  // spinner (pages that go through an immediate async query and haven't
  // settled yet). Either means React rendered successfully.
  for (const [name, Component] of [
    ['JournalEntryForm', JournalEntryForm],
    ['ExpenseForm', ExpenseForm],
    ['TransferForm', TransferForm],
    ['DepositForm', DepositForm],
    ['CashSaleForm', CashSaleForm],
    ['BatchEntryPage', BatchEntryPage],
    ['DuplicateReviewPage', DuplicateReviewPage],
    ['RecurringListPage', RecurringListPage],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />);
      const headings = screen.queryAllByRole('heading');
      const statuses = screen.queryAllByRole('status');
      expect(headings.length + statuses.length).toBeGreaterThan(0);
    });
  }
});
