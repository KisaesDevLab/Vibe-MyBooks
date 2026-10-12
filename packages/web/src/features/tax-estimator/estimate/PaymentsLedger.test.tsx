// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, render } from '@testing-library/react';

type Q = { data?: unknown; isLoading?: boolean; isError?: boolean; refetch: () => void };
const h = vi.hoisted(() => ({ ledger: null as unknown, create: vi.fn(), update: vi.fn(), del: vi.fn() }));
vi.mock('../../../api/hooks/useTaxEstimatorEstimate', () => ({
  usePaymentLedger: () => h.ledger,
  useCreatePayment: () => ({ mutate: h.create, isPending: false, isError: false, error: null }),
  useUpdatePayment: () => ({ mutate: h.update, isPending: false, isError: false, error: null }),
  useDeletePayment: () => ({ mutate: h.del, isPending: false, isError: false, error: null }),
}));

import { PaymentsLedger } from './PaymentsLedger';

const q = (over: Partial<Q> = {}): Q => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over });
const rows = { payments: [
  { id: 'p1', stored: true, jurisdiction: 'federal', date: '2026-04-15', amount: '6600.0000', source: 'manual', memo: 'Q1', accountName: null, companyName: null },
  { id: 'gl:1', stored: false, jurisdiction: 'MO', date: '2026-04-15', amount: '1208.0000', source: 'gl', memo: null, accountName: 'Est. Tax', companyName: 'Rivera Plumbing' },
], total: 2, totals: { federal: '6600.0000', MO: '1208.0000' } };
const ui = (canWrite = true) => render(<PaymentsLedger taxpayerId="tp1" taxYear={2026} jurisdictions={['MO']} canWrite={canWrite} />);

beforeEach(() => { vi.clearAllMocks(); h.ledger = q({ data: rows }); });

describe('PaymentsLedger', () => {
  it('loading and error states', () => {
    h.ledger = q({ isLoading: true });
    const { unmount } = ui();
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    const refetch = vi.fn();
    h.ledger = q({ isError: true, refetch });
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty state explains where payments come from', () => {
    h.ledger = q({ data: { payments: [], total: 0, totals: {} } });
    ui();
    expect(screen.getByText(/No payments recorded for 2026/)).toBeInTheDocument();
  });

  it('lists stored and GL rows; only stored manual rows are editable', () => {
    ui();
    const table = screen.getByRole('table');
    expect(within(table).getByText('$6,600.00')).toBeInTheDocument();
    expect(within(table).getByText('Books (GL)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Edit payment/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Delete payment/ })).toHaveLength(1);
  });

  it('read-only members cannot add, edit or delete', () => {
    ui(false);
    expect(screen.queryByRole('button', { name: 'Add payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit payment/ })).toBeNull();
  });

  it('adds a manual payment (validated) and edits / deletes one', () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Add payment' }));
    const save = screen.getByRole('button', { name: 'Save payment' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Date paid'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('Jurisdiction'), { target: { value: 'MO' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: 'MO', date: '2026-06-15', amount: '5000', source: 'manual', memo: null }), expect.anything());

    fireEvent.click(screen.getByRole('button', { name: /^Edit payment 2026-04-15/ }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '6500.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save payment' }));
    expect(h.update).toHaveBeenCalledWith({ id: 'p1', input: expect.objectContaining({ amount: '6500.5' }) }, expect.anything());

    fireEvent.click(screen.getByRole('button', { name: /^Delete payment/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(h.del).toHaveBeenCalledWith('p1');
  });

  it('D5: the visually hidden Actions header stays inside the scroll card (no 375px page overflow)', () => {
    const { container } = ui();
    const hidden = Array.from(container.querySelectorAll('.sr-only'));
    expect(hidden.length).toBeGreaterThan(0);
    for (const el of hidden) {
      // sr-only is position:absolute; an overflow-x-auto ancestor only clips it
      // when that ancestor is the containing block (positioned).
      const scroller = el.closest('[class*="overflow-x-auto"]');
      expect(scroller).not.toBeNull();
      expect(scroller!.className).toMatch(/\brelative\b/);
    }
  });
});
