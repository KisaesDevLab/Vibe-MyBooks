// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { FeedReviewRow, FeedReviewSummary } from '../../../api/hooks/useClassificationState';

const markMutate = vi.fn();
const recategorizeMutate = vi.fn();
const listSpy = vi.fn();
const listStore: { rows: FeedReviewRow[] } = { rows: [] };

vi.mock('../../../api/hooks/useClassificationState', () => ({
  FEED_REVIEW_SORT_KEYS: ['feedDate', 'description', 'payee', 'category', 'method', 'amount', 'reviewed'],
  useFeedReviewList: (input: unknown) => (listSpy(input), {
    data: { pages: [{ rows: listStore.rows, total: listStore.rows.length }], pageParams: [0] },
    isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
  }),
  useMarkFeedReviewed: () => ({ mutate: markMutate, isPending: false }),
  useRecategorizeFeedItems: () => ({ mutate: recategorizeMutate, isPending: false }),
}));

// The real selectors fetch and search; a plain input keeps the test on the
// editor's wiring.
vi.mock('../../../components/forms/ContactSelector', () => ({
  ContactSelector: ({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label ?? 'Payee picker'} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('../../../components/forms/AccountSelector', () => ({
  AccountSelector: ({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label ?? 'Category picker'} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
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
  feedItemId: 'f1', feedDate: '2026-08-04', description: 'HOME DEPOT', originalDescription: 'HOME DEPOT #4411 KALAMAZOO MI', amount: '120.5000', status: 'categorized',
  method: 'rule', bankAccountName: 'Checking', institutionName: 'Bank', mask: '1234',
  transactionId: 't1', txnType: 'expense', txnVoid: false, payeeContactId: 'c1', payeeName: 'Home Depot',
  categoryAccountId: 'a1', categoryAccountName: '6100 · Repairs', categoryCount: 1,
  suggestedAccountName: null, reviewedAt: null, ...over,
});

beforeEach(() => {
  markMutate.mockReset();
  recategorizeMutate.mockReset();
  listSpy.mockReset();
  sessionStorage.clear();
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

  it('changes the payee on the selection without touching the category', () => {
    renderTab();
    fireEvent.click(screen.getByLabelText('Select all loaded rows'));
    fireEvent.click(screen.getByRole('button', { name: /change payee/i }));
    expect(screen.queryByLabelText(/Category for/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Payee for 2 transactions'), { target: { value: 'contact-9' } });
    fireEvent.click(screen.getByRole('button', { name: /^save \(2\)$/i }));
    expect(recategorizeMutate.mock.calls[0]![0]).toEqual({
      feedItemIds: ['f1', 'f2'], contactId: 'contact-9', companyId: 'company-1',
    });
  });

  it('changes the category on the selection without touching the payee', () => {
    renderTab();
    fireEvent.click(screen.getByLabelText('Select all loaded rows'));
    fireEvent.click(screen.getByRole('button', { name: /change category/i }));
    expect(screen.queryByLabelText(/Payee for/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category for 2 transactions'), { target: { value: 'acct-7' } });
    fireEvent.click(screen.getByRole('button', { name: /^save \(2\)$/i }));
    expect(markMutate).not.toHaveBeenCalled();
    expect(recategorizeMutate.mock.calls[0]![0]).toEqual({
      feedItemIds: ['f1', 'f2'], accountId: 'acct-7', companyId: 'company-1',
    });
  });

  it('sorts by a column header, flips on a second click, and keeps the view for the session', () => {
    renderTab();
    const last = () => listSpy.mock.calls.at(-1)![0] as { sortBy?: string; sortDir?: string };
    expect(last().sortBy).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: /^payee/i }));
    expect(last()).toMatchObject({ sortBy: 'payee', sortDir: 'asc' });
    fireEvent.click(screen.getByRole('button', { name: /^payee/i }));
    expect(last()).toMatchObject({ sortBy: 'payee', sortDir: 'desc' });
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(last()).toMatchObject({ sortBy: 'amount', sortDir: 'desc' });
    expect(sessionStorage.getItem('vibe:close-feed-review:view')).toContain('"sortCol":"amount"');
  });
  it('edits a row\'s payee in place and saves on pick', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Home Depot' }));
    fireEvent.change(screen.getByLabelText('Payee picker'), { target: { value: 'contact-9' } });
    expect(recategorizeMutate.mock.calls[0]![0]).toEqual({
      feedItemIds: ['f1'], contactId: 'contact-9', companyId: 'company-1',
    });
  });

  it('edits a row\'s category in place and saves on pick', () => {
    renderTab();
    fireEvent.click(screen.getAllByRole('button', { name: '6100 · Repairs' })[0]!);
    fireEvent.change(screen.getByLabelText('Category picker'), { target: { value: 'acct-7' } });
    expect(recategorizeMutate.mock.calls[0]![0]).toEqual({
      feedItemIds: ['f1'], accountId: 'acct-7', companyId: 'company-1',
    });
  });

  it('backs out of an inline edit with Escape without saving', () => {
    renderTab();
    fireEvent.click(screen.getAllByRole('button', { name: '6100 · Repairs' })[0]!);
    fireEvent.keyDown(screen.getByLabelText('Category picker'), { key: 'Escape' });
    expect(screen.queryByLabelText('Category picker')).not.toBeInTheDocument();
    expect(recategorizeMutate).not.toHaveBeenCalled();
  });

  it('does not offer an inline category edit on a split', () => {
    listStore.rows = [row({ categoryCount: 3, categoryAccountId: null, categoryAccountName: null })];
    renderTab();
    expect(screen.getByText('Split (3 lines)').closest('button')).toBeNull();
  });

  it('shows the bank\'s raw description on hover', () => {
    renderTab();
    expect(screen.getByText('HOME DEPOT')).toHaveAttribute('title', 'Bank description: HOME DEPOT #4411 KALAMAZOO MI');
  });
});
