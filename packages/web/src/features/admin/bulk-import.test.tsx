// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Regression coverage for the "stuck session" dead end: the upload
// duplicate-file guard tells the operator to open or delete the
// existing session, so the imports index page must actually list
// staged sessions with Open/Delete.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const deleteMutate = vi.fn();
const sessionsStore: { sessions: unknown[] } = { sessions: [] };

vi.mock('../../api/hooks/useImports', () => ({
  ImportApiError: class ImportApiError extends Error {
    constructor(public status: number, message: string, public code?: string, public details?: unknown) {
      super(message);
    }
  },
  useUploadImport: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useImportSession: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useImportSessions: () => ({ data: { sessions: sessionsStore.sessions, total: sessionsStore.sessions.length }, isLoading: false }),
  useCommitImport: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteImport: () => ({ mutate: deleteMutate, isPending: false, variables: undefined }),
}));

import { BulkImportPage } from './BulkImportPage';

beforeEach(() => {
  deleteMutate.mockClear();
  sessionsStore.sessions = [
    {
      id: 'sess-1', tenantId: 't', companyId: 'c', kind: 'contacts',
      sourceSystem: 'accounting_power', status: 'uploaded',
      originalFilename: 'vendors.csv', fileHash: 'x', rowCount: 42,
      errorCount: 0, reportDate: null, options: null, commitResult: null,
      createdBy: null, createdAt: new Date().toISOString(),
    },
    {
      id: 'sess-2', tenantId: 't', companyId: 'c', kind: 'coa',
      sourceSystem: 'accounting_power', status: 'committed',
      originalFilename: 'coa.csv', fileHash: 'y', rowCount: 10,
      errorCount: 0, reportDate: null, options: null, commitResult: null,
      createdBy: null, createdAt: new Date().toISOString(),
    },
  ];
});

describe('BulkImportPage — recent sessions', () => {
  it('lists staged and committed sessions with status chips', () => {
    renderRoute(<BulkImportPage />);
    expect(screen.getByText('Recent import sessions')).toBeInTheDocument();
    expect(screen.getByText('vendors.csv')).toBeInTheDocument();
    expect(screen.getByText('coa.csv')).toBeInTheDocument();
    expect(screen.getByText('uploaded')).toBeInTheDocument();
    expect(screen.getByText(/1 staged session awaiting commit/)).toBeInTheDocument();
  });

  it('offers Delete only for non-committed sessions and confirms first', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute(<BulkImportPage />);
    // One staged + one committed → exactly one Delete button.
    const deletes = screen.getAllByRole('button', { name: /^delete$/i });
    expect(deletes).toHaveLength(1);
    fireEvent.click(deletes[0]!);
    expect(deleteMutate).toHaveBeenCalledWith('sess-1');
    confirmSpy.mockRestore();
  });

  it('hides the panel entirely when there are no sessions', () => {
    sessionsStore.sessions = [];
    renderRoute(<BulkImportPage />);
    expect(screen.queryByText('Recent import sessions')).toBeNull();
  });
});
