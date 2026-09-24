// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// AJE list: sort is server-side (the list paginates).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { AjeListPage } from './AjeListPage';

const aje = { id: 'a1', txnDate: '2026-02-01', memo: 'Depreciation', status: 'posted', basis: 'both', ajeNumber: 1, ajeNumberLabel: 'AJE-001',
  lines: [{ id: 'l1', accountId: 'x', debit: '100.00', credit: '0', description: null }] };
const lastUrl = () => String([...apiClientMock.mock.calls].reverse().find((a) => String(a[0]).startsWith('/tb/ajes?'))?.[0]);

beforeEach(() => {
  sessionStorage.clear();
  apiClientMock.mockReset();
  apiClientMock.mockResolvedValue({ ajes: [aje], total: 1 });
});

describe('AjeListPage — column sort', () => {
  it('asks the server for the sort and resets the page', async () => {
    renderRoute(<AjeListPage />);
    await screen.findByText('Depreciation');
    expect(lastUrl()).toContain('sortBy=txnDate&sortDir=desc');
    fireEvent.click(screen.getByRole('button', { name: /^memo/i }));
    await waitFor(() => expect(lastUrl()).toContain('sortBy=memo&sortDir=asc'));
    expect(lastUrl()).toContain('offset=0');
    expect(JSON.parse(sessionStorage.getItem('vibe:tb-ajes:view')!)).toMatchObject({ sortCol: 'memo' });
  });
});
