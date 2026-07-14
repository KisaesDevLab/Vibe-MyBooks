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
const summaryStore: { data: unknown } = { data: undefined };

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
  useSummary: () => ({ data: summaryStore.data }),
  useBucket: () => ({ data: { rows: [], nextCursor: null }, isLoading: false }),
  useApprove: () => ({ mutate: vi.fn(), isPending: false }),
  useApproveAll: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useReclassify: () => ({ mutate: vi.fn(), isPending: false }),
  useVendorEnrichment: () => ({ data: null, isLoading: false, isError: false }),
}));
// The Checklist tab is the default, so its hooks (and the Findings
// tab's, reachable by click) must be stubbed or they issue real
// fetches in jsdom.
vi.mock('../../../api/hooks/useReviewChecks', () => ({
  useCloseChecklist: () => ({ data: { tasks: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useCompleteChecklistTask: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenChecklistTask: () => ({ mutate: vi.fn(), isPending: false }),
  useCheckRegistry: () => ({ data: { checks: [] }, isLoading: false }),
  useFindings: () => ({ data: { rows: [], nextCursor: null }, isLoading: false }),
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
  summaryStore.data = {
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-05-01T00:00:00.000Z',
    buckets: { potential_match: 0, rule: 0, auto_high: 0, auto_medium: 0, needs_review: 3 },
    totalUncategorized: 3,
    totalApproved: 0,
    findingsCount: 0,
  };
});

describe('CloseReviewPage', () => {
  it('renders the page heading', () => {
    renderRoute(<CloseReviewPage />);
    expect(screen.getByRole('heading', { name: 'Close Review' })).toBeInTheDocument();
  });

  it('renders the four tabs with Checklist first (and default)', () => {
    renderRoute(<CloseReviewPage />);
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buckets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Findings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manual Queue' })).toBeInTheDocument();
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
    const bucketsBtn = screen.getByRole('button', { name: 'Buckets' });
    expect(bucketsBtn).toBeDisabled();
  });
});
