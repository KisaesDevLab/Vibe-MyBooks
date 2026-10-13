// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// D15: the taxpayer screen's standalone Print / Download PDF (current year, Base scenario).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const h = vi.hoisted(() => ({ year: null as unknown, download: vi.fn(), scope: { firmRole: 'firm_readonly' } as Record<string, unknown>, show: false }));
const mut = { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false, error: null };

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxpayer: () => ({
    data: { taxpayer: { id: 'tp1', displayName: 'Rivera Family', filingStatus: 'mfj', residentState: 'MO', safeHarborOverride: null, portalShows: null, showOnCompanyDashboard: h.show, isActive: true, updatedAt: 'x' }, persons: [] },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useTaxEstimatorScope: () => ({ data: h.scope }),
  useUpdateTaxpayer: () => mut, useArchiveTaxpayer: () => mut, useUpsertPerson: () => mut, useRemovePerson: () => mut, useCreateDependent: () => mut, useUpdateDependent: () => mut, useRemoveDependent: () => mut,
}));
vi.mock('../../../api/hooks/useTaxEstimatorYears', () => ({ useYear: () => h.year }));
vi.mock('../../../api/hooks/useTaxEstimatorEstimate', () => ({ downloadEstimatePdf: (...a: unknown[]) => h.download(...a) }));
vi.mock('./LinksSection', () => ({ LinksSection: () => null }));
vi.mock('./OutsideBusinessesSection', () => ({ OutsideBusinessesSection: () => null }));
vi.mock('./ContactsPanel', () => ({ ContactsPanel: () => null }));
vi.mock('./TaxpayerAccessCard', () => ({ TaxpayerAccessCard: () => null }));

import { TaxpayerDetailPage } from './TaxpayerDetailPage';

const render = () => renderRoute(<TaxpayerDetailPage />, { path: '/tp/:id', route: '/tp/tp1' });
const THIS_YEAR = new Date().getFullYear();

beforeEach(() => { vi.clearAllMocks(); h.scope = { firmRole: 'firm_readonly' }; h.show = false; h.year = { data: { exists: false, scenarios: [] }, isLoading: false }; });

// Q54: per-taxpayer "Show on linked company dashboards" (default OFF).
describe('TaxpayerDetailPage company-dashboard switch', () => {
  it('shows the switch OFF with its help text and saves ON for a writer', () => {
    h.scope = { firmRole: 'firm_staff', canWrite: true };
    render();
    const box = screen.getByRole('checkbox', { name: /Show on linked company dashboards/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(/Shows this taxpayer.s Next payment \/ Projected tax \/ Paid vs required cards on the dashboards of its linked companies \(staff with access; owners only via their portal contact\)\./)).toBeTruthy();
    fireEvent.click(box);
    expect(mut.mutate).toHaveBeenCalledWith({ showOnCompanyDashboard: true });
  });
  it('is read-only for a read-only member', () => {
    h.show = true;
    render();
    const box = screen.getByRole('checkbox', { name: /Show on linked company dashboards/ }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.disabled).toBe(true);
  });
});

describe('TaxpayerDetailPage Print / Download PDF', () => {
  it('downloads the current year Base scenario (read-only staff too)', async () => {
    h.year = { data: { exists: true, scenarios: [{ id: 's2', name: 'Truck', isBase: false }, { id: 's1', name: 'Base', isBase: true }] }, isLoading: false };
    h.download.mockResolvedValue(undefined);
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Print / Download PDF' }));
    await waitFor(() => expect(h.download).toHaveBeenCalledWith('tp1', THIS_YEAR, 's1'));
  });

  it('is disabled with a hint when the year is not set up', () => {
    h.year = { data: { exists: false, scenarios: [] }, isLoading: false };
    render();
    expect((screen.getByRole('button', { name: 'Print / Download PDF' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(`Set up ${THIS_YEAR} annual settings to print an estimate.`)).toBeTruthy();
  });

  it('shows a download failure inline', async () => {
    h.year = { data: { exists: true, scenarios: [{ id: 's1', name: 'Base', isBase: true }] }, isLoading: false };
    h.download.mockRejectedValue(new Error('Taxpayer not found'));
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Print / Download PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Taxpayer not found');
  });
});
