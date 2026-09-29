// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

// Stub every hook this page consumes so the render is fully
// deterministic. The page itself is the unit under test; its
// children are covered by their own unit tests.
const flagStore: { value: boolean | undefined } = { value: true };
const feedReviewStore: { data: unknown } = { data: undefined };

vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({
    activeCompanyId: 'company-1',
    activeCompanyName: 'Test Co',
    companies: [],
  }),
}));
vi.mock('../../../api/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => flagStore.value,
  useFeatureFlags: () => ({ data: undefined }),
}));
vi.mock('../../../api/hooks/useClassificationState', () => ({
  useFeedReviewSummary: () => ({ data: feedReviewStore.data }),
  useFeedReviewList: () => ({
    data: { pages: [{ rows: [], total: 0 }], pageParams: [0] },
    isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
  }),
  useMarkFeedReviewed: () => ({ mutate: vi.fn(), isPending: false }),
  useRecategorizeFeedItems: () => ({ mutate: vi.fn(), isPending: false }),
}))
// The Checklist tab is the default, so its hooks (and the Findings
// tab's, reachable by click) must be stubbed or they issue real
// fetches in jsdom.
vi.mock('../../../api/hooks/useReviewChecks', () => ({
  useCloseChecklist: () => ({ data: { tasks: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useCompleteChecklistTask: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenChecklistTask: () => ({ mutate: vi.fn(), isPending: false }),
  useCloseRecord: () => ({ data: undefined }),
  useSignClose: () => ({ mutate: vi.fn(), isPending: false }),
  useUndoCloseSignoff: () => ({ mutate: vi.fn(), isPending: false }),
  useCheckRegistry: () => ({ data: { checks: [] }, isLoading: false }),
  useFindings: () => ({ data: { rows: [], nextCursor: null }, isLoading: false }),
  useFindingsInfinite: () => ({
    data: { pages: [{ rows: [], nextCursor: null }], pageParams: [undefined] },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  useFinding: () => ({ data: undefined, isLoading: false }),
  useFindingEvents: () => ({ data: { events: [] }, isLoading: false }),
  useFindingsSummary: () => ({ data: undefined }),
  useRunChecks: () => ({ mutate: vi.fn(), isPending: false }),
  useRunAiJudgment: () => ({ mutate: vi.fn(), isPending: false }),
  useCheckRuns: () => ({ data: { runs: [] } }),
  useTransitionFinding: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkTransitionFindings: () => ({ mutate: vi.fn(), isPending: false }),
  useSuppressions: () => ({ data: { suppressions: [] } }),
  useCreateSuppression: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { CloseReviewPage } from './CloseReviewPage';

beforeEach(() => {
  flagStore.value = true;
  feedReviewStore.data = undefined;
});

describe('CloseReviewPage', () => {
  it('renders the page heading', () => {
    renderRoute(<CloseReviewPage />);
    expect(screen.getByRole('heading', { name: 'Close Review' })).toBeInTheDocument();
  });

  it('renders the four tabs with Overview first (and default)', () => {
    renderRoute(<CloseReviewPage />);
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bank feed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manual queue' })).toBeInTheDocument();
    // Default tab content: the checklist progress line renders.
    expect(screen.getByText(/close tasks done/)).toBeInTheDocument();
  });

  it('shows the Thresholds link to /practice/settings', () => {
    renderRoute(<CloseReviewPage />);
    const link = screen.getByRole('link', { name: /Thresholds/ });
    expect(link).toHaveAttribute('href', '/practice/settings');
  });

  it('disables the Buckets tab when AI_BUCKET_WORKFLOW_V1 is off', () => {
    flagStore.value = false;
    renderRoute(<CloseReviewPage />);
    const bucketsBtn = screen.getByRole('button', { name: 'Bank feed' });
    expect(bucketsBtn).toBeDisabled();
  });

  it('shows reviewer progress for the period, hidden when there is no bank activity', () => {
    const empty = { rule: { total: 0, reviewed: 0 }, ai: { total: 0, reviewed: 0 }, history: { total: 0, reviewed: 0 }, check_image: { total: 0, reviewed: 0 }, manual: { total: 0, reviewed: 0 }, matched: { total: 0, reviewed: 0 }, excluded: { total: 0, reviewed: 0 } };
    feedReviewStore.data = { periodTotal: 0, periodOpen: 0, doneTotal: 0, reviewed: 0, byMethod: empty, hasBankFeed: false, otherMonthsOpen: [] };
    const { unmount } = renderRoute(<CloseReviewPage />);
    expect(screen.queryByText(/reviewed$/)).not.toBeInTheDocument();
    unmount();
    feedReviewStore.data = { periodTotal: 253, periodOpen: 0, doneTotal: 253, reviewed: 40, byMethod: empty, hasBankFeed: true, otherMonthsOpen: [] };
    renderRoute(<CloseReviewPage />);
    expect(screen.getByText('40 of 253 reviewed')).toBeInTheDocument();
  });
});
