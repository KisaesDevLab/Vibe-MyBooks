// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

// Diagnostic pages fetch their own status on mount. Keep them hermetic.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      state: 'env-missing', missingVars: [], hostId: null,
      recoveryFilePresent: false, sentinelHeader: null, sentinelHeaderError: null,
    }),
  } as Partial<Response>));
});

import { EnvMissingPage } from './EnvMissingPage';
import { EncryptionKeyErrorPage } from './EncryptionKeyErrorPage';
import { InstallationMismatchPage } from './InstallationMismatchPage';
import { DatabaseResetPage } from './DatabaseResetPage';

describe('diagnostic pages', () => {
  it('EnvMissingPage renders the env-missing recovery frame', async () => {
    renderRoute(<EnvMissingPage />);
    // Use findAllByText + length check rather than a unique-match query.
    const matches = await screen.findAllByText(/env.*missing|missing env/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('EncryptionKeyErrorPage renders the decrypt-failed frame', () => {
    renderRoute(<EncryptionKeyErrorPage header={null} details="key mismatch" />);
    // The heading text is unique; body + code share similar phrases.
    expect(screen.getByRole('heading', { name: /encryption key mismatch/i })).toBeInTheDocument();
  });

  it('EncryptionKeyErrorPage renders the corrupt-sentinel variant', () => {
    renderRoute(<EncryptionKeyErrorPage header={null} details="bad crc" corrupt />);
    expect(screen.getByRole('heading', { name: /sentinel file corrupted/i })).toBeInTheDocument();
  });

  it('InstallationMismatchPage renders the hard-stop frame', () => {
    const status = {
      status: 'blocked' as const,
      code: 'INSTALLATION_MISMATCH' as const,
      details: 'DB installation_id 11111111-2222-3333-4444-555555555555 does not match sentinel',
    };
    renderRoute(
      <InstallationMismatchPage status={status} sentinelHeader={null} currentHostId={null} />,
    );
    expect(screen.getByText(/installation mismatch/i)).toBeInTheDocument();
  });

  it('DatabaseResetPage renders the reset-detected frame', () => {
    renderRoute(
      <DatabaseResetPage header={null} details="system_settings missing" />,
    );
    expect(screen.getByText(/database reset/i)).toBeInTheDocument();
  });
});
