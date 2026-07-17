// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bank Feed NAME column precedence: the resolved payee/vendor wins over
// the cleaned bank descriptor. A human-assigned contact beats a rule/AI
// suggested contact, which beats the descriptor. The raw bank memo still
// shows on the muted line below whatever name is chosen.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks,
} from '../../test-mocks';

const base = {
  tenantId: 't1',
  bankConnectionId: 'conn-1',
  feedDate: '2026-06-01',
  amount: '12.5000',
  status: 'pending',
  suggestedAccountId: null,
  suggestedAccountName: null,
  confidenceScore: null,
  matchedTransactionId: null,
  payeeNameOnCheck: null,
  checkNumber: null,
  memo: null,
  bankAccountName: 'Checking',
  institutionName: 'Test Bank',
  suggestedTagId: null,
  suggestedTagName: null,
  lineTags: null,
};

const feedItems = [
  {
    // Rule/AI-suggested payee → payee wins over the cleaned descriptor.
    ...base,
    id: 'item-suggested',
    description: 'IRS/State Tax Authority',
    originalDescription: 'PAYROLLTAX TAX DEBIT ACH ENTRY MEMO POSTED TODAY',
    suggestedContactId: 'c-payroll',
    suggestedContactName: 'Payroll',
  },
  {
    // Human-assigned payee beats a suggested one.
    ...base,
    id: 'item-assigned',
    description: 'SOME DESCRIPTOR',
    originalDescription: 'SOME DESCRIPTOR RAW',
    suggestedContactId: 'c-x',
    suggestedContactName: 'Suggested Vendor',
    assignedContactId: 'c-y',
    assignedContactName: 'Chosen Vendor',
  },
  {
    // No contact → fall back to the cleaned descriptor.
    ...base,
    id: 'item-plain',
    description: 'COFFEE SHOP',
    originalDescription: 'COFFEE SHOP 001',
    suggestedContactId: null,
    suggestedContactName: null,
  },
];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: () => ({
    data: { data: feedItems, total: feedItems.length },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
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
});

describe('BankFeedPage — NAME column payee precedence', () => {
  it('shows the suggested payee over the cleaned descriptor, and keeps the raw memo below', () => {
    renderRoute(<BankFeedPage />);
    // Payee name shows as the transaction name…
    expect(screen.getByText('Payroll')).toBeTruthy();
    // …and the AI descriptor is no longer rendered as the name.
    expect(screen.queryByText('IRS/State Tax Authority')).toBeNull();
    // Raw bank memo is still visible on the muted line.
    expect(screen.getByText('PAYROLLTAX TAX DEBIT ACH ENTRY MEMO POSTED TODAY')).toBeTruthy();
  });

  it('prefers the human-assigned payee over a suggested one', () => {
    renderRoute(<BankFeedPage />);
    expect(screen.getByText('Chosen Vendor')).toBeTruthy();
    expect(screen.queryByText('Suggested Vendor')).toBeNull();
    expect(screen.queryByText('SOME DESCRIPTOR')).toBeNull();
  });

  it('falls back to the cleaned descriptor when there is no contact', () => {
    renderRoute(<BankFeedPage />);
    expect(screen.getByText('COFFEE SHOP')).toBeTruthy();
  });
});
