// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import {
  authMocks, companyMocks, aiMocks, tailscaleMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useAuth', () => authMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/useTailscale', () => tailscaleMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    apiClient: vi.fn().mockResolvedValue({
      tenants: [], users: [], rules: [], templates: [], connections: [],
      stats: {}, config: {}, logs: [], data: [], total: 0,
    }),
  };
});

// Some admin pages bypass hooks and call fetch directly. Supply a default
// empty-but-structured response shape.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({
      tenants: [], users: [], config: {}, stats: {}, logs: [],
      peers: [], self: null, backendState: 'NoState',
    }),
  } as Partial<Response>));
});

import { AdminDashboard } from './AdminDashboard';
import { TenantListPage } from './TenantListPage';
import { TenantDetailPage } from './TenantDetailPage';
import { UserListPage } from './UserListPage';
import { GlobalBankRulesPage } from './GlobalBankRulesPage';
import { TfaConfigPage } from './TfaConfigPage';
import { InstallationSecurityPage } from './InstallationSecurityPage';
import { PlaidConfigPage } from './PlaidConfigPage';
import { PlaidConnectionsMonitorPage } from './PlaidConnectionsMonitorPage';
import { AiConfigPage } from './AiConfigPage';
import { McpConfigPage } from './McpConfigPage';
import { CoaTemplatesPage } from './CoaTemplatesPage';
import { TailscaleAdminPage } from './TailscaleAdminPage';

describe('admin pages', () => {
  for (const [name, Component, route, path] of [
    ['AdminDashboard', AdminDashboard, '/admin', '/admin'],
    ['TenantListPage', TenantListPage, '/admin/tenants', '/admin/tenants'],
    ['TenantDetailPage', TenantDetailPage, '/admin/tenants/t1', '/admin/tenants/:id'],
    ['UserListPage', UserListPage, '/admin/users', '/admin/users'],
    ['GlobalBankRulesPage', GlobalBankRulesPage, '/admin/bank-rules', '/admin/bank-rules'],
    ['TfaConfigPage', TfaConfigPage, '/admin/tfa', '/admin/tfa'],
    ['InstallationSecurityPage', InstallationSecurityPage, '/admin/security', '/admin/security'],
    ['PlaidConfigPage', PlaidConfigPage, '/admin/plaid', '/admin/plaid'],
    ['PlaidConnectionsMonitorPage', PlaidConnectionsMonitorPage, '/admin/plaid/connections', '/admin/plaid/connections'],
    ['AiConfigPage', AiConfigPage, '/admin/ai', '/admin/ai'],
    ['McpConfigPage', McpConfigPage, '/admin/mcp', '/admin/mcp'],
    ['CoaTemplatesPage', CoaTemplatesPage, '/admin/coa-templates', '/admin/coa-templates'],
    ['TailscaleAdminPage', TailscaleAdminPage, '/admin/tailscale', '/admin/tailscale'],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />, { route, path });
      expectPageRendered();
    });
  }
});
