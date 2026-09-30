// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

// The page calls apiClient directly (no hook layer). The API contract is
// { pairs, count, limit } with nested a/b transactions — the page used to
// read `data` and so always showed "0 potential duplicates".
const apiClient = vi.fn();
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClient(...args) };
});

import { DuplicateReviewPage } from './DuplicateReviewPage';

const pair = {
  a: { id: 'a1', txnType: 'expense', txnNumber: null, txnDate: '2026-09-01', payee: 'Acme Supply', total: '125.0000', memo: 'first' },
  b: { id: 'b1', txnType: 'bill', txnNumber: 'B-7', txnDate: '2026-09-02', payee: 'Acme Supply', total: '125.0000', memo: null },
  daysApart: 1,
};

describe('DuplicateReviewPage', () => {
  beforeEach(() => apiClient.mockReset());

  it('renders pairs from the { pairs } response shape', async () => {
    apiClient.mockResolvedValue({ pairs: [pair], count: 1, limit: 100, startDate: '2026-06-30', endDate: '2026-09-30' });
    renderRoute(<DuplicateReviewPage />);
    expect(await screen.findByText('1 potential duplicate found')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Supply')).toHaveLength(2);
    expect(screen.getAllByText('$125.00')).toHaveLength(2);
    expect(screen.getByText('1 day apart')).toBeInTheDocument();
    expect(screen.getByText(/bill #B-7/i)).toBeInTheDocument();
    const url = String(apiClient.mock.calls[0]![0]);
    expect(url).toMatch(/^\/duplicates\?start_date=\d{4}-\d{2}-\d{2}&end_date=\d{4}-\d{2}-\d{2}$/);
  });

  it('shows the empty state with the scanned range and re-scans on a preset', async () => {
    apiClient.mockResolvedValue({ pairs: [], count: 0, limit: 100, startDate: '2026-06-30', endDate: '2026-09-30' });
    renderRoute(<DuplicateReviewPage />);
    expect(await screen.findByText(/no potential duplicates found between/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All time' }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledTimes(2));
    expect(String(apiClient.mock.calls[1]![0])).toContain('start_date=2000-01-01');
  });

  it('merges keep-left / void-right with the right ids', async () => {
    apiClient.mockResolvedValue({ pairs: [pair], count: 1, limit: 100, startDate: '2026-06-30', endDate: '2026-09-30' });
    renderRoute(<DuplicateReviewPage />);
    await screen.findByText('1 potential duplicate found');
    fireEvent.click(screen.getByRole('button', { name: /keep left \/ void right/i }));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith('/duplicates/merge', expect.objectContaining({ method: 'POST' })));
    const call = apiClient.mock.calls.find((c) => c[0] === '/duplicates/merge')!;
    expect(JSON.parse((call[1] as { body: string }).body)).toEqual({ keepId: 'a1', voidId: 'b1' });
  });
});
