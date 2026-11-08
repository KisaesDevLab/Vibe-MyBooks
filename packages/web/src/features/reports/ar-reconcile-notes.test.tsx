// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A/R Aging nets unapplied payments and credits; Customer Balance Summary
// sums open invoices only. Each page says so and links to the other, and
// aging shows what each row is (a credit row is labelled, not just negative).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { companyMocks, tagsMocks, companyProviderMocks } from '../../test-mocks';
import { AR_KIND_LABELS, ArAgingNote, CustomerBalanceNote } from './arReconcileNotes';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../providers/CompanyProvider', () => companyProviderMocks());

// The example: $60 open invoice, $10 overpayment credit, $30 unapplied payment.
const aging = {
  title: 'AR Aging Summary',
  asOfDate: '2026-11-08',
  total: 20,
  details: [
    { id: 'inv', txn_number: '1001', contact_id: 'c1', customer_name: 'Acme', bucket: 'current', balance: 60, kind: 'invoice' },
    { id: 'cm', txn_number: '7', contact_id: 'c1', customer_name: 'Acme', bucket: 'current', balance: -10, kind: 'credit' },
    { id: 'pay', txn_number: null, contact_id: 'c1', customer_name: 'Acme', bucket: 'current', balance: -30, kind: 'credit' },
  ],
};
const balanceSummary = { title: 'Customer Balance Summary', data: [{ id: 'c1', display_name: 'Acme', balance: '60.0000' }] };

const apiClientMock = vi.fn(async (path: string) => (path.startsWith('/reports/ar-aging') ? aging : balanceSummary));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (path: string) => apiClientMock(path) };
});

import { GenericReport } from './GenericReport';

beforeEach(() => { window.sessionStorage.clear(); apiClientMock.mockClear(); });

describe('A/R reconciliation notes', () => {
  it('Customer Balance Summary says it shows open invoices only and links to A/R Aging', async () => {
    renderRoute(
      <GenericReport title="Customer Balance Summary" endpoint="customer-balance-summary" useDateRange={false}
        columns={[{ key: 'display_name', label: 'Customer' }, { key: 'balance', label: 'Balance', align: 'right', format: 'money' }]}
        note={<CustomerBalanceNote />} />,
    );
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(/open invoice balances only/i);
    expect(within(note).getByRole('link', { name: /a\/r aging summary/i }).getAttribute('href')).toBe('/reports/ar-aging-summary');
    expect(await screen.findByText('Acme')).toBeTruthy();
  });

  it('A/R Aging labels credit rows and links back to Customer Balance Summary', async () => {
    renderRoute(
      <GenericReport title="AR Aging Summary" endpoint="ar-aging-summary" useDateRange={false} useAsOfDate
        columns={[{ key: 'customer_name', label: 'Customer' }, { key: 'kind', label: 'Type' }, { key: 'balance', label: 'Amount', align: 'right', format: 'money' }]}
        dataKey="details" note={<ArAgingNote />} valueLabels={{ kind: AR_KIND_LABELS }} />,
    );
    const note = screen.getByRole('note');
    expect(within(note).getByRole('link', { name: /customer balance summary/i }).getAttribute('href')).toBe('/reports/customer-balance-summary');
    expect(await screen.findByText('Invoice')).toBeTruthy();
    expect(screen.getAllByText('Credit / unapplied payment')).toHaveLength(2);
    // The raw code is not shown.
    expect(screen.queryByText('credit')).toBeNull();
  });

  it('a report without a note shows none', async () => {
    renderRoute(
      <GenericReport title="Customer Balance Summary" endpoint="customer-balance-summary" useDateRange={false}
        columns={[{ key: 'display_name', label: 'Customer' }]} />,
    );
    expect(await screen.findByText('Acme')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });
});
