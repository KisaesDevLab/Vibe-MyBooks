// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Peer screen share E2E (addendum Phase 14.11/14.12). Runs against a
// SHARE_ENABLED dev stack; ports are overridable so the suite can coexist
// with a production appliance that pins 3001/5173 on localhost:
//   SHARE_E2E_WEB (default http://localhost:5273)
//   SHARE_E2E_API (default http://localhost:3111)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-share',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env['SHARE_E2E_WEB'] || 'http://localhost:5273',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
