// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Daily sales entries: sort is server-side (the list paginates).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

let lastFilters: Record<string, unknown> = {};
const entry = { id: 'e1', templateId: 't1', templateName: 'Bar', businessDate: '2026-06-01', status: 'posted', transactionId: null,
  overShortAmount: '0', totalSales: '900.0000', totalTax: '0', totalPayments: '900.0000', postedAt: null, createdAt: null };

vi.mock('../../api/hooks/useDailySales', () => ({
  useDailySalesEntries: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { entries: [entry], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
  useDailySalesTemplates: () => ({ data: { templates: [{ id: 't1', name: 'Bar' }] } }),
}));

import { DailySalesEntriesPage } from './DailySalesEntriesPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('DailySalesEntriesPage — column sort', () => {
  it('sends the header sort to the hook with the offset reset', () => {
    renderRoute(<DailySalesEntriesPage />);
    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(lastFilters).toMatchObject({ sortBy: 'businessDate', sortDir: 'desc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^sales/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'totalSales', sortDir: 'desc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^template$/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'templateName', sortDir: 'asc' });
    expect(JSON.parse(sessionStorage.getItem('vibe:daily-sales:view')!)).toMatchObject({ sortCol: 'templateName' });
  });
});
