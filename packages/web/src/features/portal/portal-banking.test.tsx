// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PORTAL_BANKING_V1 pages:
//   - fetches are BASE_URL-prefixed (subpath installs)
//   - featureEnabled:false renders the not-enabled state, no cards
//   - transient failure shows Retry, and Retry recovers
//   - register renders line cards and "Load more" appends page 2

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
            bankingAccess: true, billPayAccess: false,
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

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useParams: () => ({ accountId: 'acct1' }), useNavigate: () => vi.fn() };
});

import { PortalBankingPage } from './PortalBankingPage';
import { PortalBankingRegisterPage } from './PortalBankingRegisterPage';

const accounts = [
  { id: 'acct1', name: 'Operating Checking', accountNumber: '1010', kind: 'bank', detailType: 'bank', balance: 1500.25 },
  { id: 'acct2', name: 'Business Card', accountNumber: null, kind: 'card', detailType: 'credit_card', balance: 321 },
];

function registerPage(page: number) {
  return {
    account: { id: 'acct1', name: 'Operating Checking', kind: 'bank' },
    currentBalance: 1500.25,
    startDate: '2026-05-14',
    endDate: '2026-08-12',
    lines: [
      {
        id: `l${page}-1`,
        date: '2026-08-0' + page,
        description: page === 1 ? 'ACME Supplies' : 'Utility Co',
        category: 'Office Supplies',
        checkNumber: page === 1 ? 1042 : null,
        payment: 45.5,
        deposit: null,
        runningBalance: 1000 + page,
      },
    ],
    pagination: { page, perPage: 50, totalRows: 100, totalPages: 2 },
  };
}

const fetchMock = vi.fn();

function okResponse(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
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

describe('PortalBankingPage', () => {
  it('fetches with BASE_URL prefix and renders account cards', async () => {
    fetchMock.mockImplementation(() => okResponse({ featureEnabled: true, asOf: '2026-08-12', accounts }));
    renderRoute(<PortalBankingPage />);

    await waitFor(() => expect(screen.getByText('Operating Checking')).toBeTruthy());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/mb/api/portal/banking/accounts?companyId=co1');

    expect(screen.getByText('$1,500.25')).toBeTruthy();
    expect(screen.getByText('$321.00')).toBeTruthy();
    expect(screen.getByText('Balance owed')).toBeTruthy();

    const link = screen.getByText('Operating Checking').closest('a');
    expect(link?.getAttribute('href')).toBe('/portal/banking/acct1');
  });

  it('featureEnabled:false renders the not-enabled state with no cards', async () => {
    fetchMock.mockImplementation(() => okResponse({ featureEnabled: false, accounts: [] }));
    renderRoute(<PortalBankingPage />);

    await waitFor(() =>
      expect(screen.getByText('Bank & card activity is not enabled for your account.')).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByText('Operating Checking')).toBeNull();
  });

  it('transient failure shows Retry, and Retry recovers', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    fetchMock.mockImplementation(() => okResponse({ featureEnabled: true, accounts: [] }));
    renderRoute(<PortalBankingPage />);

    await waitFor(() => expect(screen.getByText('Failed to load accounts.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No accounts shared yet.')).toBeTruthy());
  });
});

describe('PortalBankingRegisterPage', () => {
  it('renders line cards and Load more appends the next page', async () => {
    fetchMock.mockImplementation((url: string) => {
      const page = new URL(String(url), 'http://x').searchParams.get('page');
      return okResponse(registerPage(page === '2' ? 2 : 1));
    });
    renderRoute(<PortalBankingRegisterPage />);

    await waitFor(() => expect(screen.getByText(/ACME Supplies/)).toBeTruthy());
    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(firstUrl.startsWith('/mb/api/portal/banking/accounts/acct1/register?')).toBe(true);
    expect(firstUrl).toContain('companyId=co1');

    // Sanitized display bits: check number chip, payment amount, running balance.
    expect(screen.getByText(/Check #1042/)).toBeTruthy();
    expect(screen.getByText('-$45.50')).toBeTruthy();
    expect(screen.getByText(/Balance \$1,001\.00/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getByText(/Utility Co/)).toBeTruthy());
    // Page 1 lines are still on screen (append, not replace).
    expect(screen.getByText(/ACME Supplies/)).toBeTruthy();
    const lastUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('page=2');
  });
});
