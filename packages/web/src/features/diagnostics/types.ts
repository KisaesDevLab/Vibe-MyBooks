// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

export interface SentinelHeaderDTO {
  v: 1;
  installationId: string;
  hostId: string;
  createdAt: string;
  adminEmail: string;
  appVersion: string;
}

export type DiagnosticStatus =
  | { status: 'ok'; installationId: string; hostId: string }
  | { status: 'fresh-install' }
  | {
      status: 'regenerate-sentinel';
      reason: 'missing' | 'host-id-changed' | 'fresh-volume';
      dbInstallationId: string;
      previousHostId?: string;
    }
  | {
      status: 'blocked';
      code:
        | 'DATABASE_RESET_DETECTED'
        | 'INSTALLATION_MISMATCH'
        | 'SENTINEL_DECRYPT_FAILED'
        | 'SENTINEL_CORRUPT'
        | 'ORPHANED_DATA'
        | 'UNKNOWN';
      header?: SentinelHeaderDTO;
      details: string;
    };

export interface DiagnosticStatusResponse {
  result: DiagnosticStatus;
  sentinelHeader: SentinelHeaderDTO | null;
  hostId: string | null;
}
