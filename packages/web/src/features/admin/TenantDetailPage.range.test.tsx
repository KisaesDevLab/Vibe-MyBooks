// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Focused interaction test for the "Delete transactions in a date range"
// admin action: the confirm dialog must show a live preview of what will
// be deleted, and confirming must POST the delete with the chosen range.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { TenantDetailPage } from './TenantDetailPage';

const TENANT = {
  tenant: { id: 't1', name: 'Acme', slug: 'acme', created_at: '2026-01-01' },
  users: [],
  companies: [],
  stats: { accounts: '5', transactions: '9', contacts: '2' },
};

beforeEach(() => {
  apiClientMock.mockReset();
  // Route responses by URL/verb.
  apiClientMock.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/admin/tenants/t1' && (!opts || opts.method === undefined)) {
      return Promise.resolve(TENANT);
    }
    if (path.startsWith('/admin/tenants/t1/transactions-range-count')) {
      return Promise.resolve({ transactionsToDelete: 4, feedItemsToDelete: 3, reconciliationsToDelete: 1 });
    }
    if (path === '/admin/tenants/t1/delete-transactions-range' && opts?.method === 'POST') {
      return Promise.resolve({ transactionsDeleted: 4, feedItemsDeleted: 3, reconciliationsDeleted: 1 });
    }
    return Promise.resolve({});
  });
  // useCoaTemplateOptions falls back to static options on fetch failure.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')));
});

describe('TenantDetailPage — delete transactions in date range', () => {
  it('previews counts in the confirm dialog and fires the delete with the range', async () => {
    renderRoute(<TenantDetailPage />, { route: '/admin/tenants/t1', path: '/admin/tenants/:id' });

    // Wait for the tenant to load.
    await screen.findByText('Delete transactions in a date range');

    // Enter a date range.
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-03-31' } });

    // Open the confirm dialog.
    fireEvent.click(screen.getByRole('button', { name: /delete date range/i }));

    // Preview counts surface in the dialog.
    await screen.findByText(/4 transaction\(s\)/i);
    expect(screen.getByText(/3 bank feed item\(s\)/i)).toBeTruthy();
    expect(screen.getByText(/1 reconciliation\(s\)/i)).toBeTruthy();

    // Type-to-confirm, then confirm.
    fireEvent.change(screen.getByPlaceholderText('Acme'), { target: { value: 'Acme' } });
    const confirmBtn = screen.getAllByRole('button', { name: /^delete date range$/i }).pop()!;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClientMock).toHaveBeenCalledWith(
        '/admin/tenants/t1/delete-transactions-range',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ startDate: '2026-01-01', endDate: '2026-03-31' }),
        }),
      );
    });
  });
});
