// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const openReportPdf = vi.fn(async (..._args: unknown[]) => ({ skippedAttachments: 0 }));
vi.mock('./openReportPdf', () => ({ openReportPdf: (...args: unknown[]) => openReportPdf(...args) }));

import { TransactionReportButton, transactionReportUrl } from './TransactionReportButton';

describe('TransactionReportButton', () => {
  beforeEach(() => {
    openReportPdf.mockClear();
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('opens the plain report on the main click', async () => {
    renderRoute(<TransactionReportButton transactionId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: /^Transaction Report$/ }));
    await waitFor(() => expect(openReportPdf).toHaveBeenCalledTimes(1));
    expect(openReportPdf.mock.calls[0]![0]).toBe('/transactions/t1/report.pdf');
  });

  it('offers the activity-log variant from the menu and remembers it', async () => {
    renderRoute(<TransactionReportButton transactionId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Transaction Report options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Transaction Report with activity log' }));
    await waitFor(() => expect(openReportPdf).toHaveBeenCalledTimes(1));
    expect(String(openReportPdf.mock.calls[0]![0])).toMatch(/^\/transactions\/t1\/report\.pdf\?activity=1/);
    // The main click now carries the remembered choice.
    await waitFor(() => expect(screen.getByRole('button', { name: /Transaction Report \+ activity/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Transaction Report \+ activity/ }));
    await waitFor(() => expect(openReportPdf).toHaveBeenCalledTimes(2));
    expect(String(openReportPdf.mock.calls[1]![0])).toContain('activity=1');
  });

  it('builds the URL with the browser time zone', () => {
    expect(transactionReportUrl('x', false)).toBe('/transactions/x/report.pdf');
    expect(transactionReportUrl('x', true)).toMatch(/activity=1(&tz=.+)?$/);
  });
});
