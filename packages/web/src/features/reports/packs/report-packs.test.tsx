// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderRoute, expectPageRendered } from '../../../test-utils';
import { REPORT_CATALOG, PACK_MAX_COUNT } from '@kis-books/shared';
import type { ReportPackListItem } from '../../../api/hooks/useReportPacks';

// The pack pages call useCompanyContext at render time (builder shows the
// pinned company name); supply a static context.
vi.mock('../../../providers/CompanyProvider', () => ({
  CompanyProvider: ({ children }: { children: React.ReactNode }) => children,
  useCompanyContext: () => ({
    activeCompanyId: 'co1',
    companies: [],
    activeCompanyName: 'Acme Co',
    setActiveCompany: () => {},
    refreshCompanies: () => {},
    clearActiveCompany: () => {},
  }),
}));

// company settings hook (DateRangePicker reads fiscalYearStartMonth).
vi.mock('../../../api/hooks/useCompany', () => ({
  useCompanySettings: () => ({ data: { settings: { fiscalYearStartMonth: 1 } } }),
}));

// New hooks — mocked so the pages render without a network. Each test
// customizes the query results it cares about via the mutable holders below.
const catalogHolder = { data: { catalog: REPORT_CATALOG }, isLoading: false, isError: false, refetch: vi.fn() };
const packsHolder: { data: { packs: ReportPackListItem[] }; isLoading: boolean; isError: boolean; refetch: () => void } = {
  data: { packs: [] },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('../../../api/hooks/useReportPacks', () => ({
  useReportCatalog: () => catalogHolder,
  useReportPacks: () => packsHolder,
  useReportPack: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateReportPack: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateReportPack: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteReportPack: () => ({ mutate: vi.fn(), isPending: false }),
  useDuplicateReportPack: () => ({ mutate: vi.fn(), isPending: false }),
  useCreatePackRun: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReportPackRun: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  downloadPackPdf: vi.fn(),
}));

import { ReportPackBuilderPage } from './ReportPackBuilderPage';
import { ReportPacksListPage } from './ReportPacksListPage';

function samplePack(overrides: Partial<ReportPackListItem> = {}): ReportPackListItem {
  return {
    id: 'p1',
    tenantId: 't1',
    companyId: 'co1',
    name: 'Board Package',
    description: 'Monthly board reports',
    periodPreset: 'this-month',
    customRangeStart: null,
    customRangeEnd: null,
    asOfMode: 'range-end',
    asOfCustom: null,
    defaultBasis: 'accrual',
    defaultTagId: null,
    coverPage: true,
    toc: true,
    pageNumbers: true,
    pageFooter: null,
    filenameTemplate: '{pack}-{date}',
    onError: 'skip',
    createdBy: 'u1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    deletedAt: null,
    itemCount: 3,
    ...overrides,
  };
}

describe('ReportPackBuilderPage', () => {
  beforeEach(() => {
    catalogHolder.data = { catalog: REPORT_CATALOG };
  });

  it('renders the catalog and adds a report to the pack when checked', () => {
    renderRoute(<ReportPackBuilderPage />, { route: '/reports/packs/new', path: '/reports/packs/new' });
    expectPageRendered();

    // Every catalog report is offered as a checkbox in the left pane.
    const firstReport = REPORT_CATALOG[0]!;
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(REPORT_CATALOG.length);

    // Nothing selected yet.
    expect(screen.getByText(`0 of ${PACK_MAX_COUNT} selected`, { exact: false })).toBeTruthy();

    // Check the first report → it appears in the right-hand ordered list and
    // the counter increments.
    const cb = screen.getByRole('checkbox', { name: new RegExp(firstReport.label, 'i') });
    fireEvent.click(cb);
    expect(screen.getByText(`1 of ${PACK_MAX_COUNT} selected`, { exact: false })).toBeTruthy();
    // The remove control for the added report proves it's in the pack list.
    expect(screen.getByLabelText(`Remove ${firstReport.label}`)).toBeTruthy();
  });

  it('exposes P&L per-report options (basis, grouping, compare, % of income) once added', () => {
    renderRoute(<ReportPackBuilderPage />, { route: '/reports/packs/new', path: '/reports/packs/new' });

    // No options are shown until a report is in the pack.
    expect(screen.queryByLabelText(/Profit & Loss basis/i)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /Profit & Loss/i }));

    // The P&L catalog spec declares basis + groupBy + compare + showPct + tag.
    expect(screen.getByLabelText(/Profit & Loss basis/i)).toBeTruthy();
    expect(screen.getByLabelText(/Profit & Loss grouping/i)).toBeTruthy();
    expect(screen.getByLabelText(/Profit & Loss compare to prior period/i)).toBeTruthy();
    expect(screen.getByLabelText(/Profit & Loss percent of income/i)).toBeTruthy();
  });

  it('shows no options for a report whose spec declares only a tag filter, plus its tag control', () => {
    renderRoute(<ReportPackBuilderPage />, { route: '/reports/packs/new', path: '/reports/packs/new' });

    // Cash Flow only offers a tag filter — no basis / compare / grouping.
    fireEvent.click(screen.getByRole('checkbox', { name: /Cash Flow Statement/i }));
    expect(screen.queryByLabelText(/Cash Flow Statement basis/i)).toBeNull();
    expect(screen.queryByLabelText(/Cash Flow Statement compare to prior period/i)).toBeNull();
  });

  it('disables adding more reports once the cap is reached', () => {
    // A catalog padded past the cap so we can exercise the 30-report ceiling.
    const padded = Array.from({ length: PACK_MAX_COUNT + 3 }, (_, i) => ({
      ...REPORT_CATALOG[0]!,
      id: `report-${i}`,
      label: `Report ${i}`,
      group: 'All',
    }));
    catalogHolder.data = { catalog: padded };

    renderRoute(<ReportPackBuilderPage />, { route: '/reports/packs/new', path: '/reports/packs/new' });

    // Select exactly PACK_MAX_COUNT reports.
    for (let i = 0; i < PACK_MAX_COUNT; i++) {
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^Report ${i}$`, 'i') }));
    }
    expect(screen.getByText(`${PACK_MAX_COUNT} of ${PACK_MAX_COUNT} selected`, { exact: false })).toBeTruthy();

    // An unchecked report checkbox is now disabled.
    const overflow = screen.getByRole('checkbox', { name: /^Report 31$/i }) as HTMLInputElement;
    expect(overflow.disabled).toBe(true);
  });
});

describe('ReportPacksListPage', () => {
  beforeEach(() => {
    packsHolder.data = { packs: [] };
    packsHolder.isLoading = false;
    packsHolder.isError = false;
  });

  it('shows an empty state with a create button when there are no packs', () => {
    renderRoute(<ReportPacksListPage />, { route: '/reports/packs' });
    expect(screen.getAllByText(/New Report Pack/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No report packs yet/i)).toBeTruthy();
  });

  it('renders a row per pack with run/edit/duplicate/delete actions', () => {
    packsHolder.data = { packs: [samplePack(), samplePack({ id: 'p2', name: 'Tax Package', itemCount: 5 })] };
    renderRoute(<ReportPacksListPage />, { route: '/reports/packs' });

    expect(screen.getByText('Board Package')).toBeTruthy();
    expect(screen.getByText('Tax Package')).toBeTruthy();

    const table = screen.getByRole('table');
    // Row actions present for the first pack.
    expect(within(table).getByLabelText('Edit Board Package')).toBeTruthy();
    expect(within(table).getByLabelText('Duplicate Board Package')).toBeTruthy();
    expect(within(table).getByLabelText('Delete Board Package')).toBeTruthy();
    expect(within(table).getAllByRole('button', { name: /Run/i }).length).toBe(2);
  });
});
