// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The "Rules" filter constrains the feed to rows a rule mapped (match_type =
// 'rule'). It's server-side: toggling it must pass ruleOnly:true to useBankFeed
// so the list API filters + counts correctly (not a client-side slice).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks,
} from '../../test-mocks';

// Records the filters object useBankFeed was last called with, so the test can
// assert the "Rules" toggle flows through to the query param.
const useBankFeedSpy = vi.fn();

const feedItems = [
  {
    id: 'item-1', tenantId: 't1', bankConnectionId: 'conn-1', feedDate: '2026-06-01',
    description: 'COFFEE SHOP', originalDescription: 'COFFEE SHOP 001', amount: '12.5000',
    status: 'pending', suggestedAccountId: null, suggestedContactId: null, confidenceScore: null,
    matchedTransactionId: null, payeeNameOnCheck: null, checkNumber: null, memo: null,
    bankAccountName: 'Checking', institutionName: 'Test Bank',
  },
];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useBankFeed: (filters?: unknown) => {
    useBankFeedSpy(filters);
    return {
      data: { data: feedItems, total: 1 },
      isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    };
  },
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
  useBankFeedSpy.mockClear();
});

describe('BankFeedPage — Rules filter', () => {
  it('does not request ruleOnly by default', () => {
    renderRoute(<BankFeedPage />);
    const last = useBankFeedSpy.mock.calls.at(-1)![0] as { ruleOnly?: boolean };
    expect(last.ruleOnly).toBeUndefined();
  });

  it('passes ruleOnly:true to the list query when the Rules filter is checked', () => {
    renderRoute(<BankFeedPage />);
    fireEvent.click(screen.getByLabelText('Rules'));
    const last = useBankFeedSpy.mock.calls.at(-1)![0] as { ruleOnly?: boolean };
    expect(last.ruleOnly).toBe(true);
  });
});
