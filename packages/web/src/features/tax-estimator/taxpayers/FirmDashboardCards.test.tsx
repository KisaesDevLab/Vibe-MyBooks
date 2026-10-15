// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { FirmTaxEstDashboardDTO } from '@kis-books/shared';

const state: { data: FirmTaxEstDashboardDTO | null | undefined } = { data: undefined };
const mutate = vi.fn();
vi.mock('../../../api/hooks/useTaxEstimatorDashboard', () => ({
  useFirmTaxEstDashboard: () => ({ data: state.data }),
  useRefreshFirmTaxEstimate: () => ({ mutate, isPending: false, isError: false }),
}));

import { FirmDashboardCards } from './FirmDashboardCards';

function Probe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{l.search}</div>;
}
const renderIt = () => render(<MemoryRouter><FirmDashboardCards /><Probe /></MemoryRouter>);

const data: FirmTaxEstDashboardDTO = {
  today: '2026-12-16', windowDays: 30, visibleTaxpayers: 3,
  vouchersDue: [
    { taxpayerId: 'tp-1', displayName: 'Rivera', taxYear: 2026, jurisdiction: 'federal', jurisdictionLabel: 'Federal (IRS)', installment: 'Q4', dueDate: '2027-01-15', amount: '7046', remaining: '7046', status: 'unpaid', source: 'live', asOf: '2026-12-16T10:00:00.000Z' },
    { taxpayerId: 'tp-1', displayName: 'Rivera', taxYear: 2026, jurisdiction: 'MO', jurisdictionLabel: 'Missouri', installment: 'Q4', dueDate: '2027-01-15', amount: '500', remaining: '0', status: 'paid', source: 'live', asOf: '2026-12-16T10:00:00.000Z' },
  ],
  behind: [{ taxpayerId: 'tp-2', displayName: 'Smith', taxYear: 2026, shortfall: '1938', penalty: '236', source: 'snapshot', asOf: '2026-12-01T10:00:00.000Z' }],
  notComputed: [{ taxpayerId: 'tp-3', displayName: 'Jones', taxYear: 2026 }],
};

beforeEach(() => { state.data = undefined; mutate.mockReset(); });

describe('FirmDashboardCards', () => {
  it('renders nothing when the caller sees no taxpayer (null) or while loading', () => {
    const { container } = render(<MemoryRouter><FirmDashboardCards /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    state.data = null;
    const again = render(<MemoryRouter><FirmDashboardCards /></MemoryRouter>);
    expect(again.container).toBeEmptyDOMElement();
  });

  it('lists vouchers due with status and as-of, behind with shortfall + penalty, and the not-computed taxpayers', () => {
    state.data = data;
    renderIt();
    expect(screen.getByText('Vouchers due in the next 30 days')).toBeInTheDocument();
    expect(screen.getAllByText('Jan 15, 2027')).toHaveLength(2);
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getAllByText('Live · as of Dec 16, 2026').length).toBe(2);
    expect(screen.getByText('$1,938')).toBeInTheDocument();
    expect(screen.getByText('$236')).toBeInTheDocument();
    expect(screen.getByText('Finalized · as of Dec 1, 2026')).toBeInTheDocument();
    expect(within(screen.getByTestId('not-computed')).getByText('Jones')).toBeInTheDocument();
  });

  it('a row click opens the taxpayer estimate; Refresh computes that taxpayer without navigating', async () => {
    state.data = data;
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh Smith' }));
    expect(mutate).toHaveBeenCalledWith({ taxpayerId: 'tp-2', taxYear: 2026 });
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/$/);
    await userEvent.click(screen.getByText('Smith'));
    expect(screen.getByTestId('loc')).toHaveTextContent('/tax-estimator/taxpayers/tp-2/estimate?year=2026');
  });

  it('empty states', () => {
    state.data = { ...data, vouchersDue: [], behind: [], notComputed: [] };
    renderIt();
    expect(screen.getByText('No vouchers due in the next 30 days.')).toBeInTheDocument();
    expect(screen.getByText('No taxpayer is behind on estimated payments.')).toBeInTheDocument();
    expect(screen.queryByTestId('not-computed')).not.toBeInTheDocument();
  });
});
