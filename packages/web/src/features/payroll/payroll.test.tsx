// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import {
  payrollImportMocks, accountsMocks, companyMocks, contactsMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/usePayrollImport', () => payrollImportMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], total: 0, sessions: [] }) };
});

import { PayrollImportPage } from './PayrollImportPage';
import { PayrollHistoryPage } from './PayrollHistoryPage';
import { PayrollAccountMappingPage } from './PayrollAccountMappingPage';

describe('payroll pages', () => {
  for (const [name, Component] of [
    ['PayrollImportPage', PayrollImportPage],
    ['PayrollHistoryPage', PayrollHistoryPage],
    ['PayrollAccountMappingPage', PayrollAccountMappingPage],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />);
      expectPageRendered();
    });
  }
});
