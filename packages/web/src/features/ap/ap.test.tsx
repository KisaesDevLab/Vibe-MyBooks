// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import {
  apMocks, contactsMocks, accountsMocks, companyMocks, tagsMocks,
  aiMocks, paymentsMocks, transactionsMocks, itemsMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useAp', () => apMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePayments', () => paymentsMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], total: 0, bill: null }) };
});

import { BillListPage } from './BillListPage';
import { EnterBillPage } from './EnterBillPage';
import { BillDetailPage } from './BillDetailPage';
import { EnterVendorCreditPage } from './EnterVendorCreditPage';
import { VendorCreditListPage } from './VendorCreditListPage';
import { PayBillsPage } from './PayBillsPage';

describe('accounts payable pages', () => {
  for (const [name, Component, route, path] of [
    ['BillListPage', BillListPage, '/bills', '/bills'],
    ['EnterBillPage', EnterBillPage, '/bills/new', '/bills/new'],
    ['BillDetailPage', BillDetailPage, '/bills/b1', '/bills/:id'],
    ['EnterVendorCreditPage', EnterVendorCreditPage, '/vendor-credits/new', '/vendor-credits/new'],
    ['VendorCreditListPage', VendorCreditListPage, '/vendor-credits', '/vendor-credits'],
    ['PayBillsPage', PayBillsPage, '/pay-bills', '/pay-bills'],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />, { route, path });
      expectPageRendered();
    });
  }
});
