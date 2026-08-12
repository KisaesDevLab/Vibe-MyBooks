// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PORTAL_BILL_PAY_V1 page:
//   - fetches are BASE_URL-prefixed
//   - featureEnabled:false / 403 render the not-enabled state
//   - selecting bills shows the sticky pay bar; confirm POSTs and
//     refetches; queued payments section renders
//   - unconfigured company disables selection and shows the notice

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

vi.mock('./PortalLayout', () => ({
  usePortal: () => ({
    me: {
      contact: {
        id: 'c1',
        email: 'client@example.com',
        firstName: 'Cli',
        lastName: 'Ent',
        companies: [
          {
            companyId: 'co1', companyName: 'Co One', role: 'owner', assignable: true,
            financialsAccess: true, filesAccess: true, questionsForUsAccess: true,
            bankingAccess: false, billPayAccess: true,
          },
        ],
      },
      preview: null,
    },
    activeCompanyId: 'co1',
    fullName: 'Cli Ent',
    refresh: async () => {},
  }),
}));

import { PortalBillsPage } from './PortalBillsPage';

const bills = [
  {
    id: 'b1', vendorName: 'ACME Supplies', vendorInvoiceNumber: 'INV-100',
    txnDate: '2026-08-01', dueDate: '2026-08-15', total: '100.0000',
    amountPaid: '0', balanceDue: '100.0000', billStatus: 'unpaid', daysOverdue: 0,
  },
  {
    id: 'b2', vendorName: 'Utility Co', vendorInvoiceNumber: null,
    txnDate: '2026-07-01', dueDate: '2026-07-15', total: '75.0000',
    amountPaid: '0', balanceDue: '75.0000', billStatus: 'overdue', daysOverdue: 28,
  },
];

const queued = [
  {
    paymentId: 'p1', vendorName: 'Old Vendor', amount: '42.0000', txnDate: '2026-08-10',
    bills: [{ vendorInvoiceNumber: 'INV-42', amount: '42.0000' }],
  },
];

function body(overrides: Record<string, unknown> = {}) {
  return { featureEnabled: true, configured: true, bills, queuedPayments: queued, ...overrides };
}

const fetchMock = vi.fn();

function okResponse(payload: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: async () => payload } as Response);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BASE_URL', '/mb/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('PortalBillsPage', () => {
  it('fetches with BASE_URL prefix and renders bills + queued payments', async () => {
    fetchMock.mockImplementation(() => okResponse(body()));
    renderRoute(<PortalBillsPage />);

    await waitFor(() => expect(screen.getByText('ACME Supplies')).toBeTruthy());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/mb/api/portal/bills?companyId=co1');

    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText(/28d overdue/)).toBeTruthy();
    expect(screen.getByText('Old Vendor')).toBeTruthy();
    expect(screen.getByText(/Check pending/)).toBeTruthy();
  });

  it('featureEnabled:false renders the not-enabled state', async () => {
    fetchMock.mockImplementation(() =>
      okResponse({ featureEnabled: false, configured: false, bills: [], queuedPayments: [] }),
    );
    renderRoute(<PortalBillsPage />);

    await waitFor(() =>
      expect(screen.getByText('Bill payments are not enabled for your account.')).toBeTruthy(),
    );
    expect(screen.queryByText('ACME Supplies')).toBeNull();
  });

  it('selecting bills shows the pay bar; confirm POSTs billIds and refetches', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return okResponse({ payments: [{ vendorName: 'ACME Supplies', amount: '100', billCount: 1 }], skipped: [] });
      }
      return okResponse(body());
    });
    renderRoute(<PortalBillsPage />);

    await waitFor(() => expect(screen.getByText('ACME Supplies')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(screen.getByRole('button', { name: 'Pay bill' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pay bill' }));
    await waitFor(() => expect(screen.getByText('Confirm payment request')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.getByText(/1 check queued/)).toBeTruthy());
    const postCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(String(postCall?.[0])).toBe('/mb/api/portal/bills/mark');
    expect(JSON.parse(String((postCall?.[1] as RequestInit).body))).toEqual({
      companyId: 'co1',
      billIds: ['b1'],
    });
    // Refetched after submit: initial GET + refetch GET + POST ≥ 3 calls.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('unconfigured company shows the notice and disables selection', async () => {
    fetchMock.mockImplementation(() => okResponse(body({ configured: false, queuedPayments: [] })));
    renderRoute(<PortalBillsPage />);

    await waitFor(() =>
      expect(screen.getByText(/aren't set up for your company yet/)).toBeTruthy(),
    );
    const box = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(box.disabled).toBe(true);
  });

  it('409 conflict surfaces the refresh message', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: { message: 'One or more bills were just paid by someone else. Refresh and try again.' } }),
        } as Response);
      }
      return okResponse(body());
    });
    renderRoute(<PortalBillsPage />);

    await waitFor(() => expect(screen.getByText('ACME Supplies')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Pay bill' }));
    await waitFor(() => expect(screen.getByText('Confirm payment request')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(screen.getByText(/just paid by someone else/)).toBeTruthy(),
    );
  });
});
