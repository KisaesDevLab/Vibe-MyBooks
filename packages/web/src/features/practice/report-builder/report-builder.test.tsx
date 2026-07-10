// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// ReportBuilderPage review fixes:
//   FH3 — preview-modal errors/notices render as a dismissible banner
//         ABOVE the report, never replacing it
//   FM1 — instance-row actions have an in-flight guard (second click
//         while busy is a no-op)
//   FM9 — initial-load failure renders error states with a working Retry

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { companyProviderMocks } from '../../../test-mocks';

vi.mock('../../../providers/CompanyProvider', () => companyProviderMocks());

const apiMock = vi.fn();

vi.mock('../../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../../api/client')>('../../../api/client');
  return {
    ...actual,
    apiClient: (path: string, init?: RequestInit) => apiMock(path, init),
  };
});

import { ReportBuilderPage } from './ReportBuilderPage';

const template = {
  id: 't1',
  name: 'Monthly Packet',
  description: null,
  defaultPeriod: 'last_month',
  isPracticeTemplate: true,
};

const draft = {
  id: 'i1',
  templateId: 't1',
  companyId: 'co1',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  status: 'draft',
  publishedAt: null,
  version: 1,
  pdfUrl: null,
};

const instanceDetail = {
  instance: {
    ...draft,
    layoutSnapshotJsonb: [{ id: 'k1', type: 'kpi-row', kpis: ['net_income'] }],
    dataSnapshotJsonb: {
      kpis: { net_income: '$1,000' },
      kpi_names: { net_income: 'Net Income' },
    },
  },
};

function defaultApi(path: string): Promise<unknown> {
  if (path === '/practice/reports/templates') return Promise.resolve({ templates: [template] });
  if (path === '/practice/reports/instances') return Promise.resolve({ instances: [draft] });
  if (path === '/practice/reports/instances/i1') return Promise.resolve(instanceDetail);
  if (path === '/practice/reports/instances/i1/compute') {
    // Non-fatal notice path: no KPI keys found → the modal stores a
    // notice in `error` while the (already computed) data stays valid.
    return Promise.resolve({ keys: [], metricsAvailable: true, error: null });
  }
  if (path === '/practice/reports/instances/i1/status') {
    return Promise.resolve({ ok: true, pdfRendered: true, pdfError: null });
  }
  return Promise.resolve({});
}

beforeEach(() => {
  apiMock.mockReset();
});

describe('ReportBuilderPage', () => {
  it('FM9: initial-load failure shows error states with Retry, and Retry recovers', async () => {
    // Both list calls in the initial Promise.all reject.
    apiMock.mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom'));
    apiMock.mockImplementation(defaultApi);
    renderRoute(<ReportBuilderPage />);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getByText('Templates could not be loaded.')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]!);

    await waitFor(() => expect(screen.getByText('Monthly Packet')).toBeTruthy());
    expect(screen.getByText('2026-06-01 → 2026-06-30')).toBeTruthy();
    expect(screen.queryByText('Templates could not be loaded.')).toBeNull();
  });

  it('FM1: a second Publish click while the first is in flight is a no-op', async () => {
    let statusCalls = 0;
    let resolveStatus!: (v: unknown) => void;
    apiMock.mockImplementation((path: string) => {
      if (path === '/practice/reports/instances/i1/status') {
        statusCalls += 1;
        return new Promise((res) => {
          resolveStatus = res;
        });
      }
      return defaultApi(path);
    });
    renderRoute(<ReportBuilderPage />);

    const publish = await screen.findByRole('button', { name: 'Publish' });
    fireEvent.click(publish);
    fireEvent.click(publish);
    fireEvent.click(publish);
    expect(statusCalls).toBe(1);

    resolveStatus({ ok: true, pdfRendered: true, pdfError: null });
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it('FH3: preview-modal notice renders as a dismissible banner above the still-rendered report', async () => {
    apiMock.mockImplementation(defaultApi);
    renderRoute(<ReportBuilderPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));

    // Modal loaded with data → Recompute is offered; the KPI renders.
    const recompute = await screen.findByRole('button', { name: /Recompute/ });
    expect(screen.getByText('Net Income')).toBeTruthy();

    fireEvent.click(recompute);

    // The compute notice appears as a banner…
    await waitFor(() =>
      expect(screen.getByText(/Layout has no KPI rows yet/)).toBeTruthy(),
    );
    // …while the report body is STILL rendered alongside it.
    expect(screen.getByText('Net Income')).toBeTruthy();
    expect(screen.getByText('$1,000')).toBeTruthy();

    // And the banner is dismissible.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Layout has no KPI rows yet/)).toBeNull();
    expect(screen.getByText('Net Income')).toBeTruthy();
  });

  it('wave 2: preview renders budget vs actual, tag segments, sales tax, KPI status dot, and the error frame', async () => {
    const wave2Detail = {
      instance: {
        ...draft,
        layoutSnapshotJsonb: [
          { id: 'k1', type: 'kpi-row', kpis: ['net_income'] },
          { id: 'bva1', type: 'block', name: 'budget_vs_actual', budgetId: 'b1' },
          { id: 'ts1', type: 'tag-segment', tags: ['t1'] },
          { id: 'stx1', type: 'report', key: 'sales_tax' },
          { id: 'bad1', type: 'block', name: 'budget_vs_actual' },
        ],
        dataSnapshotJsonb: {
          kpis: { net_income: '$1,000' },
          kpi_names: { net_income: 'Net Income' },
          kpi_status: { net_income: 'amber' },
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
              data: [{ tagId: 't1', tagName: 'Location A', revenue: 1000, expenses: 400, netIncome: 600 }],
            },
            stx1: { type: 'sales_tax', data: { totalSales: 150, totalTax: 12.25 } },
            bad1: { type: 'budget_vs_actual', error: 'No budget selected — pick one in the layout editor.' },
          },
        },
      },
    };
    apiMock.mockImplementation((path: string) => {
      if (path === '/practice/reports/instances/i1') return Promise.resolve(wave2Detail);
      return defaultApi(path);
    });
    renderRoute(<ReportBuilderPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));

    await screen.findByText(/Budget vs\. Actual — FY26 Plan/i);
    expect(screen.getByText('Location A')).toBeTruthy();
    expect(screen.getByText('Tag Segments')).toBeTruthy();
    expect(screen.getByText('Sales Tax Collected')).toBeTruthy();
    // KPI status dot (F7).
    expect(screen.getByTitle('Status: amber')).toBeTruthy();
    // The errored block shows its message in the amber frame (preview only).
    expect(screen.getByText(/No budget selected/)).toBeTruthy();
  });
});
