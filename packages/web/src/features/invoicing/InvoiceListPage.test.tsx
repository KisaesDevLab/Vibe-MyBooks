// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mock the data hook BEFORE the component is imported so the component
// picks up the mock. vi.mock is hoisted to the top of the file.
const useInvoicesMock = vi.fn();
vi.mock('../../api/hooks/useInvoices', () => ({
  useInvoices: (...args: unknown[]) => useInvoicesMock(...args),
}));

import { InvoiceListPage } from './InvoiceListPage';

function wrap(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('InvoiceListPage', () => {
  it('shows the loading spinner while the query is pending', () => {
    useInvoicesMock.mockReturnValue({
      data: undefined, isLoading: true, isError: false, refetch: vi.fn(),
    });
    wrap(<InvoiceListPage />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows the error state with a retry button when the query errors', () => {
    const refetch = vi.fn();
    useInvoicesMock.mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    });
    wrap(<InvoiceListPage />);
    // The ErrorMessage component provides a retry button. Exact copy may
    // differ by component; check for either the Try again affordance.
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  it('shows the empty-state copy when the server returns zero invoices', () => {
    useInvoicesMock.mockReturnValue({
      data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
    });
    wrap(<InvoiceListPage />);
    expect(screen.getByText(/no invoices found/i)).toBeInTheDocument();
    // Pagination component renders "0 invoices" in its no-pages branch.
    expect(screen.getByText(/0 invoices/i)).toBeInTheDocument();
  });

  it('renders a table row for each invoice and shows the correct count', () => {
    useInvoicesMock.mockReturnValue({
      data: {
        total: 2,
        data: [
          {
            id: 'a1', txnNumber: 'INV-001', txnDate: '2026-01-15',
            dueDate: '2026-02-14', invoiceStatus: 'sent',
            total: '150.00', balanceDue: '150.00',
          },
          {
            id: 'a2', txnNumber: 'INV-002', txnDate: '2026-01-20',
            dueDate: null, invoiceStatus: 'paid',
            total: '42.50', balanceDue: '0.00',
          },
        ],
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    wrap(<InvoiceListPage />);
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('INV-002')).toBeInTheDocument();
    // Status chips
    expect(screen.getByText(/^sent$/i)).toBeInTheDocument();
    expect(screen.getByText(/^paid$/i)).toBeInTheDocument();
    // Single-page pagination strip should still show the count
    expect(screen.getByText(/2 invoices/i)).toBeInTheDocument();
  });
});
