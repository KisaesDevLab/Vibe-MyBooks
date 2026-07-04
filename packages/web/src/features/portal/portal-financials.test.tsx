// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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
});
