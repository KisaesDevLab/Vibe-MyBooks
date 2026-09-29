// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { FeedReviewRow, FeedReviewSummary } from '../../../api/hooks/useClassificationState';

const markMutate = vi.fn();
const listStore: { rows: FeedReviewRow[] } = { rows: [] };

vi.mock('../../../api/hooks/useClassificationState', () => ({
  useFeedReviewList: () => ({
    data: { pages: [{ rows: listStore.rows, total: listStore.rows.length }], pageParams: [0] },
    isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
  }),
  useMarkFeedReviewed: () => ({ mutate: markMutate, isPending: false }),
  useRecategorizeFeedItems: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { BucketsTab } from './BucketsTab';
import type { ClosePeriod } from './ClosePeriodSelector';

const PERIOD: ClosePeriod = {
  label: 'August 2026',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
};

const methods = (over: Partial<FeedReviewSummary['byMethod']> = {}): FeedReviewSummary['byMethod'] => ({
  rule: { total: 0, reviewed: 0 },
  ai: { total: 0, reviewed: 0 },
  history: { total: 0, reviewed: 0 },
  check_image: { total: 0, reviewed: 0 },
  manual: { total: 0, reviewed: 0 },
  matched: { total: 0, reviewed: 0 },
  excluded: { total: 0, reviewed: 0 },
  ...over,
});

const summary = (over: Partial<FeedReviewSummary> = {}): FeedReviewSummary => ({
  periodTotal: 3, periodOpen: 0, doneTotal: 3, reviewed: 1,
  byMethod: methods({ rule: { total: 2, reviewed: 1 }, manual: { total: 1, reviewed: 0 } }),
  hasBankFeed: true, otherMonthsOpen: [], ...over,
});

const row = (over: Partial<FeedReviewRow>): FeedReviewRow => ({
  feedItemId: 'f1', feedDate: '2026-08-04', description: 'HOME DEPOT', amount: '120.5000', status: 'categorized',
  method: 'rule', bankAccountName: 'Checking', institutionName: 'Bank', mask: '1234',
  transactionId: 't1', txnType: 'expense', txnVoid: false, payeeContactId: 'c1', payeeName: 'Home Depot',
  categoryAccountId: 'a1', categoryAccountName: '6100 · Repairs', categoryCount: 1,
  suggestedAccountName: null, reviewedAt: null, ...over,
});

beforeEach(() => {
  markMutate.mockReset();
  listStore.rows = [
    row({}),
    row({ feedItemId: 'f2', description: 'ACME SUPPLY', amount: '-500.0000', method: 'manual', suggestedAccountName: 'Office Supplies', payeeName: null, payeeContactId: null }),
  ];
});

function renderTab(over: Partial<Parameters<typeof BucketsTab>[0]> = {}) {
  const props = {
    companyId: 'company-1', period: PERIOD, feedReview: summary(),
    onChangePeriod: vi.fn(), onOpenReview: vi.fn(), ...over,
  };
  renderRoute(<BucketsTab {...props} />);
  return props;
}

describe('BucketsTab', () => {
  it('explains a client with no bank feed and points to Review', () => {
    const props = renderTab({ feedReview: summary({ hasBankFeed: false, periodTotal: 0, doneTotal: 0, reviewed: 0, byMethod: methods() }) });
    expect(screen.getByText('This client has no bank feed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Review' }));
    expect(props.onOpenReview).toHaveBeenCalled();
  });

  it('says nothing is left to categorize and lists the categorized items for review', () => {
    renderTab();
    expect(screen.getByText(/Nothing left to categorize in August 2026/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open in banking/i })).not.toBeInTheDocument();
    expect(screen.getByText('Review what was categorized')).toBeInTheDocument();
    expect(screen.getByText('HOME DEPOT')).toBeInTheDocument();
    expect(screen.getByText('Changed from suggestion: Office Supplies')).toBeInTheDocument();
    expect(screen.getByText('No payee')).toBeInTheDocument();
    // Money out shows as negative, money in as positive.
    expect(screen.getByText('-$120.50')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });

  it('marks a row reviewed with Looks right', () => {
    renderTab();
    fireEvent.click(screen.getAllByRole('button', { name: /looks right/i })[0]!);
    expect(markMutate.mock.calls[0]![0]).toEqual({ feedItemIds: ['f1'], reviewed: true, companyId: 'company-1' });
  });

  it('bulk-marks the selection reviewed', () => {
    renderTab();
    fireEvent.click(screen.getByLabelText('Select all loaded rows'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    // The bulk bar's button is the first "Looks right" on the page.
    fireEvent.click(screen.getAllByRole('button', { name: /looks right/i })[0]!);
    expect(markMutate.mock.calls[0]![0]).toEqual({ feedItemIds: ['f1', 'f2'], reviewed: true, companyId: 'company-1' });
  });

  it('links the month\'s uncategorized items to Banking, filtered to the month', () => {
    renderTab({ feedReview: summary({ periodOpen: 2, periodTotal: 5 }) });
    expect(screen.getByText(/still need categorizing/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing left to categorize/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in banking/i }))
      .toHaveAttribute('href', '/banking/feed?from=2026-08-01&to=2026-08-31');
  });

  it('links uncategorized items in other months to that period', () => {
    const props = renderTab({ feedReview: summary({ otherMonthsOpen: [{ month: '2026-09', count: 57 }, { month: '2026-07', count: 48 }] }) });
    expect(screen.getByText(/Still uncategorized in other months/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jul 2026 (48)' }));
    const next = (props.onChangePeriod as ReturnType<typeof vi.fn>).mock.calls[0]![0] as ClosePeriod;
    expect(next.periodStart).toBe('2026-07-01T00:00:00.000Z');
    expect(next.periodEnd).toBe('2026-08-01T00:00:00.000Z');
  });
});
