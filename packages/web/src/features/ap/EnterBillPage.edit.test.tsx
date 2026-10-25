// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
//
// Enter Bill, edit mode (PR #173 review L1, L2, L6): Save sends back what
// the form has no columns for (item, quantity, cost, customer, billable),
// a saved bill's free-text terms and a custom discount; dueDate only when
// the owner set it; the paid-bill total check is exact.

process.env['TZ'] = 'America/Chicago';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  apMocks, contactsMocks, accountsMocks, companyMocks, tagsMocks,
  aiMocks, paymentsMocks, transactionsMocks, itemsMocks,
} from '../../test-mocks';

const { updateMutate, apiClientMock } = vi.hoisted(() => ({ updateMutate: vi.fn(), apiClientMock: vi.fn() }));

vi.mock('../../api/hooks/useAp', () => ({
  ...apMocks(),
  useUpdateBill: () => ({ mutate: updateMutate, isPending: false, error: null }),
}));
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
  return { ...actual, apiClient: apiClientMock };
});

import { EnterBillPage } from './EnterBillPage';
import { calcDueDate, billLinePayload, sumAmountUnits, amountUnits, editAmount, formatUnits } from './billFormShared';

const line = (extra: Record<string, unknown>) => ({
  id: crypto.randomUUID(), tenantId: 't', transactionId: 'b1', credit: '0', description: null, quantity: null, unitPrice: null,
  isTaxable: false, taxRate: '0', taxAmount: '0', lineOrder: 0, tagId: null, contactId: null, createdAt: '', ...extra,
});

const billWith = (extra: Record<string, unknown>) => ({
  id: 'b1', txnType: 'bill', txnDate: '2026-11-03', dueDate: '2026-12-31', status: 'posted', contactId: 'v1',
  memo: null, internalNotes: null, paymentTerms: 'Net 30 EOM', termsDays: null, total: '1480.0000', billStatus: 'unpaid',
  vendorInvoiceNumber: 'INV-55871', dueDateOverridden: false, discountDateOverridden: false, updatedAt: '2026-11-03T10:00:00.000Z',
  lines: [
    line({ accountId: 'exp1', debit: '873.7600', description: 'Lift', itemId: 'item1', quantity: '4.0000', unitPrice: '218.4400', contactId: 'cust1', isBillable: true, billedStatus: 'unbilled' }),
    line({ accountId: 'exp2', debit: '606.2400', description: 'Delivery', lineOrder: 1 }),
    line({ accountId: 'ap', debit: '0', credit: '1480.0000', lineOrder: 2 }),
  ],
  ...extra,
});

async function saveEdit(bill: Record<string, unknown>) {
  apiClientMock.mockImplementation(async (path: string) => (path === '/bills/b1' ? { bill } : { data: [], total: 0 }));
  const { container } = renderRoute(<EnterBillPage />, { route: '/bills/b1/edit', path: '/bills/:id/edit' });
  await screen.findByText('Edit Bill');
  await waitFor(() => expect(container.querySelector('form')).toBeTruthy());
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() => expect(updateMutate).toHaveBeenCalled());
  return updateMutate.mock.calls[0]![0].input;
}

beforeEach(() => {
  updateMutate.mockReset();
  apiClientMock.mockReset();
});

describe('EnterBillPage edit round-trip', () => {
  it('sends back item fields, legacy terms and no computed due date', async () => {
    const input = await saveEdit(billWith({}));
    expect(input.paymentTerms).toBe('Net 30 EOM');
    expect(input.dueDate).toBeUndefined();
    expect(input.lines).toEqual([
      {
        accountId: 'exp1', description: 'Lift', amount: '873.76', tagId: null,
        itemId: 'item1', quantity: '4.0000', unitPrice: '218.4400', contactId: 'cust1', isBillable: true,
      },
      {
        accountId: 'exp2', description: 'Delivery', amount: '606.24', tagId: null,
        itemId: null, quantity: null, unitPrice: null, contactId: null, isBillable: false,
      },
    ]);
  });

  it('keeps the owner\'s due date and a custom discount', async () => {
    const input = await saveEdit(billWith({
      paymentTerms: 'custom', termsDays: 45, discountPercent: '2.5000', discountDays: 10,
      dueDate: '2026-12-20', dueDateOverridden: true,
    }));
    expect(input).toMatchObject({
      paymentTerms: 'custom', termsDays: 45, discountPercent: '2.5', discountDays: 10, dueDate: '2026-12-20',
    });
  });

  it('a paid bill whose lines sum exactly to the total saves', async () => {
    const input = await saveEdit(billWith({ billStatus: 'partial', paymentTerms: 'net_30', dueDate: '2026-12-03' }));
    expect(input.lines).toHaveLength(2);
  });
});

describe('billFormShared helpers', () => {
  it('due dates are calendar days across the March DST change', () => {
    expect(calcDueDate('2026-03-01', 'net_15', '')).toBe('2026-03-16');
    expect(calcDueDate('2026-03-01', '2_10_net_30', '')).toBe('2026-03-31');
    expect(calcDueDate('2026-03-01', 'custom', '20')).toBe('2026-03-21');
    expect(calcDueDate('2026-03-01', 'custom', '')).toBe('');
    expect(calcDueDate('2026-03-01', 'Net 30 EOM', '')).toBe('');
    expect(calcDueDate('2026-02-30', 'net_15', '')).toBe('');
  });

  it('totals are exact: one cent short is a mismatch, no float tolerance', () => {
    expect(sumAmountUnits(['873.76', '606.24'])).toBe(amountUnits('1480.0000'));
    expect(sumAmountUnits(['873.76', '606.23'])).not.toBe(amountUnits('1480.0000'));
    expect(sumAmountUnits(['0.1', '0.2'])).toBe(amountUnits('0.3'));
    expect(formatUnits(sumAmountUnits(['1479.99']) - (amountUnits('1480.00') ?? BigInt(0)))).toBe('-0.01');
    expect(editAmount('873.7600')).toBe('873.76');
    expect(editAmount('12.3456')).toBe('12.3456');
  });

  it('a changed amount drops the unit cost but keeps item, quantity and customer', () => {
    const base = {
      accountId: 'exp1', description: 'Lift', amount: '873.76', tagId: null, userHasTouchedTag: false,
      itemId: 'item1', quantity: '4.0000', unitPrice: '218.4400', contactId: 'cust1', isBillable: true, loadedAmount: '873.76',
    };
    expect(billLinePayload(base)).toMatchObject({ unitPrice: '218.4400', quantity: '4.0000' });
    expect(billLinePayload({ ...base, amount: '900.00' })).toMatchObject({ unitPrice: null, quantity: '4.0000', itemId: 'item1', contactId: 'cust1', isBillable: true });
  });
});
