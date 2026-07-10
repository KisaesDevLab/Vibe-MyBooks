// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Detail Types settings — presentation reorder: the per-row up/down
// arrows PATCH sortOrder index positions (normalizing legacy NULLs)
// through /tenant-settings/detail-types/:id.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const custom = [
  {
    id: 'dt-a', tenantId: 't1', accountType: 'expense', value: 'alpha_costs',
    label: 'Alpha Costs', sortOrder: null, createdAt: '', updatedAt: '',
  },
  {
    id: 'dt-b', tenantId: 't1', accountType: 'expense', value: 'beta_costs',
    label: 'Beta Costs', sortOrder: null, createdAt: '', updatedAt: '',
  },
];

const apiClientMock = vi.fn(async (path: string, opts?: { method?: string; body?: string }) => {
  if (!opts?.method || opts.method === 'GET') {
    return { detailTypes: {}, custom };
  }
  return {};
});

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (path: string, opts?: { method?: string; body?: string }) => apiClientMock(path, opts) };
});

import { DetailTypesPage } from './DetailTypesPage';

beforeEach(() => {
  apiClientMock.mockClear();
});

describe('DetailTypesPage reorder', () => {
  it('renders rows in server order with move arrows', async () => {
    renderRoute(<DetailTypesPage />);
    await waitFor(() => expect(screen.getByText('Alpha Costs')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Move Alpha Costs up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Beta Costs down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Beta Costs up' })).toBeEnabled();
  });

  it('moving a row up PATCHes normalized sortOrder indexes for the segment', async () => {
    renderRoute(<DetailTypesPage />);
    await waitFor(() => expect(screen.getByText('Beta Costs')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Move Beta Costs up' }));

    await waitFor(() => {
      const patches = apiClientMock.mock.calls.filter(([, opts]) => opts?.method === 'PATCH');
      expect(patches).toHaveLength(2);
    });
    const patches = apiClientMock.mock.calls.filter(([, opts]) => opts?.method === 'PATCH');
    // Beta moves to index 0, Alpha to index 1 (NULLs normalized).
    expect(patches[0]![0]).toBe('/tenant-settings/detail-types/dt-b');
    expect(JSON.parse(patches[0]![1]!.body!)).toEqual({ sortOrder: 0 });
    expect(patches[1]![0]).toBe('/tenant-settings/detail-types/dt-a');
    expect(JSON.parse(patches[1]![1]!.body!)).toEqual({ sortOrder: 1 });
  });
});
