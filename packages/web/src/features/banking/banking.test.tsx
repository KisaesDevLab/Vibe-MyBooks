// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import {
  bankingMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  aiMocks, plaidMocks, transactionsMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useBanking', () => bankingMocks());
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

import { BankConnectionsPage } from './BankConnectionsPage';
import { BankFeedPage } from './BankFeedPage';
import { BankDepositPage } from './BankDepositPage';
import { BankRulesPage } from './BankRulesPage';
import { ReconciliationPage } from './ReconciliationPage';
import { ReconciliationHistoryPage } from './ReconciliationHistoryPage';
import { StatementUploadPage } from './StatementUploadPage';

describe('banking pages', () => {
  for (const [name, Component] of [
    ['BankConnectionsPage', BankConnectionsPage],
    ['BankFeedPage', BankFeedPage],
    ['BankDepositPage', BankDepositPage],
    ['BankRulesPage', BankRulesPage],
    ['ReconciliationPage', ReconciliationPage],
    ['ReconciliationHistoryPage', ReconciliationHistoryPage],
    ['StatementUploadPage', StatementUploadPage],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />);
      expectPageRendered();
    });
  }
});
