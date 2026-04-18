// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const useItemsMock = vi.fn();
const useDeactivateItemMock = vi.fn();
const useExportItemsMock = vi.fn();

vi.mock('../../api/hooks/useItems', () => ({
  useItems: (...a: unknown[]) => useItemsMock(...a),
  useDeactivateItem: (...a: unknown[]) => useDeactivateItemMock(...a),
  useExportItems: (...a: unknown[]) => useExportItemsMock(...a),
}));

import { ItemsListPage } from './ItemsListPage';

function primeHooks() {
  useItemsMock.mockReturnValue({
    data: { data: [], total: 0 }, isLoading: false, isError: false, refetch: vi.fn(),
  });
  useDeactivateItemMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useExportItemsMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
}

describe('items pages', () => {
  it('ItemsListPage shows the empty state', () => {
    primeHooks();
    renderRoute(<ItemsListPage />);
    expect(screen.getByRole('heading', { name: /products & services/i })).toBeInTheDocument();
    expect(screen.getByText(/no items found/i)).toBeInTheDocument();
  });

  it('ItemsListPage renders rows when items exist', () => {
    primeHooks();
    useItemsMock.mockReturnValue({
      data: {
        total: 1,
        data: [{
          id: 'i1', name: 'Consulting', description: 'Hourly', unitPrice: '150.00',
          isTaxable: false, isActive: true,
        }],
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderRoute(<ItemsListPage />);
    expect(screen.getByText('Consulting')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });
});
