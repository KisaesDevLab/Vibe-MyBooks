// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Statement Processing: sort and the Status filter are server-side now (the
// filter used to narrow only the fetched page); the select and the header
// popover share one entry.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { passthroughMutation } from '../../test-mocks';

let lastOpts: Record<string, unknown> = {};
const job = { jobId: 'job-1', attachmentId: 'att-1', fileName: 'jan.pdf', status: 'complete', stage: null, createdAt: '2026-02-01T00:00:00Z', importedAt: null, transactionCount: 12, error: null };

vi.mock('../../api/hooks/useAi', () => ({
  useStatementJobs: (opts: Record<string, unknown>) => {
    lastOpts = opts;
    return { data: { jobs: [job], total: 1 }, isLoading: false, isError: false, refetch: vi.fn() };
  },
  useDeleteStatementJob: passthroughMutation,
  useReprocessStatementJob: passthroughMutation,
}));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({}) };
});

import { StatementImportsPage } from './StatementImportsPage';

beforeEach(() => { sessionStorage.clear(); lastOpts = {}; });

describe('StatementImportsPage — sort and status filter', () => {
  it('sends the header sort with the offset reset', () => {
    renderRoute(<StatementImportsPage />);
    expect(lastOpts['sortBy']).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: /^transactions/i }));
    expect(lastOpts).toMatchObject({ sortBy: 'transactionCount', sortDir: 'asc', offset: 0 });
  });

  it('the status filter goes to the server as a set, shared between select and popover', () => {
    renderRoute(<StatementImportsPage />);
    fireEvent.change(screen.getByLabelText('Filter by processing status'), { target: { value: 'imported' } });
    expect(lastOpts['status']).toEqual(['imported']);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect((lastOpts['status'] as string[]).sort()).toEqual(['failed', 'imported']);
    expect((screen.getByLabelText('Filter by processing status') as HTMLSelectElement).value).toBe('');
  });
});
