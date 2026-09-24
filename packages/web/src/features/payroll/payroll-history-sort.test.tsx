// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Payroll history: sort is server-side (the history paginates); the Status
// popover and the status select share one filter.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { payrollImportMocks } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const session = { id: 's1', tenantId: 't1', companyId: null, importMode: 'employee_level', templateId: null, originalFilename: 'june.csv',
  filePath: '/x', fileHash: 'h', companionFilename: null, companionFilePath: null, payPeriodStart: '2026-06-01', payPeriodEnd: '2026-06-15',
  checkDate: null, status: 'posted', rowCount: 12, errorCount: 0, jeCount: 1, journalEntryId: null, journalEntryIds: null,
  columnMapSnapshot: null, metadata: null, createdAt: '2026-06-20T00:00:00.000Z', updatedAt: '2026-06-20T00:00:00.000Z' };

vi.mock('../../api/hooks/usePayrollImport', () => ({
  ...payrollImportMocks(),
  usePayrollSessions: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [session], total: 1 }, isLoading: false };
  },
}));

import { PayrollHistoryPage } from './PayrollHistoryPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('PayrollHistoryPage — column sort and status filter', () => {
  it('sends the header sort to the hook with the page reset', () => {
    renderRoute(<PayrollHistoryPage />);
    expect(screen.getByText('june.csv')).toBeInTheDocument();
    expect(lastFilters['sortBy']).toBeUndefined();          // default = newest import first
    fireEvent.click(screen.getByRole('button', { name: /^errors/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'errorCount', sortDir: 'desc', offset: 0 });
    expect(JSON.parse(sessionStorage.getItem('vibe:payroll-history:view')!)).toMatchObject({ sortCol: 'errorCount' });
  });

  it('the Status popover mirrors the status select', () => {
    renderRoute(<PayrollHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Posted'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(lastFilters['status']).toBe('posted');
    expect((screen.getByDisplayValue('Posted') as HTMLSelectElement).value).toBe('posted');
  });
});
