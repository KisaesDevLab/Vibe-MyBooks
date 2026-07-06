// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// FIX 2 — the AI error-toast composer must map every code a service can
// throw to a friendly reason. Regression guard for `ai_consent_blocked`
// (the H7 per-company opt-in gate), which previously fell through to raw
// server text.

import { describe, it, expect } from 'vitest';
import { composeAiErrorMessage } from './useAi';

describe('composeAiErrorMessage', () => {
  it('maps ai_consent_blocked to the Company Settings guidance', () => {
    const msg = composeAiErrorMessage('AI categorization', 'ai_consent_blocked', 'raw server text');
    expect(msg).toContain('Company Settings');
    expect(msg).not.toContain('raw server text');
  });

  it('maps the deliberate off-states to clear reasons', () => {
    expect(composeAiErrorMessage('AI categorization', 'ai_disabled_globally', 'x')).toMatch(/disabled by an administrator/i);
    expect(composeAiErrorMessage('AI categorization', 'ai_no_provider_configured', 'x')).toMatch(/No provider/i);
    expect(composeAiErrorMessage('AI categorization', 'ai_function_disabled', 'x')).toMatch(/disabled in Admin/i);
  });

  it('appends the server detail for codes that carry actionable diagnostics', () => {
    const detail = 'anthropic / claude: response truncated';
    const msg = composeAiErrorMessage('AI categorization', 'ai_all_providers_failed', detail);
    // Friendly headline PLUS the raw provider detail on its own line.
    expect(msg).toContain(detail);
    expect(msg).toMatch(/provider failed/i);
  });

  it('falls through to the verbatim server message for an unknown code', () => {
    const msg = composeAiErrorMessage('AI categorization', 'some_unmapped_code', 'the raw message');
    expect(msg).toBe('AI categorization failed — the raw message');
  });
});
