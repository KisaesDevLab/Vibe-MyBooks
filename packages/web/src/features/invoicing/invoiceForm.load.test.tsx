// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Review N-1: the invoice editor opens a stored invoice without an account
// query over the schema's page limit (accountFiltersSchema.limit max 500),
// and refuses to load one whose A/R line it can't recognise.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  invoicesMocks, contactsMocks, accountsMocks, itemsMocks, companyMocks,
  tagsMocks, aiMocks, paymentsMocks, transactionsMocks,
} from '../../test-mocks';

const accountCalls = vi.hoisted(() => [] as unknown[]);
const invoice = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('../../api/hooks/useInvoices', () => invoicesMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useAccounts', () => {
  const base = accountsMocks();
  return { ...base, useAccounts: (filters?: unknown) => { accountCalls.push(filters); return base.useAccounts(); } };
});
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePayments', () => paymentsMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
const urls = vi.hoisted(() => [] as string[]);
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    apiClient: vi.fn(async (url: string) => {
      urls.push(url);
      return url.startsWith('/invoices/') ? { invoice: invoice.current } : { data: [], total: 0 };
    }),
  };
});

import { InvoiceForm } from './InvoiceForm';

const base = {
  id: 'i1', txnType: 'invoice', contactId: 'c1', txnDate: '2026-11-03', total: '100.0000', txnNumber: '1043',
  billableCosts: [],
};
const ln = (p: Record<string, unknown>) => ({
  id: `l${Math.random()}`, debit: '0.0000', credit: '0.0000', description: null, quantity: null, unitPrice: null,
  isTaxable: false, taxRate: '0.0000', taxAmount: '0.0000', lineOrder: 0, tagId: null, contactId: null, ...p,
});

beforeEach(() => { accountCalls.length = 0; urls.length = 0; });

describe('InvoiceForm load (N-1)', () => {
  it('opens a stored invoice; every account query stays within the schema limit of 500', async () => {
    invoice.current = {
      ...base,
      lines: [
        ln({ accountId: 'ar', accountSystemTag: 'accounts_receivable', debit: '100.0000' }),
        ln({ accountId: 'rev', accountSystemTag: null, credit: '100.0000', quantity: '1.0000', unitPrice: '100.0000', description: 'Mowing' }),
      ],
    };
    renderRoute(<InvoiceForm />, { route: '/invoices/i1/edit', path: '/invoices/:id/edit' });
    await waitFor(() => expect(screen.getByText('Edit Invoice')).toBeTruthy());
    await waitFor(() => expect(screen.getAllByDisplayValue('Mowing').length).toBeGreaterThan(0));
    for (const f of accountCalls) {
      const limit = (f as { limit?: number } | undefined)?.limit;
      expect(limit === undefined || limit <= 500).toBe(true);
    }
    for (const u of urls.filter((x) => x.startsWith('/accounts'))) {
      const limit = new URLSearchParams(u.split('?')[1] ?? '').get('limit');
      expect(limit === null || Number(limit) <= 500).toBe(true);
    }
  });

  it('refuses to load (an error, no lines) when no line is recognised as A/R', async () => {
    invoice.current = {
      ...base,
      lines: [
        ln({ accountId: 'ar', debit: '100.0000' }),
        ln({ accountId: 'rev', credit: '100.0000', quantity: '1.0000', unitPrice: '100.0000', description: 'Mowing' }),
      ],
    };
    renderRoute(<InvoiceForm />, { route: '/invoices/i1/edit', path: '/invoices/:id/edit' });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/accounts receivable line/));
    expect(screen.queryByDisplayValue('Mowing')).toBeNull();
    expect(screen.queryByText('Save Changes')).toBeNull();
  });
});
