// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The print queue loads whole, so it sorts and filters client-side through
// the shared column view. The load-bearing rule: a row hidden by the payee
// filter can never stay selected — it would print.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  checksMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  apMocks, transactionsMocks,
} from '../../test-mocks';

const queue = [
  { id: 'c1', txnDate: '2026-09-01', amount: '50.00', contactName: 'Zed Hardware', payeeNameOnCheck: null, memo: 'b', printedMemo: null, source: null },
  { id: 'c2', txnDate: '2026-09-03', amount: '5.00', contactName: 'Acme Supplies', payeeNameOnCheck: null, memo: 'a', printedMemo: null, source: null },
  { id: 'c3', txnDate: '2026-09-02', amount: '500.00', contactName: null, payeeNameOnCheck: 'Mid Vendor', memo: 'c', printedMemo: null, source: null },
];

vi.mock('../../api/hooks/useChecks', () => ({
  ...checksMocks(),
  usePrintQueue: () => ({ data: { data: queue }, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAp', () => apMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], signatures: [] }) };
});

import { PrintChecksPage } from './PrintChecksPage';

beforeEach(() => sessionStorage.clear());

const payeeOrder = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[2]!.textContent!.trim());

describe('PrintChecksPage — sort and filter', () => {
  it('sorts by a header, numerically for amounts, and flips on a second click', () => {
    renderRoute(<PrintChecksPage />);
    expect(payeeOrder()).toEqual(['Zed Hardware', 'Acme Supplies', 'Mid Vendor']);
    fireEvent.click(screen.getByRole('button', { name: /^payee/i }));
    expect(payeeOrder()).toEqual(['Acme Supplies', 'Mid Vendor', 'Zed Hardware']);
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    // 5, 50, 500 — not "5", "50", "500" as text would also give, so check desc too.
    expect(payeeOrder()).toEqual(['Acme Supplies', 'Zed Hardware', 'Mid Vendor']);
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(payeeOrder()).toEqual(['Mid Vendor', 'Zed Hardware', 'Acme Supplies']);
  });

  it('the payee filter hides rows and drops them from the selection', () => {
    renderRoute(<PrintChecksPage />);
    // Select all three.
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]!);
    expect(screen.getByText('3 of 3 checks selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Filter Payee' }));
    fireEvent.click(screen.getByLabelText('Acme Supplies'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(payeeOrder()).toEqual(['Acme Supplies']);
    expect(screen.getByText('1 of 1 checks selected')).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem('vibe:print-checks:view')!).filters.payee).toEqual(['Acme Supplies']);
  });
});
