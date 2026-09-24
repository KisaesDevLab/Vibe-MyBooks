// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Products & Services list: server-side sort, plus Taxable / Status value
// filters that become the endpoint's two boolean params.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { itemsMocks, accountsMocks, companyMocks } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const row = { id: 'i1', name: 'Widget', description: null, unitPrice: '9.00', incomeAccountId: 'a1', isTaxable: true, isActive: true };

vi.mock('../../api/hooks/useItems', () => ({
  ...itemsMocks(),
  useItems: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [row], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());

import { ItemsListPage } from './ItemsListPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('ItemsListPage — sort and filter', () => {
  it('sends the header sort to the server with the offset reset', () => {
    renderRoute(<ItemsListPage />);
    expect(lastFilters).toMatchObject({ isActive: true, offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^unit price/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'price', sortDir: 'asc', offset: 0 });
  });

  it('the Taxable popover becomes the isTaxable param; Status shares the select', () => {
    renderRoute(<ItemsListPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Taxable' }));
    fireEvent.click(screen.getByLabelText('Not taxable'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(lastFilters['isTaxable']).toBe(false);
    fireEvent.change(screen.getByDisplayValue('Active'), { target: { value: 'inactive' } });
    expect(lastFilters['isActive']).toBe(false);
    expect(JSON.parse(sessionStorage.getItem('vibe:items:view')!).filters).toEqual({ status: ['inactive'], taxable: ['no'] });
  });
});
