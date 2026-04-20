// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  checksMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks,
  apMocks, transactionsMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useChecks', () => checksMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAp', () => apMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], checks: [] }) };
});

import { WriteCheckPage } from './WriteCheckPage';
import { PrintChecksPage } from './PrintChecksPage';

describe('checks pages', () => {
  it('WriteCheckPage renders', () => {
    renderRoute(<WriteCheckPage />);
    const headings = screen.queryAllByRole('heading');
    const statuses = screen.queryAllByRole('status');
    expect(headings.length + statuses.length).toBeGreaterThan(0);
  });

  it('PrintChecksPage renders', () => {
    renderRoute(<PrintChecksPage />);
    const headings = screen.queryAllByRole('heading');
    const statuses = screen.queryAllByRole('status');
    expect(headings.length + statuses.length).toBeGreaterThan(0);
  });

  // ADR 0XX §4 — header-level Tag selector was removed from WriteCheckPage.
  it('WriteCheckPage does not render a header-level Tags selector', () => {
    renderRoute(<WriteCheckPage />);
    expect(screen.queryByText(/^Tags$/)).toBeNull();
  });
});
