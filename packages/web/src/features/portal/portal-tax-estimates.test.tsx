// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PortalTaxEstimatesPage (Tax Estimator Phase 13, UI-SPEC §05): renders the
// allow-listed portal DTO only, plus its not-enabled / empty / no_snapshot states.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import type { PortalTaxEstimateDTO } from '@kis-books/shared';
import { renderRoute } from '../../test-utils';

vi.mock('./PortalLayout', () => ({
  usePortal: () => ({
    me: { contact: { id: 'c1', email: 'client@example.com', firstName: 'Maria', lastName: 'Rivera', companies: [] }, preview: null },
    activeCompanyId: 'co1',
    fullName: 'Maria Rivera',
    refresh: async () => {},
  }),
}));

import { PortalTaxEstimatesPage } from './PortalTaxEstimatesPage';

const TP = '11111111-1111-4111-8111-111111111111';
const estimate: PortalTaxEstimateDTO = {
  taxpayer: { id: TP, displayName: 'Rivera Family' },
  taxYear: 2026,
  source: 'live',
  asOf: '2026-10-01T15:00:00.000Z',
  booksThrough: '2026-09',
  firmName: 'Sample CPA Firm',
  disclaimer: 'Projection based on bookkeeping records and the assumptions listed. Not a tax return.',
  totals: { total: '43732', federal: '35829', state: '7902' },
  jurisdictions: [
    {
      jurisdiction: 'federal', label: 'Federal (IRS)', estimatesRequired: true,
      installments: [
        { label: 'Q1', dueDate: '2026-04-15', amount: '6600', paid: '6600', remaining: '0', status: 'paid', paidOn: '2026-04-10' },
        { label: 'Q2', dueDate: '2026-06-15', amount: '6600', paid: '6600', remaining: '0', status: 'paid', paidOn: '2026-06-12' },
        { label: 'Q3', dueDate: '2026-09-15', amount: '6485', paid: '6000', remaining: '485', status: 'unpaid', paidOn: null },
        { label: 'Q4', dueDate: '2027-01-15', amount: '6561', paid: '0', remaining: '6561', status: 'unpaid', paidOn: null },
      ],
      nextPayment: { label: 'Q4', dueDate: '2027-01-15', amount: '7046' },
      totals: { required: '26246', withholding: '4500', estimatesPaid: '19200', remaining: '7046' },
    },
    {
      jurisdiction: 'MO', label: 'Missouri', estimatesRequired: true,
      installments: [{ label: 'Q4', dueDate: '2027-01-15', amount: '1208', paid: '0', remaining: '1208', status: 'unpaid', paidOn: null }],
      nextPayment: { label: 'Q4', dueDate: '2027-01-15', amount: '1208' },
      totals: { required: '1208', withholding: '0', estimatesPaid: '0', remaining: '1208' },
    },
    {
      jurisdiction: 'AR', label: 'Arkansas', estimatesRequired: false, installments: [], nextPayment: null,
      totals: { required: '0', withholding: '0', estimatesPaid: '0', remaining: '0' },
    },
  ],
  payments: [{ date: '2026-04-10', jurisdiction: 'federal', amount: '6600' }],
};

const fetchMock = vi.fn();
const res = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);

function route(handlers: { list: () => Promise<Response>; detail?: () => Promise<Response> }) {
  fetchMock.mockImplementation((url: string) => {
    if (/tax-estimates\?companyId=/.test(url)) return handlers.list();
    if (handlers.detail && new RegExp(`tax-estimates/${TP}\\?`).test(url)) return handlers.detail();
    return res(404, {});
  });
}

const listOk = () => res(200, { featureEnabled: true, taxpayers: [{ id: TP, displayName: 'Rivera Family', years: [2026] }] });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BASE_URL', '/mb/');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const render = () => renderRoute(<PortalTaxEstimatesPage />, { route: '/portal/tax-estimates', path: '/portal/tax-estimates' });

describe('PortalTaxEstimatesPage', () => {
  it('renders next payments, the year total, payment history, vouchers link and the disclaimer', async () => {
    route({ list: listOk, detail: () => res(200, { estimate, unavailableReason: null }) });
    render();
    expect(await screen.findByRole('heading', { name: 'Your 2026 tax estimate' })).toBeTruthy();
    expect(screen.getByText(/Based on your books through Sep 2026/)).toBeTruthy();
    // Next payments: federal + MO amounts, AR none required.
    expect(screen.getByText('$7,046')).toBeTruthy();
    expect(screen.getAllByText('$1,208').length).toBeGreaterThan(0);
    expect(screen.getByText('None required')).toBeTruthy();
    // Projected total block.
    expect(screen.getByText('$43,732')).toBeTruthy();
    expect(screen.getByText('$19,200')).toBeTruthy();
    expect(screen.getByText('$4,500')).toBeTruthy();
    // History badges.
    expect(screen.getAllByText('Paid').length).toBe(2);
    expect(screen.getByText('$485 short')).toBeTruthy();
    // Voucher download + message link + disclaimer.
    const link = screen.getByRole('link', { name: /Download payment vouchers/ });
    expect(link.getAttribute('href')).toBe(`/mb/api/portal/tax-estimates/${TP}/vouchers.pdf?companyId=co1&year=2026`);
    expect(screen.getByRole('link', { name: /Message your accountant/ }).getAttribute('href')).toBe('/portal/questions');
    expect(screen.getByTestId('tax-disclaimer').textContent).toContain('Not a tax return');
    // URLs are BASE_URL-prefixed and company-scoped.
    expect(fetchMock).toHaveBeenCalledWith('/mb/api/portal/tax-estimates?companyId=co1', expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(`/mb/api/portal/tax-estimates/${TP}?companyId=co1&year=2026`, expect.anything());
  });

  it('without a picked year it requests the same default year as the server (newest year not after this one)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    try {
      route({
        list: () => res(200, { featureEnabled: true, taxpayers: [{ id: TP, displayName: 'Rivera Family', years: [2027, 2026] }] }),
        detail: () => res(200, { estimate, unavailableReason: null }),
      });
      render();
      expect(await screen.findByRole('heading', { name: 'Your 2026 tax estimate' })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith(`/mb/api/portal/tax-estimates/${TP}?companyId=co1&year=2026`, expect.anything());
      expect(fetchMock).not.toHaveBeenCalledWith(`/mb/api/portal/tax-estimates/${TP}?companyId=co1&year=2027`, expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it('never shows staff-only concepts (rates, adjustments, other owners, traces)', async () => {
    route({ list: listOk, detail: () => res(200, { estimate, unavailableReason: null }) });
    const { container } = render();
    await screen.findByRole('heading', { name: 'Your 2026 tax estimate' });
    const text = container.textContent ?? '';
    for (const word of [/marginal/i, /adjustment/i, /trace/i, /safe harbor/i, /owner/i, /%/, /AGI/]) expect(text).not.toMatch(word);
  });

  it('shows "not enabled" when the tenant flags are off', async () => {
    route({ list: () => res(200, { featureEnabled: false, taxpayers: [] }) });
    render();
    expect(await screen.findByText(/Tax estimates are not enabled for your account/)).toBeTruthy();
  });

  it('shows "not enabled" when the contact has no access (403/404)', async () => {
    route({ list: () => res(404, {}) });
    render();
    expect(await screen.findByText(/Tax estimates are not enabled for your account/)).toBeTruthy();
  });

  it('shows an empty state when no taxpayer is shared', async () => {
    route({ list: () => res(200, { featureEnabled: true, taxpayers: [] }) });
    render();
    expect(await screen.findByText('No tax estimate shared yet.')).toBeTruthy();
  });

  it('shows a friendly message when the firm shows snapshots and none is finalized', async () => {
    route({ list: listOk, detail: () => res(200, { estimate: null, unavailableReason: 'no_snapshot' }) });
    render();
    expect(await screen.findByText(/has not finalized an estimate for 2026 yet/)).toBeTruthy();
  });

  it('retries after a load failure', async () => {
    let calls = 0;
    route({ list: () => (++calls === 1 ? res(500, {}) : res(200, { featureEnabled: true, taxpayers: [] })) });
    render();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No tax estimate shared yet.')).toBeTruthy());
  });
});
