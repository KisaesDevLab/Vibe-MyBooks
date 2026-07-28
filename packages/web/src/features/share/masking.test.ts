// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Masking regression fixtures (8.10, 14.3): synthetic SSNs, EINs, routing
// numbers, card numbers — positives must redact, near-misses must survive.

import { describe, it, expect, vi } from 'vitest';
import { redactSensitiveText, maskInputFixed, luhnValid, abaValid, BLOCK_SELECTOR } from './masking';

describe('luhnValid', () => {
  it('accepts real test PANs and rejects near-misses', () => {
    expect(luhnValid('4111111111111111')).toBe(true); // Visa test
    expect(luhnValid('5500005555555559')).toBe(true); // MC test
    expect(luhnValid('4111111111111112')).toBe(false); // checksum off by one
    expect(luhnValid('1234567890123')).toBe(false);
  });
});

describe('abaValid', () => {
  it('accepts checksum-valid routing numbers and rejects others', () => {
    expect(abaValid('021000021')).toBe(true); // JPMorgan Chase NY
    expect(abaValid('081518906')).toBe(true); // checksum-valid (statement fixture)
    expect(abaValid('123456789')).toBe(false);
    expect(abaValid('987654321')).toBe(false);
  });
});

describe('redactSensitiveText', () => {
  it('redacts hyphenated SSN/ITIN', () => {
    const out = redactSensitiveText('Taxpayer SSN 123-45-6789 on file');
    expect(out).not.toContain('123-45-6789');
    expect(out).toContain('•••-••-••••');
  });

  it('redacts EINs', () => {
    const out = redactSensitiveText('EIN: 12-3456789');
    expect(out).not.toContain('12-3456789');
  });

  it('redacts checksum-valid routing numbers but keeps ordinary 9-digit refs', () => {
    const out = redactSensitiveText('Routing 021000021 · Ref 123456789');
    expect(out).not.toContain('021000021');
    expect(out).toContain('123456789'); // fails ABA checksum → not a routing number
  });

  it('redacts Luhn-valid card numbers, grouped or bare', () => {
    expect(redactSensitiveText('Card 4111111111111111')).not.toContain('4111111111111111');
    const grouped = redactSensitiveText('Card 4111 1111 1111 1111 exp 12/28');
    expect(grouped).not.toContain('4111 1111 1111 1111');
    expect(grouped).toContain('12/28');
  });

  it('leaves ordinary bookkeeping numbers alone', () => {
    const text = 'Invoice #10412 for $12,345.67 dated 06/30/2026, check 1397';
    expect(redactSensitiveText(text)).toBe(text);
  });

  it('is a no-op on digit-free text (fast path)', () => {
    expect(redactSensitiveText('Payee: Sexton Land & Tree')).toBe('Payee: Sexton Land & Tree');
  });
});

describe('maskInputFixed', () => {
  it('returns a fixed-width mask regardless of value length (8.6)', () => {
    expect(maskInputFixed('a')).toBe(maskInputFixed('a-very-long-password-value'));
  });
});

describe('block selector', () => {
  it('covers password inputs, OTP inputs, and tagged secret panels (8.7)', () => {
    expect(BLOCK_SELECTOR).toContain('input[type="password"]');
    expect(BLOCK_SELECTOR).toContain('one-time-code');
    expect(BLOCK_SELECTOR).toContain('[data-share-block]');
  });
});

describe('recorder configuration (Phase 7.5 / 8.1 guard)', () => {
  it('passes tag-keyed maskInputOptions + pattern fns + selectors to rrweb.record', async () => {
    const recordMock = vi.fn(() => () => undefined) as unknown as {
      (...args: unknown[]): unknown;
      takeFullSnapshot?: unknown;
    };
    (recordMock as { takeFullSnapshot?: unknown }).takeFullSnapshot = vi.fn();
    vi.doMock('rrweb', () => ({ record: recordMock }));
    const { startRecorder } = await import('./recorder');
    const handle = await startRecorder({ onBatch: () => undefined, bufferedAmount: () => 0 });
    const cfg = (recordMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0] as Record<string, unknown>;
    // The rrweb 1.1.3 typeless-input gap (caught by the 14.12 E2E): masking
    // must be keyed by TAG (`input: true`), not only by type attribute.
    const maskOpts = cfg['maskInputOptions'] as Record<string, boolean>;
    expect(maskOpts['input']).toBe(true);
    expect(maskOpts['textarea']).toBe(true);
    expect(maskOpts['password']).toBe(true);
    expect(typeof cfg['maskTextFn']).toBe('function');
    expect(typeof cfg['maskInputFn']).toBe('function');
    expect(cfg['blockSelector']).toContain('input[type="password"]');
    expect(cfg['inlineImages']).toBe(false); // 8.12 — images stay URLs
    expect(cfg['recordCanvas']).toBe(false);
    expect(cfg['slimDOMOptions']).toBe('all');
    handle.stop();
    vi.doUnmock('rrweb');
  });
});
