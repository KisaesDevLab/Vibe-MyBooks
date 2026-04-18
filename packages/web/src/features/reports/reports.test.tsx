// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import {
  accountsMocks, companyMocks, tagsMocks, contactsMocks, companyProviderMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    apiClient: vi.fn().mockResolvedValue({
      revenue: [], expenses: [], cogs: [], otherRevenue: [], otherExpenses: [],
      assets: [], liabilities: [], equity: [],
      totalRevenue: 0, totalExpenses: 0, netIncome: 0,
      totalAssets: 0, totalLiabilities: 0, totalEquity: 0,
      data: [], rows: [], transactions: [], details: [], budgets: [],
      labels: {},
    }),
  };
});

import { ReportsPage } from './ReportsPage';
import { ProfitAndLossReport } from './ProfitAndLossReport';
import { BalanceSheetReport } from './BalanceSheetReport';
import { GeneralLedgerReport } from './GeneralLedgerReport';
import { BudgetVsActualReport } from './BudgetVsActualReport';
import { BudgetOverviewReport } from './BudgetOverviewReport';
import { GenericReport } from './GenericReport';

describe('reports pages', () => {
  for (const [name, Component] of [
    ['ReportsPage', ReportsPage],
    ['ProfitAndLossReport', ProfitAndLossReport],
    ['BalanceSheetReport', BalanceSheetReport],
    ['GeneralLedgerReport', GeneralLedgerReport],
    ['BudgetVsActualReport', BudgetVsActualReport],
    ['BudgetOverviewReport', BudgetOverviewReport],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />);
      expectPageRendered();
    });
  }

  it('GenericReport renders with minimal config', () => {
    renderRoute(
      <GenericReport
        title="Test Report"
        endpoint="test"
        columns={[{ key: 'a', label: 'A' }]}
      />,
    );
    expectPageRendered();
  });
});
