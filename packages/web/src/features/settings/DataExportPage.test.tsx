// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Behavioural coverage for Settings > Export Data. The page used to expect
// an array from /export/full while the API returned an object, and hit a
// /export/download/ path that never existed — the bulk smoke test only
// mounts the page, so neither bug was caught. This drives the two clicks.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { DataExportPage } from './DataExportPage';

const apiClient = vi.fn();
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    apiClient: (...args: unknown[]) => apiClient(...args),
    getAccessToken: () => 'tok',
  };
});

const manifest = {
  files: [
    { name: 'accounts.csv', rowCount: 12 },
    { name: 'contacts.csv', rowCount: 3 },
    { name: 'items.csv', rowCount: 0 },
    { name: 'tags.csv', rowCount: 1 },
    { name: 'transactions.csv', rowCount: 40 },
    { name: 'journal_lines.csv', rowCount: 95 },
  ],
  startDate: null,
  endDate: null,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  apiClient.mockReset();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Disposition': 'attachment; filename="transactions_2025-01-01_to_2025-12-31.csv"' }),
    blob: async () => new Blob(['a,b\n'], { type: 'text/csv' }),
    json: async () => ({}),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:x'),
    revokeObjectURL: vi.fn(),
  }));
});

describe('DataExportPage', () => {
  it('lists every file with its row count after preparing an all-dates export', async () => {
    apiClient.mockResolvedValueOnce(manifest);
    renderRoute(<DataExportPage />);

    fireEvent.click(screen.getByRole('button', { name: /prepare export/i }));

    await waitFor(() => expect(screen.getByText('Export Ready')).toBeTruthy());
    expect(apiClient).toHaveBeenCalledWith('/export/full');
    expect(screen.getByText('Chart of Accounts')).toBeTruthy();
    expect(screen.getByText('Products & Services')).toBeTruthy();
    expect(screen.getByText('Journal Lines')).toBeTruthy();
    expect(screen.getByText(/^95 rows/)).toBeTruthy();
    expect(screen.getByText(/^0 rows/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /download/i })).toHaveLength(6);
  });

  it('passes the date range to the manifest call and to each download', async () => {
    apiClient.mockResolvedValueOnce({ ...manifest, startDate: '2025-01-01', endDate: '2025-12-31' });
    renderRoute(<DataExportPage />);

    fireEvent.click(screen.getByLabelText('Date range'));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2025-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: /prepare export/i }));

    await waitFor(() => expect(screen.getByText('Export Ready')).toBeTruthy());
    expect(apiClient).toHaveBeenCalledWith('/export/full?start_date=2025-01-01&end_date=2025-12-31');
    expect(screen.getByText('2025-01-01 to 2025-12-31')).toBeTruthy();

    // Editing the inputs after preparing must not change what downloads.
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-06-30' } });

    const downloads = screen.getAllByRole('button', { name: /download/i });
    fireEvent.click(downloads[4]!); // transactions.csv

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/export\/full\/transactions\.csv\?start_date=2025-01-01&end_date=2025-12-31$/);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('refuses an inverted range client-side', () => {
    renderRoute(<DataExportPage />);
    fireEvent.click(screen.getByLabelText('Date range'));
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2025-01-01' } });

    expect(screen.getByText('Start date must not be after end date.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /prepare export/i }));
    expect(apiClient).not.toHaveBeenCalled();
  });

  it('surfaces a failed download as a toast instead of a silent no-op', async () => {
    apiClient.mockResolvedValueOnce(manifest);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Insufficient permissions' } }),
    });
    renderRoute(<DataExportPage />);
    fireEvent.click(screen.getByRole('button', { name: /prepare export/i }));
    await waitFor(() => expect(screen.getByText('Export Ready')).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: /download/i })[0]!);
    await waitFor(() => expect(screen.getByText('Insufficient permissions')).toBeTruthy());
  });
});
