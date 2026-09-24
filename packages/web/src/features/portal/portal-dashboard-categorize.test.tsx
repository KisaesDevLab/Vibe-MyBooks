// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PORTAL_CATEGORIZE_V1 — the client's home screen.
//
// Transactions waiting on the client are the only thing on this page that
// blocks their bookkeeper, so they lead the page rather than sitting in the
// quick-link row underneath the counters. When nothing is waiting the loud
// banner goes away, but the quiet card stays: it is the only route into
// /portal/categorize, which has no nav entry.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

vi.mock('./PortalLayout', () => ({
  usePortal: () => ({
    me: {
      contact: {
        id: 'c1', email: 'client@example.com', firstName: 'Irene', lastName: 'Ives',
        companies: [{
          companyId: 'co1', companyName: 'TimberStone LLC', role: 'owner', assignable: true,
          financialsAccess: true, filesAccess: true, questionsForUsAccess: true,
          bankingAccess: false, billPayAccess: false, categorizeAccess: true,
        }],
      },
      preview: null,
    },
    activeCompanyId: 'co1',
    fullName: 'Irene Ives',
    refresh: async () => {},
  }),
}));
vi.mock('./PortalBankRepair', () => ({ PortalBankRepairBanner: () => null }));

import { PortalDashboardPage } from './PortalDashboardPage';

let queueTotal = 42;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (String(url).includes('/portal/categorize/queue')) {
      return Promise.resolve({ ok: true, json: async () => ({ featureEnabled: true, total: queueTotal }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ open: [], receipts: [], reports: [], items: [] }) });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('PortalDashboardPage — transactions needing the client', () => {
  it('leads with a banner above the counters when rows are waiting', async () => {
    queueTotal = 42;
    renderRoute(<PortalDashboardPage />);
    const banner = await screen.findByText('42 transactions need your input');
    const link = banner.closest('a');
    expect(link?.getAttribute('href')).toBe('/portal/categorize');
    // Above the three counter tiles, not below them.
    const tile = screen.getByText('Open questions');
    expect(link!.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Said once — the quiet duplicate at the bottom is gone.
    expect(screen.queryByText('Categorize transactions')).toBeNull();
  });

  it('says it in the singular for one row', async () => {
    queueTotal = 1;
    renderRoute(<PortalDashboardPage />);
    expect(await screen.findByText('1 transaction needs your input')).toBeTruthy();
  });

  it('drops the banner but keeps the way in when nothing is waiting', async () => {
    queueTotal = 0;
    renderRoute(<PortalDashboardPage />);
    await waitFor(() => expect(screen.getByText('Categorize transactions')).toBeTruthy());
    expect(screen.queryByText(/need your input/)).toBeNull();
    expect(screen.getByText('Nothing is waiting on you right now.')).toBeTruthy();
  });
});
