// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Recurring list: sort is server-side (the list paginates); the Status
// popover mirrors the status filter buttons.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { RecurringListPage } from './RecurringListPage';

const sched = (id: string, name: string, isActive: boolean) => ({
  id, templateTransactionId: 'tx1', name, frequency: 'monthly', intervalValue: 1, mode: 'auto_post',
  startDate: '2026-01-01', endDate: null, nextOccurrence: '2026-07-01', isActive, lastPostedAt: null, archivedAt: null,
});

const lastUrl = () => String([...apiClientMock.mock.calls].reverse().find((a) => String(a[0]).startsWith('/recurring?'))?.[0]);

beforeEach(() => {
  sessionStorage.clear();
  apiClientMock.mockReset();
  apiClientMock.mockResolvedValue({ schedules: [sched('r1', 'Rent', true), sched('r2', 'Alarm', false)], total: 2 });
});

describe('RecurringListPage — column sort', () => {
  it('asks the server for the sort and persists it', async () => {
    renderRoute(<RecurringListPage />);
    await screen.findByText('Rent');
    expect(lastUrl()).toContain('sortBy=nextOccurrence&sortDir=asc');
    fireEvent.click(screen.getByRole('button', { name: /^frequency/i }));
    await waitFor(() => expect(lastUrl()).toContain('sortBy=frequency&sortDir=asc'));
    expect(lastUrl()).toContain('offset=0');
    expect(JSON.parse(sessionStorage.getItem('vibe:recurring:view')!)).toMatchObject({ sortCol: 'frequency' });
  });

  it('the Status popover drives the status filter buttons', async () => {
    renderRoute(<RecurringListPage />);
    await screen.findByText('Rent');
    expect(screen.queryByText('Alarm')).toBeNull();          // default filter = active
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    fireEvent.click(screen.getByLabelText('Active'));   // untick the current one
    fireEvent.click(screen.getByLabelText('Paused'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Alarm')).toBeInTheDocument();
    expect(screen.queryByText('Rent')).toBeNull();
  });
});
