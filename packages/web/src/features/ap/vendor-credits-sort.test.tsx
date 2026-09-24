// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Vendor credits: sort is server-side (the list paginates).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { apMocks } from '../../test-mocks';

let lastFilters: Record<string, unknown> = {};
const credit = { id: 'vc1', txnNumber: 'VC-1', contactName: 'Acme', txnDate: '2026-03-01', total: '10.0000', balanceDue: '10.0000', memo: null };

vi.mock('../../api/hooks/useAp', () => ({
  ...apMocks(),
  useVendorCredits: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { data: [credit], total: 1 }, isLoading: false };
  },
}));

import { VendorCreditListPage } from './VendorCreditListPage';

beforeEach(() => { sessionStorage.clear(); lastFilters = {}; });

describe('VendorCreditListPage — column sort', () => {
  it('sends the header sort to the hook with the offset reset', () => {
    renderRoute(<VendorCreditListPage />);
    expect(lastFilters).toMatchObject({ sortBy: 'txnDate', sortDir: 'desc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^vendor/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'contactName', sortDir: 'asc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^total/i }));
    expect(lastFilters).toMatchObject({ sortBy: 'total', sortDir: 'desc' });
    expect(JSON.parse(sessionStorage.getItem('vibe:vendor-credits:view')!)).toMatchObject({ sortCol: 'total' });
  });
});
