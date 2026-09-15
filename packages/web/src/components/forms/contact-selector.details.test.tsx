// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Quick Add Contact → "More details": address (billing; shipping for
// customers with a same-as-billing shortcut) and, for vendors, the default
// expense category + tag. Collapsed by default; type-aware.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { accountsMocks, companyMocks, tagsMocks } from '../../test-mocks';

const createMutate = vi.fn((_input: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
  opts?.onSuccess?.({ contact: { id: 'c1', displayName: 'Acme Plumbing', contactType: 'vendor', defaultExpenseAccountId: null, defaultTagId: null } }),
);
vi.mock('../../api/hooks/useContacts', () => ({
  useContacts: () => ({ data: { data: [], total: 0 }, isLoading: false, refetch: vi.fn() }),
  useContact: () => ({ data: undefined, isLoading: false }),
  useCreateContact: () => ({ mutate: createMutate, isPending: false, error: null }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());

const { ContactSelector } = await import('./ContactSelector');

beforeEach(() => createMutate.mockClear());

async function openQuickAdd(typeFilter: 'vendor' | 'customer') {
  renderRoute(<ContactSelector value="" onChange={vi.fn()} contactTypeFilter={typeFilter} />);
  fireEvent.focus(screen.getByPlaceholderText('Search contacts...'));
  fireEvent.change(screen.getByPlaceholderText('Search contacts...'), { target: { value: 'Acme Plumbing' } });
  fireEvent.click(await screen.findByText('Add "Acme Plumbing"'));
  await screen.findByText('Quick Add Contact');
}
const payload = () => createMutate.mock.calls[0]?.[0] as Record<string, unknown>;

describe('Quick Add Contact — more details', () => {
  it('is collapsed by default and sends no address fields when untouched', async () => {
    await openQuickAdd('vendor');
    expect(screen.queryByLabelText('Address Line 1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(payload()).toMatchObject({ billingLine1: null, defaultExpenseAccountId: null, defaultTagId: null });
  });

  it('vendor: mailing address + vendor defaults, no shipping section', async () => {
    await openQuickAdd('vendor');
    fireEvent.click(screen.getByRole('button', { name: /More details/ }));
    expect(screen.getByText('Mailing address')).toBeInTheDocument();
    expect(screen.getByText('Vendor defaults')).toBeInTheDocument();
    expect(screen.queryByText('Shipping address')).toBeNull();
    fireEvent.change(screen.getByLabelText('Address Line 1'), { target: { value: '12 Main St' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'MO' } });
    fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '65801' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(payload()).toMatchObject({
      contactType: 'vendor', billingLine1: '12 Main St', billingCity: 'Springfield', billingState: 'MO', billingZip: '65801',
      shippingLine1: null,
    });
  });

  it('customer: shipping defaults to the billing address; unticking sends its own', async () => {
    await openQuickAdd('customer');
    fireEvent.click(screen.getByRole('button', { name: /More details/ }));
    expect(screen.getByText('Billing address')).toBeInTheDocument();
    expect(screen.queryByText('Vendor defaults')).toBeNull();
    fireEvent.change(screen.getByLabelText('Address Line 1'), { target: { value: '1 Billing Rd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(payload()).toMatchObject({ billingLine1: '1 Billing Rd', shippingLine1: '1 Billing Rd' });
  });

  it('customer: unticking "Same as billing" sends a separate shipping address', async () => {
    await openQuickAdd('customer');
    fireEvent.click(screen.getByRole('button', { name: /More details/ }));
    fireEvent.change(screen.getByLabelText('Address Line 1'), { target: { value: '1 Billing Rd' } });
    fireEvent.click(screen.getByLabelText('Same as billing'));
    const lines = screen.getAllByLabelText('Address Line 1');
    fireEvent.change(lines[1]!, { target: { value: '9 Dock Way' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(payload()).toMatchObject({ billingLine1: '1 Billing Rd', shippingLine1: '9 Dock Way' });
  });

  it('switching a vendor to Customer drops the vendor defaults from the payload', async () => {
    await openQuickAdd('vendor');
    fireEvent.click(screen.getByRole('button', { name: /More details/ }));
    expect(screen.getByText('Vendor defaults')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    expect(screen.queryByText('Vendor defaults')).toBeNull();
    expect(screen.getByText('Shipping address')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(payload()).toMatchObject({ contactType: 'customer', defaultExpenseAccountId: null, defaultTagId: null });
  });
});
