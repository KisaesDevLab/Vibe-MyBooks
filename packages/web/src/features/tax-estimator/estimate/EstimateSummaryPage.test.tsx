// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { makeEstimate } from './test-fixtures';

type Q = { data?: unknown; isLoading?: boolean; isError?: boolean; error?: unknown; isFetching?: boolean; refetch: () => void };
const q = (over: Partial<Q> = {}): Q => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over });
const h = vi.hoisted(() => ({
  role: 'firm_staff',
  taxpayer: null as unknown, year: null as unknown, estimate: null as unknown, readiness: null as unknown, ledger: null as unknown,
  download: vi.fn(),
}));
const mut = { mutate: vi.fn(), isPending: false, isError: false, error: null };

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxEstimatorScope: () => ({ data: { firmRole: h.role } }),
  useTaxpayer: () => h.taxpayer,
}));
vi.mock('../../../api/hooks/useTaxEstimatorYears', () => ({
  useYear: () => h.year,
  useFirmSettings: () => ({ data: { effectiveDisclaimerText: 'Firm disclaimer text.' } }),
}));
vi.mock('../../../api/hooks/useTaxEstimatorEstimate', () => ({
  useEstimate: () => h.estimate,
  useEstimateReadiness: () => h.readiness,
  usePaymentLedger: () => h.ledger,
  useCreatePayment: () => mut, useUpdatePayment: () => mut, useDeletePayment: () => mut,
  downloadEstimatePdf: (...a: unknown[]) => h.download(...a),
}));

const finalize = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }));
vi.mock('../../../api/hooks/useTaxEstimatorSnapshots', () => ({
  SNAPSHOTS_KEY: 'tax-estimator-snapshots',
  useFinalizeSnapshot: () => finalize,
  useSnapshots: () => ({ data: { data: [], total: 0, limit: 20, offset: 0 }, isLoading: false, isError: false, refetch: vi.fn() }),
  downloadSnapshotPdf: vi.fn(),
}));

import { EstimateSummaryPage } from './EstimateSummaryPage';

const tp = { taxpayer: { id: 'tp1', displayName: 'Rivera, Daniel & Maria', filingStatus: 'mfj', residentState: 'MO' }, persons: [] };
const yearData = { exists: true, year: {}, scenarios: [{ id: 's1', name: 'Base', isBase: true }, { id: 's2', name: 'Truck', isBase: false }] };
const ledgerData = { payments: [
  { id: 'p1', stored: true, jurisdiction: 'federal', date: '2026-04-15', amount: '6600', source: 'manual', memo: 'Q1', accountName: null, companyName: null },
  { id: 'gl:1', stored: false, jurisdiction: 'MO', date: '2026-04-15', amount: '1208', source: 'gl', memo: null, accountName: 'Est. Tax', companyName: 'Rivera Plumbing LLC' },
], total: 2, totals: { federal: '6600', MO: '1208' } };
const render = () => renderRoute(<EstimateSummaryPage />, { path: '/tp/:id/estimate', route: '/tp/tp1/estimate?year=2026' });

beforeEach(() => {
  vi.clearAllMocks();
  h.role = 'firm_staff';
  h.taxpayer = q({ data: tp });
  h.year = q({ data: yearData });
  h.estimate = q({ data: makeEstimate() });
  h.readiness = q({ data: { entities: [], outOfScopeLinks: 0, schAiPeriods: [], ready: true, warnings: [] } });
  h.ledger = q({ data: ledgerData });
});

describe('EstimateSummaryPage', () => {
  it('shows a spinner while the taxpayer / year loads', () => {
    h.year = q({ isLoading: true });
    render();
    expect(screen.queryByRole('heading', { name: /Tax Estimate/ })).toBeNull();
  });

  it('shows an error with retry when the year fails to load', () => {
    const refetch = vi.fn();
    h.year = q({ isError: true, refetch });
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty: year not set up links to annual settings', () => {
    h.year = q({ data: { exists: false, year: null, scenarios: [] } });
    render();
    expect(screen.getByLabelText('Year not set up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up 2026' })).toHaveAttribute('href', '/tax-estimator/taxpayers/tp1/annual-settings?year=2026');
  });

  it('error: the estimate failure names the missing key from the server message', () => {
    h.estimate = q({ isError: true, error: new Error('TE_PARAM_MISSING: parameter qbi.rate has no value for 2026') });
    render();
    expect(screen.getByText(/qbi\.rate has no value/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('loading: estimate spinner, no figures yet', () => {
    h.estimate = q({ isLoading: true });
    render();
    expect(screen.queryByLabelText('Key figures')).toBeNull();
    expect(screen.getByRole('heading', { name: '2026 Tax Estimate' })).toBeInTheDocument();
  });

  it('empty: no linked entities', () => {
    h.estimate = q({ data: makeEstimate({ entities: [] }) });
    render();
    expect(screen.getByLabelText('No linked entities')).toBeInTheDocument();
  });

  it('data: key figures, calculation, safe harbor, vouchers by jurisdiction, payments, warnings, footer', () => {
    render();
    expect(screen.getByLabelText('Key figures')).toHaveTextContent('$43,731');
    expect(screen.getByLabelText('Books readiness')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '2026 projected' })).toBeInTheDocument();
    expect(screen.getByLabelText('Federal safe harbor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /MO/ }));
    expect(screen.getByLabelText('MO safe harbor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /AR/ }));
    expect(screen.getByText(/No estimated payments required for AR/)).toBeInTheDocument();
    expect(screen.getByLabelText('Payments ledger')).toHaveTextContent('Books (GL)');
    expect(screen.getByLabelText('Warnings')).toHaveTextContent('SEP contribution capped');
    expect(screen.getByText('Firm disclaimer text.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scenarios' })).toBeInTheDocument();
  });

  it('downloads the PDF for the selected scenario', async () => {
    h.download.mockResolvedValue(undefined);
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Print / Download PDF' }));
    await waitFor(() => expect(h.download).toHaveBeenCalledWith('tp1', 2026, 's1', undefined));
  });

  it('shows a PDF error', async () => {
    h.download.mockRejectedValue(new Error('Download failed (500)'));
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Print / Download PDF' }));
    expect(await screen.findByText('Download failed (500)')).toBeInTheDocument();
  });

  it('warns when "actuals through" is after the last closed month', () => {
    h.readiness = q({ data: { entities: [{ tenantId: 't', companyId: 'c', companyName: 'X', inScope: true, readiness: { lastClosedMonth: '2026-06', throughMonth: '2026-06', unreconciledAccounts: [], suspense: { balance: '0', transactionCount: 0 }, unmappedAccounts: [], warnings: [] } }], outOfScopeLinks: 0 } });
    renderRoute(<EstimateSummaryPage />, { path: '/tp/:id/estimate', route: '/tp/tp1/estimate?year=2026&through=2026-09' });
    expect(screen.getByRole('alert')).toHaveTextContent(/after the last closed month/);
  });

  it('opens the voucher trace drawer', () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Trace vouchers' }));
    expect(within(screen.getByRole('dialog')).getByText('federal Q4 voucher')).toBeInTheDocument();
  });

  it('Finalize freezes a snapshot of the selected scenario with the note; Snapshots opens the history', () => {
    renderRoute(<EstimateSummaryPage />, { path: '/tp/:id/estimate', route: '/tp/tp1/estimate?year=2026&scenario=s2&through=2026-08' });
    fireEvent.click(screen.getByRole('button', { name: 'Finalize & issue vouchers' }));
    const dialog = screen.getByRole('dialog', { name: 'Finalize estimate' });
    expect(dialog.textContent).toContain('Truck');
    fireEvent.change(within(dialog).getByLabelText('Note (optional)'), { target: { value: 'Sent Q4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finalize' }));
    expect(finalize.mutate).toHaveBeenCalledWith(
      { scenarioId: 's2', input: { reason: 'finalize', note: 'Sent Q4', throughMonth: '2026-08' } }, expect.anything(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Snapshots' }));
    expect(screen.getByLabelText('Snapshot history')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'open Report Packs' })).toHaveAttribute('href', '/reports/packs');
  });

  it('read-only staff cannot finalize but can open the history', () => {
    h.role = 'firm_readonly';
    render();
    expect(screen.queryByRole('button', { name: 'Finalize & issue vouchers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Snapshots' })).toBeInTheDocument();
  });
});
