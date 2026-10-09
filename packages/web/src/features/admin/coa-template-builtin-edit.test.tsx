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

import { CoaTemplatesPage } from './CoaTemplatesPage';

const detail = {
  id: 't1', slug: 'farm', label: 'Farm', isBuiltin: true, isHidden: false, accountsCustomized: true,
  createdByUserId: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  accounts: [{ accountNumber: '10100', name: 'Cash', accountType: 'asset', detailType: 'bank', isSystem: true, systemTag: 'cash_on_hand' }],
};

beforeEach(() => {
  apiClientMock.mockReset();
  apiClientMock.mockImplementation((url: unknown) => {
    const u = String(url);
    if (u.endsWith('/reset')) return Promise.resolve({ template: { ...detail, accountsCustomized: false } });
    if (u === '/admin/coa-templates') {
      return Promise.resolve({ templates: [{ id: 't1', slug: 'farm', label: 'Farm', isBuiltin: true, isHidden: false, accountsCustomized: true, accountCount: 1, updatedAt: detail.updatedAt }] });
    }
    if (u === '/admin/coa-templates/farm') return Promise.resolve({ template: detail });
    return Promise.resolve({});
  });
});

describe('COA templates — editing built-ins', () => {
  it('marks a customized built-in and resets it to the shipped default', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoute(<CoaTemplatesPage />);
    await waitFor(() => expect(screen.getByText('Customized')).toBeTruthy());
    fireEvent.click(screen.getByText('Farm'));
    const reset = await screen.findByRole('button', { name: /Reset to default/ });
    fireEvent.click(reset);
    await waitFor(() => expect(apiClientMock.mock.calls.some((c) => String(c[0]) === '/admin/coa-templates/farm/reset')).toBe(true));
  });
});
