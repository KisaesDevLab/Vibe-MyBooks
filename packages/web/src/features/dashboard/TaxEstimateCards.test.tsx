// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CompanyTaxEstimatesDTO, TaxEstDashboardTaxpayerDTO } from '@kis-books/shared';

const state: { data: CompanyTaxEstimatesDTO | null | undefined } = { data: undefined };
const mutate = vi.fn();
vi.mock('../../api/hooks/useTaxEstimatorDashboard', () => ({
  useCompanyTaxEstimates: () => ({ data: state.data }),
  useRefreshCompanyTaxEstimate: () => ({ mutate, isPending: false, isError: false, error: null }),
}));

import { TaxEstimateCards } from './TaxEstimateCards';

const rivera: TaxEstDashboardTaxpayerDTO = {
  taxpayerId: 'tp-1', displayName: 'Carlos & Maria Rivera', taxYear: 2026, status: 'ok', source: 'live', asOf: '2026-12-16T10:00:00.000Z',
  booksThrough: '2026-11', totals: { total: '43732', federal: '40000', state: '3732' },
  changeSinceSnapshot: { amount: '1200', snapshotAt: '2026-12-15T09:00:00.000Z' },
  jurisdictions: [
    { jurisdiction: 'federal', label: 'Federal (IRS)', estimatesRequired: true, nextVoucher: { label: 'Q4', dueDate: '2027-01-15', amount: '7046', remaining: '7046', status: 'unpaid' }, requiredToDate: '21138', paidToDate: '19200', shortfall: '1938', penalty: '236' },
    { jurisdiction: 'AR', label: 'Arkansas', estimatesRequired: false, nextVoucher: null, requiredToDate: '0', paidToDate: '0', shortfall: '0', penalty: '0' },
  ],
  shortfall: '1938', penalty: '236',
};
const renderIt = () => render(<MemoryRouter><TaxEstimateCards /></MemoryRouter>);

beforeEach(() => { state.data = undefined; mutate.mockReset(); });

describe('TaxEstimateCards (company dashboard)', () => {
  it('renders nothing when the server hides the cards (null) or while loading', () => {
    const { container, rerender } = renderIt();
    expect(container).toBeEmptyDOMElement();
    state.data = null;
    rerender(<MemoryRouter><TaxEstimateCards /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('staff: three cards with next voucher, projected total + change, paid vs required with shortfall and penalty, Refresh', async () => {
    state.data = { audience: 'staff', today: '2026-12-16', taxpayers: [rivera] };
    renderIt();
    const block = screen.getByTestId('tax-est-tp-1');
    expect(within(block).getByText('Next estimated payment')).toBeInTheDocument();
    expect(within(block).getByText(/Q4 · Jan 15, 2027/)).toBeInTheDocument();
    expect(within(block).getByText('Unpaid')).toBeInTheDocument();
    expect(within(block).getByText('Projected tax for 2026')).toBeInTheDocument();
    expect(within(block).getByText('$43,732')).toBeInTheDocument();
    expect(within(block).getByTestId('change-since-snapshot')).toHaveTextContent('+$1,200 since the estimate finalized Dec 15, 2026');
    expect(within(block).getByText('Books through Nov 2026')).toBeInTheDocument();
    expect(within(block).getByTestId('shortfall')).toHaveTextContent('Behind by $1,938 · est. penalty $236');
    expect(within(block).getByText('Live estimate as of Dec 16, 2026')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'Carlos & Maria Rivera' })).toHaveAttribute('href', '/tax-estimator/taxpayers/tp-1/estimate?year=2026');
    await userEvent.click(within(block).getByRole('button', { name: /Refresh/ }));
    expect(mutate).toHaveBeenCalledWith('tp-1');
  });

  it('staff: a taxpayer without figures shows "Not computed yet — Open taxpayer"', () => {
    state.data = { audience: 'staff', today: '2026-12-16', taxpayers: [{ ...rivera, status: 'not_computed', source: null, asOf: null, totals: null, changeSinceSnapshot: null, jurisdictions: [], shortfall: '0', penalty: '0' }] };
    renderIt();
    expect(screen.getByText(/Not computed yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open taxpayer' })).toBeInTheDocument();
    expect(screen.queryByText('Next estimated payment')).not.toBeInTheDocument();
  });

  it('owner: no link, no Refresh, no penalty', () => {
    state.data = { audience: 'owner', today: '2026-12-16', taxpayers: [{ ...rivera, source: 'snapshot', penalty: null, jurisdictions: rivera.jurisdictions.map((j) => ({ ...j, penalty: null })) }] };
    renderIt();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refresh/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('shortfall')).toHaveTextContent('Behind by $1,938');
    expect(screen.getByTestId('shortfall')).not.toHaveTextContent('penalty');
    expect(screen.getByText('Finalized estimate as of Dec 16, 2026')).toBeInTheDocument();
  });

  it('on track when nothing is short', () => {
    state.data = { audience: 'staff', today: '2026-12-16', taxpayers: [{ ...rivera, shortfall: '0', penalty: '0', jurisdictions: rivera.jurisdictions.map((j) => ({ ...j, shortfall: '0' })) }] };
    renderIt();
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.queryByTestId('shortfall')).not.toBeInTheDocument();
  });
});
