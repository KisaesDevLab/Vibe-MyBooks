// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Client suggested → Email notifications: the per-client list of staff who
// get the "client categorized N transactions" email. Same picker as the
// doc-request rule; only active staff are offered; nobody checked = no email.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const remindersApi = vi.hoisted(() => vi.fn());
vi.mock('../reminders/RemindersPage', () => ({ api: (...args: unknown[]) => remindersApi(...args) }));
const apiClient = vi.hoisted(() => vi.fn());
vi.mock('../../../api/client', () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { SuggestionNotifyModal } from './SuggestionNotifyModal';

const puts = () => apiClient.mock.calls.filter((c) => c[1]?.method === 'PUT');

beforeEach(() => {
  remindersApi.mockReset();
  apiClient.mockReset();
  remindersApi.mockImplementation(async (path: string) => {
    if (path === '/company/users') {
      return {
        users: [
          { id: 'u1', email: 'kurt@firm.com', displayName: 'Kurt', userType: 'staff', isActive: true },
          { id: 'u2', email: 'dawn@firm.com', displayName: 'Dawnata', userType: 'staff', isActive: true },
          { id: 'u3', email: 'irene@client.com', displayName: 'Irene', userType: 'client', isActive: true },
          { id: 'u4', email: 'gone@firm.com', displayName: 'Gone', userType: 'staff', isActive: false },
        ],
      };
    }
    return {};
  });
  apiClient.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/practice/uncategorized/notify-settings' && init?.method === 'PUT') {
      return JSON.parse(String(init.body));
    }
    if (path === '/practice/uncategorized/notify-settings') return { notifyUserIds: ['u1'] };
    return {};
  });
});

describe('SuggestionNotifyModal', () => {
  it('shows the saved list with the shared staff picker, offering active staff only', async () => {
    renderRoute(<SuggestionNotifyModal open onClose={() => {}} />);
    expect(await screen.findByText('Email staff when the client categorizes transactions')).toBeTruthy();
    const kurt = await screen.findByRole('checkbox', { name: /Kurt/ }) as HTMLInputElement;
    const dawn = screen.getByRole('checkbox', { name: /Dawnata/ }) as HTMLInputElement;
    expect(kurt.checked).toBe(true);
    expect(dawn.checked).toBe(false);
    expect(screen.queryByRole('checkbox', { name: /Irene/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Gone/ })).toBeNull();
    expect(screen.getByText(/Nobody checked = no email/)).toBeTruthy();
  });

  it('saves exactly the checked people', async () => {
    const onClose = vi.fn();
    renderRoute(<SuggestionNotifyModal open onClose={onClose} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Kurt/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Dawnata/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(String(puts()[0]![1].body))).toEqual({ notifyUserIds: ['u2'] });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('an emptied list is saved as empty (no email)', async () => {
    renderRoute(<SuggestionNotifyModal open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Kurt/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(String(puts()[0]![1].body))).toEqual({ notifyUserIds: [] });
  });
});
