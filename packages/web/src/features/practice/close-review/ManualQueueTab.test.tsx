// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const queueStore: { rows: unknown[]; isLoading: boolean } = { rows: [], isLoading: false };

vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({
    activeCompanyId: 'company-1',
    activeCompanyName: 'Test Co',
    companies: [],
  }),
}));

vi.mock('../../../api/hooks/useManualQueue', () => ({
  useManualQueue: () => ({
    data: { rows: queueStore.rows },
    isLoading: queueStore.isLoading,
  }),
}));

import { ManualQueueTab } from './ManualQueueTab';

const PERIOD = {
  label: 'April 2026',
  periodStart: '2026-04-01T00:00:00.000Z',
  periodEnd: '2026-05-01T00:00:00.000Z',
};

beforeEach(() => {
  queueStore.rows = [];
  queueStore.isLoading = false;
});

describe('ManualQueueTab', () => {
  it('renders the empty state when nothing is in the queue', () => {
    renderRoute(<ManualQueueTab period={PERIOD} />);
    expect(screen.getByText(/Manual queue is clear/)).toBeInTheDocument();
  });

  it('renders rows when items are in the queue', () => {
    queueStore.rows = [
      {
        bankFeedItemId: 'b1',
        bankConnectionId: 'c1',
        feedDate: '2026-04-15',
        description: 'Mystery vendor',
        amount: '99.99',
        stateId: null,
        reason: 'orphan',
      },
      {
        bankFeedItemId: 'b2',
        bankConnectionId: 'c1',
        feedDate: '2026-04-20',
        description: 'Unknown',
        amount: '50.00',
        stateId: 's2',
        reason: 'no_suggestion',
      },
    ];
    renderRoute(<ManualQueueTab period={PERIOD} />);
    expect(screen.getByText('Mystery vendor')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText(/No classification result/)).toBeInTheDocument();
    expect(screen.getByText(/AI could not suggest/)).toBeInTheDocument();
  });
});
