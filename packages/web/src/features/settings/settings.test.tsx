// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import {
  companyMocks, accountsMocks, authMocks, aiMocks,
  checksMocks, tagsMocks,
} from '../../test-mocks';

vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useAuth', () => authMocks());
vi.mock('../../api/hooks/useAi', () => aiMocks());
vi.mock('../../api/hooks/useChecks', () => checksMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    apiClient: vi.fn().mockResolvedValue({
      data: [], total: 0, settings: {}, users: [], apiKeys: [],
      providers: [], backups: [], labels: {},
    }),
  };
});

// A handful of settings pages (email/stripe/system/tfa) bypass the hook
// layer and call `fetch` directly on mount. Stub the global so those GETs
// resolve to a shape the page can consume without crashing on deep
// indexing like `.peers[0]` / `.accounts`.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: [], settings: {}, users: [], accounts: [], providers: [],
      backups: [], peers: [], apiKeys: [], mappings: [], status: 'ok',
      smtpHost: '', smtpPort: 587, backupSchedule: 'none',
      applicationUrl: 'http://localhost', maxFileSizeMb: '10', appName: '',
    }),
    text: async () => '',
  } as Partial<Response>));
});

import { ApiKeysPage } from './ApiKeysPage';
import { AuditLogPage } from './AuditLogPage';
import { BackupRestorePage } from './BackupRestorePage';
import { CheckPrintSettingsPage } from './CheckPrintSettingsPage';
import { CompanyAiSettingsPage } from './CompanyAiSettingsPage';
import { ConnectedAppsPage } from './ConnectedAppsPage';
import { DataExportPage } from './DataExportPage';
import { EmailSettingsPage } from './EmailSettingsPage';
import { OpeningBalancesPage } from './OpeningBalancesPage';
import { PreferencesPage } from './PreferencesPage';
import { RemoteBackupSettingsPage } from './RemoteBackupSettingsPage';
import { ReportLabelsPage } from './ReportLabelsPage';
import { SettingsPage } from './SettingsPage';
import { StorageSettingsPage } from './StorageSettingsPage';
import { StripeSettingsPage } from './StripeSettingsPage';
import { SystemSettingsPage } from './SystemSettingsPage';
import { TeamPage } from './TeamPage';
import { TenantExportPage } from './TenantExportPage';
import { TenantImportPage } from './TenantImportPage';
import { TfaSettingsPage } from './TfaSettingsPage';

describe('settings pages', () => {
  for (const [name, Component] of [
    ['ApiKeysPage', ApiKeysPage],
    ['AuditLogPage', AuditLogPage],
    ['BackupRestorePage', BackupRestorePage],
    ['CheckPrintSettingsPage', CheckPrintSettingsPage],
    ['CompanyAiSettingsPage', CompanyAiSettingsPage],
    ['ConnectedAppsPage', ConnectedAppsPage],
    ['DataExportPage', DataExportPage],
    ['EmailSettingsPage', EmailSettingsPage],
    ['OpeningBalancesPage', OpeningBalancesPage],
    ['PreferencesPage', PreferencesPage],
    ['RemoteBackupSettingsPage', RemoteBackupSettingsPage],
    ['ReportLabelsPage', ReportLabelsPage],
    ['SettingsPage', SettingsPage],
    ['StorageSettingsPage', StorageSettingsPage],
    ['StripeSettingsPage', StripeSettingsPage],
    ['SystemSettingsPage', SystemSettingsPage],
    ['TeamPage', TeamPage],
    ['TenantExportPage', TenantExportPage],
    ['TenantImportPage', TenantImportPage],
    ['TfaSettingsPage', TfaSettingsPage],
  ] as const) {
    it(`${name} renders`, () => {
      renderRoute(<Component />);
      expectPageRendered();
    });
  }
});
