// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  invoicesMocks, contactsMocks, accountsMocks, itemsMocks, companyMocks,
  tagsMocks, aiMocks, paymentsMocks, transactionsMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useInvoices', () => invoicesMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useItems', () => itemsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/usePayments', () => paymentsMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], invoice: null, total: 0 }) };
});

import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetailPage } from './InvoiceDetailPage';
import { InvoiceTemplateEditor } from './InvoiceTemplateEditor';
import { ReceivePaymentPage } from './ReceivePaymentPage';

describe('invoicing pages', () => {
  for (const [name, Component, route, path] of [
    ['InvoiceForm', InvoiceForm, '/invoices/new', '/invoices/new'],
    ['InvoiceDetailPage', InvoiceDetailPage, '/invoices/i1', '/invoices/:id'],
    ['InvoiceTemplateEditor', InvoiceTemplateEditor, '/settings/invoice-template', '/settings/invoice-template'],
    ['ReceivePaymentPage', ReceivePaymentPage, '/receive-payment', '/receive-payment'],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />, { route, path });
      // Smoke check: the component mounted and emitted *some* content.
      // Headings/status cover realistic cases; fall back to a non-empty body
      // for pages that render "not found" / "loading" text-only states.
      const headings = screen.queryAllByRole('heading');
      const statuses = screen.queryAllByRole('status');
      const hasText = (document.body.textContent?.trim().length ?? 0) > 0;
      expect(headings.length + statuses.length > 0 || hasText).toBe(true);
    });
  }
});
