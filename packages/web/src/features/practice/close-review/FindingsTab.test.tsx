// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const mockTransition = vi.fn();
const mockBulkTransition = vi.fn();
const mockRunChecks = vi.fn();

const findingsStore: { rows: unknown[]; isLoading: boolean } = { rows: [], isLoading: false };
const summaryStore: { data: unknown } = { data: undefined };
const registryStore: { data: unknown } = { data: { checks: [] } };
const runsStore: { data: unknown } = { data: { runs: [] } };

vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({
    activeCompanyId: 'company-1',
    activeCompanyName: 'Test Co',
    companies: [],
  }),
}));

vi.mock('../../../api/hooks/useReviewChecks', async () => {
  return {
    useCheckRegistry: () => registryStore.data
      ? { data: registryStore.data, isLoading: false }
      : { data: undefined, isLoading: true },
    useFindings: () => ({
      data: { rows: findingsStore.rows, nextCursor: null },
      isLoading: findingsStore.isLoading,
    }),
    useFinding: () => ({ data: undefined, isLoading: false }),
    useFindingEvents: () => ({ data: { events: [] }, isLoading: false }),
    useFindingsSummary: () => ({ data: summaryStore.data }),
    useRunChecks: () => ({ mutate: mockRunChecks, isPending: false }),
    useRunAiJudgment: () => ({ mutate: vi.fn(), isPending: false }),
    useCheckRuns: () => ({ data: runsStore.data }),
    useTransitionFinding: () => ({ mutate: mockTransition, isPending: false }),
    useBulkTransitionFindings: () => ({ mutate: mockBulkTransition, isPending: false }),
    useSuppressions: () => ({ data: { suppressions: [] } }),
    useCreateSuppression: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

// useFeatureFlag is consumed by RunChecksBar to toggle the AI
// button. Default false in tests so the AI button stays hidden.
vi.mock('../../../api/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
  useFeatureFlags: () => ({ data: undefined }),
}));

import { FindingsTab } from './FindingsTab';

beforeEach(() => {
  mockTransition.mockReset();
  mockBulkTransition.mockReset();
  mockRunChecks.mockReset();
  findingsStore.rows = [];
  findingsStore.isLoading = false;
  summaryStore.data = {
    byStatus: { open: 1, assigned: 0, in_review: 0, resolved: 0, ignored: 0 },
    bySeverity: { low: 0, med: 0, high: 1, critical: 0 },
    total: 1,
  };
  registryStore.data = {
    checks: [
      {
        checkKey: 'transaction_above_materiality',
        name: 'Above materiality threshold',
        description: null,
        handlerName: 'transaction_above_materiality',
        defaultSeverity: 'high',
        defaultParams: {},
        category: 'close',
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  runsStore.data = {
    runs: [
      {
        id: 'run-1',
        tenantId: 't',
        companyId: 'c',
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        completedAt: new Date(Date.now() - 30_000).toISOString(),
        checksExecuted: 13,
        findingsCreated: 1,
        truncated: false,
        error: null,
      },
    ],
  };
});

describe('FindingsTab', () => {
  it('renders the run-checks bar and empty state when no findings', () => {
    renderRoute(<FindingsTab />);
    expect(screen.getByRole('button', { name: /Run checks now/ })).toBeInTheDocument();
    expect(screen.getByText(/No findings match these filters/)).toBeInTheDocument();
  });

  it('renders the findings table when rows are present', () => {
    findingsStore.rows = [
      {
        id: 'f1',
        tenantId: 't',
        companyId: 'c',
        checkKey: 'transaction_above_materiality',
        transactionId: 'txn-1',
        vendorId: null,
        severity: 'high',
        status: 'open',
        assignedTo: null,
        payload: { amount: 25000, vendorName: 'Acme' },
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolutionNote: null,
      },
    ];
    renderRoute(<FindingsTab />);
    // Filter dropdown also lists the same name; pick the table cell.
    const cell = document.querySelector('table tbody tr td:nth-child(3)');
    expect(cell?.textContent).toContain('Above materiality threshold');
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });

  it('opens the detail drawer when a row is clicked', async () => {
    findingsStore.rows = [
      {
        id: 'f1',
        tenantId: 't',
        companyId: 'c',
        checkKey: 'transaction_above_materiality',
        transactionId: null,
        vendorId: null,
        severity: 'med',
        status: 'open',
        assignedTo: null,
        payload: {},
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolutionNote: null,
      },
    ];
    renderRoute(<FindingsTab />);
    const row = document.querySelector('table tbody tr');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    expect(within(dialog).getByRole('button', { name: /Resolve/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Mark in review/ })).toBeInTheDocument();
  });

  it('triggers run-checks mutation when the toolbar button is pressed', () => {
    renderRoute(<FindingsTab />);
    fireEvent.click(screen.getByRole('button', { name: /Run checks now/ }));
    expect(mockRunChecks).toHaveBeenCalledTimes(1);
  });
});
