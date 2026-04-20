// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Client-side feature flags. Read once from Vite's env at module load so
// every reference resolves to the same value throughout a session. Flags
// are build-time: flip VITE_ENTRY_FORMS_V2 in the environment (or in
// .env.local) and rebuild the web bundle.
//
// The corresponding API-side flag for the tags rollout lives in
// packages/api/src/config/env.ts (TAGS_SPLIT_LEVEL_V2). Per ADR 0XX §4
// and ADR 0XZ §9, data-model and UI flags are independent so either
// rollout can be reverted without touching the other.

function readFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw === 'true' || raw === '1';
}

/** ADR 0XZ — two-line split row entry forms. */
export const ENTRY_FORMS_V2 = readFlag(import.meta.env['VITE_ENTRY_FORMS_V2'] as string | undefined);
