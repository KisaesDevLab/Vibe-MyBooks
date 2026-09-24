// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Statement Processing: every job row that still has its uploaded file
// offers "View PDF", which opens the attachment in a new tab through a
// single-use download token (window.open cannot carry a bearer header).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { passthroughMutation } from '../../test-mocks';

// vi.mock factories are hoisted above module code, so the shared mock has
// to be hoisted with them.
const { apiClientMock } = vi.hoisted(() => ({ apiClientMock: vi.fn() }));

vi.mock('../../api/hooks/useAi', () => ({
  useStatementJobs: () => ({
    data: {
      jobs: [
        { jobId: 'job-1', attachmentId: 'att-1', fileName: 'jan.pdf', status: 'complete', stage: null, createdAt: '2026-02-01T00:00:00Z', importedAt: null, transactionCount: 12, error: null },
        { jobId: 'job-2', attachmentId: null, fileName: 'gone.pdf', status: 'failed', stage: null, createdAt: '2026-02-02T00:00:00Z', importedAt: null, transactionCount: 0, error: 'boom' },
      ],
      total: 2,
    },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useDeleteStatementJob: passthroughMutation,
  useReprocessStatementJob: passthroughMutation,
}));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: apiClientMock };
});

import { StatementImportsPage } from './StatementImportsPage';

beforeEach(() => {
  apiClientMock.mockReset();
  apiClientMock.mockResolvedValue({ token: 'tok-123', expiresIn: 60 });
});

describe('StatementImportsPage — View PDF', () => {
  it('opens the uploaded statement in a new tab via a download token, only when the file is still there', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderRoute(<StatementImportsPage />);

    // One button: the job whose attachment was removed offers none.
    const buttons = screen.getAllByRole('button', { name: /view pdf/i });
    expect(buttons).toHaveLength(1);

    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(apiClientMock).toHaveBeenCalledWith('/downloads/token', expect.objectContaining({ method: 'POST' }));
    const url = String(open.mock.calls[0]![0]);
    expect(url).toContain('/attachments/att-1/download?inline=1&_dl=tok-123');
    expect(open.mock.calls[0]![1]).toBe('_blank');
    open.mockRestore();
  });
});
