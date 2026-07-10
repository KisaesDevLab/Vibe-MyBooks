// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PortalFinancialsPage review fixes:
//   FC1 — API URLs are BASE_URL-prefixed (subpath installs)
//   FH1 — image blocks render in the portal ReportSnapshot
//   FH4 — expanded report is a sibling of the toggle button (inner
//         clicks don't collapse it; PDF link isn't nested in a button)
//   FM9 — load failure shows an error state with a working Retry
//   FL5 — null KPI values render as an em dash, not "null"

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

vi.mock('./PortalLayout', () => ({
  usePortal: () => ({
    me: {
      contact: { id: 'c1', email: 'client@example.com', firstName: 'Cli', lastName: 'Ent', companies: [] },
      preview: null,
    },
    activeCompanyId: 'co1',
    fullName: 'Cli Ent',
    refresh: async () => {},
  }),
}));

import { PortalFinancialsPage } from './PortalFinancialsPage';

const report = {
  id: 'r1',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  publishedAt: '2026-04-02T00:00:00.000Z',
  version: 1,
  pdfUrl: '/files/r1.pdf',
  data: {
    kpis: { net_income: null },
    kpi_names: { net_income: 'Net Income' },
  },
  layout: [
    { id: 'k1', type: 'kpi-row', kpis: ['net_income'] },
    { id: 'img1', type: 'image', src: 'https://cdn.example.com/logo.png' },
  ],
};

const fetchMock = vi.fn();

function okResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Simulate a subpath install so a bare '/api/...' URL would visibly
  // differ from the required BASE_URL-prefixed one.
  vi.stubEnv('BASE_URL', '/mb/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('PortalFinancialsPage', () => {
  it('FC1: fetches the list and links the PDF with BASE_URL-prefixed paths', async () => {
    fetchMock.mockImplementation(() => okResponse({ reports: [report] }));
    renderRoute(<PortalFinancialsPage />);

    await waitFor(() => expect(screen.getByText('2026-01-01 → 2026-03-31')).toBeTruthy());
    const requested = String(fetchMock.mock.calls[0]?.[0]);
    expect(requested).toBe('/mb/api/portal/financials?companyId=co1');

    const pdfLink = screen.getByText('PDF').closest('a');
    expect(pdfLink?.getAttribute('href')).toBe('/mb/api/portal/financials/r1/download');
  });

  it('FH4: PDF link is not nested inside a button and inner clicks keep the report open (FH1: image block renders)', async () => {
    fetchMock.mockImplementation(() => okResponse({ reports: [report] }));
    renderRoute(<PortalFinancialsPage />);

    await waitFor(() => expect(screen.getByText('2026-01-01 → 2026-03-31')).toBeTruthy());

    // The PDF anchor must not live inside the toggle <button> (invalid HTML).
    const pdfLink = screen.getByText('PDF').closest('a');
    expect(pdfLink).toBeTruthy();
    expect(pdfLink!.closest('button')).toBeNull();

    // Expand the report via the header toggle.
    fireEvent.click(screen.getByText('2026-01-01 → 2026-03-31'));

    // FH1 — the image block renders.
    const img = document.querySelector('img[src="https://cdn.example.com/logo.png"]');
    expect(img).toBeTruthy();

    // FL5 — null KPI renders as an em dash, never the string "null".
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();

    // FH4 — clicking inside the expanded snapshot must not collapse it.
    fireEvent.click(screen.getByText('Net Income'));
    expect(document.querySelector('img[src="https://cdn.example.com/logo.png"]')).toBeTruthy();
    expect(screen.getByText('Net Income')).toBeTruthy();
  });

  it('FM9: load failure shows an error with Retry, and Retry recovers', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    fetchMock.mockImplementation(() => okResponse({ reports: [] }));
    renderRoute(<PortalFinancialsPage />);

    await waitFor(() => expect(screen.getByText('Failed to load reports.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('No reports published yet.')).toBeTruthy());
  });

  it('shows a spinner (not bare text) while loading', async () => {
    let resolveFetch!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((res) => { resolveFetch = res; }));
    renderRoute(<PortalFinancialsPage />);

    expect(screen.getByRole('status')).toBeTruthy();

    resolveFetch({ ok: true, status: 200, json: async () => ({ reports: [] }) } as Response);
    await waitFor(() => expect(screen.getByText('No reports published yet.')).toBeTruthy());
  });

  it('wave 2: renders the new payload types (budget vs actual, tag segments, sales tax, BS sections, KPI status dot, empty kpi-row note)', async () => {
    const wave2Report = {
      ...report,
      id: 'r2',
      layout: [
        { id: 'k1', type: 'kpi-row', kpis: ['gross_margin_pct'] },
        { id: 'k2', type: 'kpi-row', kpis: [] },
        { id: 'bva1', type: 'block', name: 'budget_vs_actual', budgetId: 'b1' },
        { id: 'ts1', type: 'tag-segment', tags: ['t1', 't2'] },
        { id: 'stx1', type: 'report', key: 'sales_tax' },
        { id: 'bs1', type: 'report', key: 'balance_sheet' },
        // Errored block — the portal must silently skip it.
        { id: 'bad1', type: 'block', name: 'budget_vs_actual' },
      ],
      data: {
        kpis: { gross_margin_pct: '41.0%' },
        kpi_names: { gross_margin_pct: 'Gross Margin %' },
        kpi_status: { gross_margin_pct: 'green' },
        blocks: {
          bva1: {
            type: 'budget_vs_actual',
            data: {
              budgetName: 'FY26 Plan',
              fiscalYear: 2026,
              rows: [{ account: 'Sales', budgeted: 3000, actual: 2500, variance: -500, variancePct: -16.7 }],
              totals: { budgeted: 3000, actual: 2500, variance: -500 },
              truncated: false,
            },
          },
          ts1: {
            type: 'tag_segments',
            data: [
              { tagId: 't1', tagName: 'Location A', revenue: 1000, expenses: 400, netIncome: 600 },
              { tagId: 't2', tagName: 'Location B', revenue: 500, expenses: 200, netIncome: 300 },
            ],
          },
          stx1: { type: 'sales_tax', data: { totalSales: 150, totalTax: 12.25 } },
          bs1: {
            type: 'balance_sheet',
            data: {
              assets: 1000,
              liabilities: 200,
              equity: 800,
              sections: {
                currentAssets: 400,
                fixedAssets: 500,
                otherAssets: 100,
                currentLiabilities: 150,
                longTermLiabilities: 50,
              },
            },
          },
          bad1: { type: 'budget_vs_actual', error: 'No budget selected' },
        },
      },
    };
    fetchMock.mockImplementation(() => okResponse({ reports: [wave2Report] }));
    renderRoute(<PortalFinancialsPage />);

    await waitFor(() => expect(screen.getByText('2026-01-01 → 2026-03-31')).toBeTruthy());
    fireEvent.click(screen.getByText('2026-01-01 → 2026-03-31'));

    // Budget vs actual table (per-line row + totals row).
    expect(screen.getByText(/Budget vs\. actual — FY26 Plan/i)).toBeTruthy();
    expect(screen.getAllByText('$3,000').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('-$500').length).toBeGreaterThanOrEqual(2);

    // Tag segments table.
    expect(screen.getByText('Location A')).toBeTruthy();
    expect(screen.getByText('Location B')).toBeTruthy();

    // Sales tax embed.
    expect(screen.getByText('Sales tax collected')).toBeTruthy();

    // Balance-sheet section subtotals, indented under the totals.
    expect(screen.getByText('Current assets')).toBeTruthy();
    expect(screen.getByText('Long-term liabilities')).toBeTruthy();

    // KPI status dot + empty kpi-row note.
    expect(screen.getByTitle('Status: green')).toBeTruthy();
    expect(screen.getByText('No KPIs selected.')).toBeTruthy();

    // Errored block renders nothing — no error copy leaks to the client.
    expect(screen.queryByText(/No budget selected/)).toBeNull();
  });
});
