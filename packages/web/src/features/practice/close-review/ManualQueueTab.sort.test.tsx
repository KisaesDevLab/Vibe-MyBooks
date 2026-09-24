// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Manual queue: sort is server-side (the queue paginates).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

let lastInput: Record<string, unknown> = {};
vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ activeCompanyId: 'company-1', activeCompanyName: 'Test Co', companies: [] }),
}));
vi.mock('../../../api/hooks/useManualQueue', () => ({
  useManualQueue: (input: Record<string, unknown>) => {
    lastInput = input;
    return {
      data: { rows: [{ bankFeedItemId: 'f1', bankConnectionId: 'c1', feedDate: '2026-04-02', description: 'Mystery vendor', amount: '-42.0000', stateId: null, reason: 'orphan' }], total: 1 },
      isLoading: false,
    };
  },
}));

import { ManualQueueTab } from './ManualQueueTab';

const PERIOD = { label: 'April 2026', periodStart: '2026-04-01T00:00:00.000Z', periodEnd: '2026-05-01T00:00:00.000Z' };

beforeEach(() => { sessionStorage.clear(); lastInput = {}; });

describe('ManualQueueTab — column sort', () => {
  it('sends the header sort to the hook with the offset reset', () => {
    renderRoute(<ManualQueueTab period={PERIOD} />);
    expect(lastInput).toMatchObject({ sortBy: 'feedDate', sortDir: 'desc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(lastInput).toMatchObject({ sortBy: 'amount', sortDir: 'desc', offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(lastInput).toMatchObject({ sortBy: 'amount', sortDir: 'asc' });
    expect(JSON.parse(sessionStorage.getItem('vibe:manual-queue:view')!)).toMatchObject({ sortCol: 'amount', sortDir: 'asc' });
  });
});
