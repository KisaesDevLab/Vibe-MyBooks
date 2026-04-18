// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import { companyMocks, accountsMocks, authMocks } from '../../test-mocks';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useAuth', () => authMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ company: null, data: [], total: 0 }) };
});

import { CompanyProfilePage } from './CompanyProfilePage';
import { SetupWizard } from './SetupWizard';

describe('company pages', () => {
  it('CompanyProfilePage renders', () => {
    renderRoute(<CompanyProfilePage />);
    expectPageRendered();
  });

  it('SetupWizard renders', () => {
    renderRoute(<SetupWizard />);
    expectPageRendered();
  });
});
