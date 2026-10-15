// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Tickmarks, notes and sign-offs are scoped to the workpaper PERIOD END
// (migration 0208). The grid, the leadsheets page and the cell picker
// must ask for — and write to — the period end shown in the TB header,
// never a bare tax year.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});
vi.mock('../../providers/CompanyProvider', async () => {
  const actual = await vi.importActual<typeof import('../../providers/CompanyProvider')>('../../providers/CompanyProvider');
  return { ...actual, useCompanyContext: () => ({ activeCompanyId: 'c1' }) };
});

import { TbWorkpaperPage } from './TbWorkpaperPage';
import { TbLeadsheetsPage } from './TbLeadsheetsPage';
import { TickmarkCellPicker } from './TickmarkCellPicker';

const ACCOUNT = 'acc-cash';
const fiscal = {
  fiscalYearStartMonth: 1, accountingMethod: 'accrual', currentTaxYear: 2026,
  currentFiscalYearEnd: '2026-12-31', priorFiscalYearEnd: '2025-12-31',
};
const workpaper = (periodEnd: string) => ({
  companyId: 'c1', periodEnd, fyStart: '2026-01-01', taxYear: 2026, basis: 'accrual', glVersionStamp: 1,
  rows: [{
    accountId: ACCOUNT, accountNumber: '1000', name: 'Operating Cash', accountType: 'asset', detailType: 'bank', isVirtualRe: false,
    unadjusted: 100, aje: 0, adjusted: 100, taxRje: 0, tax: 100, units: [], byTag: [],
  }],
  totals: {},
});

function route(url: string): unknown {
  const u = new URL(url, 'http://x');
  const pe = u.searchParams.get('periodEnd');
  switch (u.pathname) {
    case '/tb/profile': return { profile: null, pinnedVersion: null, fiscal };
    case '/tb/workpaper': return { workpaper: workpaper(pe ?? '2026-12-31') };
    case '/tb/tickmarks': return { tickmarks: [{ id: 't-july', symbol: 'J7', description: 'July-only mark', color: null }] };
    // Only 07/31 carries a mark — 08/31 starts blank (no roll-forward).
    case '/tb/tickmark-applications':
      return { applications: pe === '2026-07-31' ? [{ id: 'app-1', accountId: ACCOUNT, column: 'adjusted', tickmarkId: 't-july', note: null }] : [] };
    case '/tb/notes': return { notes: [] };
    case '/tb/signoffs': return { signoffs: [], currentStamp: 1 };
    case '/tb/groupings': return { groupings: [{ id: 'g1', name: 'Cash', leadsheetCode: 'A', sortOrder: 0, accountIds: [ACCOUNT] }] };
    case '/tb/row-attachments': return { attachments: [] };
    case '/tb/diagnostics': return { diagnostics: [], errorCount: 0, warningCount: 0 };
    case '/tb/activity-units': return { units: [] };
    case '/tb/status': return { status: { workflowState: 'open' } };
    case '/tb/assignments': return { assignments: [] };
    case '/tb/available-codes': return { returnForm: '1120S', activityType: 'business', seedCodes: [], firmCodes: [] };
    case '/tags': return { tags: [], data: [], total: 0 };
    case '/auth/me': return { user: { id: 'u1', displayPreferences: {} } };
    default: return { data: [], total: 0 };
  }
}

const urls = () => apiClientMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  sessionStorage.clear();
  apiClientMock.mockReset();
  apiClientMock.mockImplementation(async (url: string) => route(url));
});

describe('TB grid — tickmarks follow the period end', () => {
  it('07/31: fetches marks for 07/31 and shows them', async () => {
    sessionStorage.setItem('vibe:tb:periodEnd', JSON.stringify('2026-07-31'));
    renderRoute(<TbWorkpaperPage />);
    await screen.findByText('Operating Cash');
    expect((await screen.findAllByText('J7')).length).toBeGreaterThan(0); // cell chip + Tickmark column
    expect(urls()).toContain('/tb/tickmark-applications?periodEnd=2026-07-31');
    expect(urls().some((u) => u.startsWith('/tb/tickmark-applications?taxYear='))).toBe(false);
  });

  it('08/31: asks for 08/31 and shows none of 07/31\'s marks', async () => {
    sessionStorage.setItem('vibe:tb:periodEnd', JSON.stringify('2026-08-31'));
    renderRoute(<TbWorkpaperPage />);
    await screen.findByText('Operating Cash');
    await waitFor(() => expect(urls()).toContain('/tb/tickmark-applications?periodEnd=2026-08-31'));
    expect(screen.queryByText('J7')).toBeNull();
    expect(urls()).not.toContain('/tb/tickmark-applications?periodEnd=2026-07-31');
  });
});

describe('Leadsheets — marks, notes and sign-offs are read per period end', () => {
  it('requests every period-scoped list with the header date', async () => {
    sessionStorage.setItem('vibe:tb:periodEnd', JSON.stringify('2026-07-31'));
    renderRoute(<TbLeadsheetsPage />);
    await waitFor(() => {
      expect(urls()).toContain('/tb/tickmark-applications?periodEnd=2026-07-31');
      expect(urls()).toContain('/tb/notes?periodEnd=2026-07-31');
      expect(urls()).toContain('/tb/signoffs?periodEnd=2026-07-31');
    });
    expect(urls().some((u) => /^\/tb\/(notes|signoffs|tickmark-applications)\?taxYear=/.test(u))).toBe(false);
  });
});

describe('TickmarkCellPicker — writes carry the period end', () => {
  it('applies a mark to the picker\'s period end', async () => {
    renderRoute(
      <TickmarkCellPicker accountId={ACCOUNT} accountName="Operating Cash" periodEnd="2026-08-31" initialColumn="adjusted" onClose={() => undefined} />,
    );
    expect(await screen.findByText(/period end 2026-08-31/)).toBeTruthy();
    fireEvent.click(await screen.findByText('July-only mark'));
    await waitFor(() => {
      const post = apiClientMock.mock.calls.find((c) => c[0] === '/tb/tickmark-applications' && (c[1] as { method?: string })?.method === 'POST');
      expect(post).toBeTruthy();
      expect(JSON.parse(String((post![1] as { body: string }).body))).toMatchObject({ periodEnd: '2026-08-31', accountId: ACCOUNT, column: 'adjusted', tickmarkId: 't-july' });
    });
    expect(urls()).toContain('/tb/tickmark-applications?periodEnd=2026-08-31');
  });
});
