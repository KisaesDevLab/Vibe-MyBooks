// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const apiClientMock = vi.fn();
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

import { ClaudeModelUpdatesCard } from './ClaudeModelUpdatesCard';

const check = {
  latestByFamily: {
    sonnet: { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', createdAt: '2026-08-01T00:00:00Z' },
    haiku: { id: 'claude-haiku-5-5', displayName: 'Claude Haiku 5.5', createdAt: '2026-08-01T00:00:00Z' },
  },
  configured: [
    { slot: 'categorization', label: 'Transaction Categorization', current: 'claude-sonnet-4-6' },
    { slot: 'chat', label: 'Chat', current: 'claude-sonnet-5-5' },
  ],
  upgrades: [
    { slot: 'categorization', label: 'Transaction Categorization', current: 'claude-sonnet-4-6', latest: 'claude-sonnet-5-5', latestDisplayName: 'Claude Sonnet 5.5' },
  ],
};

describe('ClaudeModelUpdatesCard', () => {
  beforeEach(() => apiClientMock.mockReset());

  it('checks Anthropic, lists the proposed upgrade, and applies one slot', async () => {
    apiClientMock.mockImplementation((url: unknown) =>
      String(url).endsWith('/upgrade') ? Promise.resolve({ applied: check.upgrades }) : Promise.resolve(check));
    renderRoute(<ClaudeModelUpdatesCard />);
    fireEvent.click(screen.getByRole('button', { name: /check for new models/i }));
    await waitFor(() => expect(screen.getByText('Transaction Categorization')).toBeTruthy());
    expect(screen.getByText('claude-sonnet-4-6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    await waitFor(() => expect(screen.getByText(/Updated 1 model setting/)).toBeTruthy());
    const post = apiClientMock.mock.calls.find((c) => String(c[0]).endsWith('/upgrade'))!;
    expect(JSON.parse((post[1] as { body: string }).body)).toEqual({ slots: ['categorization'] });
  });

  it('says so when everything is current', async () => {
    apiClientMock.mockResolvedValue({ ...check, upgrades: [] });
    renderRoute(<ClaudeModelUpdatesCard />);
    fireEvent.click(screen.getByRole('button', { name: /check for new models/i }));
    await waitFor(() => expect(screen.getByText(/are on the newest model/)).toBeTruthy());
  });
});
