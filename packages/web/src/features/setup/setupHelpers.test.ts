// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  scorePassword,
  friendlyErrorMessage,
  coaPreviewForBusinessType,
  saveSetupProgress,
  loadSetupProgress,
  clearSetupProgress,
  type PersistedSetupProgress,
} from './setupHelpers';

describe('scorePassword', () => {
  it('returns level 0 with no label for empty input', () => {
    const s = scorePassword('');
    expect(s.level).toBe(0);
    expect(s.label).toBe('');
  });

  it('flags passwords shorter than 12 as too short', () => {
    const s = scorePassword('short123');
    expect(s.level).toBe(1);
    expect(s.label).toBe('Too short');
    expect(s.hints.some((h) => h.toLowerCase().includes('12 characters'))).toBe(true);
  });

  it('rates a 12-char single-class password as weak', () => {
    const s = scorePassword('aaaaaaaaaaaa');
    expect(s.level).toBe(1);
    expect(s.label).toBe('Weak');
  });

  it('rates a two-class 12-char password as fair', () => {
    const s = scorePassword('aaaaaaaaaaA1');
    // Has lower + upper + digit = 3 classes → Good. Drop one to test Fair.
    const fair = scorePassword('aaaaaaaaaaaa1');
    expect(fair.level).toBe(2);
    expect(fair.label).toBe('Fair');
    expect(s.level).toBe(3); // sanity on the 3-class boundary
  });

  it('rates a mixed 12-char password with all four classes as good (needs 16 for strong)', () => {
    const s = scorePassword('Abc1!def2@ghi');
    expect(s.level).toBe(3);
    expect(s.label).toBe('Good');
  });

  it('rates a 16+ char 4-class password as strong', () => {
    const s = scorePassword('Abcdefgh1234!@#$');
    expect(s.level).toBe(4);
    expect(s.label).toBe('Strong');
    expect(s.hints.length).toBe(0);
  });

  it('hints at the missing character class', () => {
    const noSymbol = scorePassword('Abcdefghijk123');
    expect(noSymbol.hints.some((h) => h.toLowerCase().includes('symbol'))).toBe(true);
  });
});

describe('friendlyErrorMessage', () => {
  it('returns a generic message for empty input', () => {
    expect(friendlyErrorMessage('')).toMatch(/connection failed/i);
  });

  it('translates ECONNREFUSED to plain English', () => {
    expect(friendlyErrorMessage('connect ECONNREFUSED 127.0.0.1:5432')).toMatch(/reach the database/i);
  });

  it('translates password auth failures', () => {
    expect(friendlyErrorMessage('password authentication failed for user "kisbooks"'))
      .toMatch(/password is wrong/i);
  });

  it('translates ENOTFOUND', () => {
    expect(friendlyErrorMessage('getaddrinfo ENOTFOUND db'))
      .toMatch(/couldn.t find/i);
  });

  it('translates SMTP auth failures', () => {
    const msg = friendlyErrorMessage('535 5.7.8 Invalid login: Authentication failed');
    expect(msg).toMatch(/email username or password is wrong/i);
  });

  it('translates SMTP TLS certificate failures', () => {
    expect(friendlyErrorMessage('Error: self signed certificate'))
      .toMatch(/tls certificate/i);
  });

  it('translates finalize port-in-use errors', () => {
    expect(friendlyErrorMessage('Port 5432 is already in use'))
      .toMatch(/port we need is already in use/i);
  });

  it('translates disk-full errors', () => {
    expect(friendlyErrorMessage('ENOSPC: no space left on device'))
      .toMatch(/disk is full/i);
  });

  it('preserves the raw message when no pattern matches', () => {
    expect(friendlyErrorMessage('something obscure')).toContain('something obscure');
  });
});

describe('coaPreviewForBusinessType', () => {
  it('returns null for an unknown slug', () => {
    expect(coaPreviewForBusinessType('not-a-real-slug')).toBeNull();
  });

  it('returns a preview for general_business with user-facing accounts', () => {
    const p = coaPreviewForBusinessType('general_business');
    expect(p).not.toBeNull();
    expect(p!.total).toBeGreaterThan(0);
    expect(p!.sample.length).toBeGreaterThan(0);
    expect(p!.sample.length).toBeLessThanOrEqual(8);
    // The sample should not contain internal system accounts like
    // "Retained Earnings" or "Opening Balances" — those confuse users.
    expect(p!.sample).not.toContain('Retained Earnings');
    expect(p!.sample).not.toContain('Opening Balances');
  });

  it('groups accounts into display categories', () => {
    const p = coaPreviewForBusinessType('general_business');
    expect(p!.byCategory).toBeTypeOf('object');
    // general_business has revenue, expenses, and assets at minimum.
    expect(Object.keys(p!.byCategory).length).toBeGreaterThan(2);
  });
});

describe('setup progress persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadSetupProgress()).toBeNull();
  });

  it('round-trips non-secret form state', () => {
    const payload: PersistedSetupProgress = {
      step: 2,
      adminEmail: 'alice@example.com',
      adminDisplayName: 'Alice',
      businessName: 'Acme Co',
      entityType: 'single_member_llc',
      businessType: 'general_business',
      skipEmail: false,
      createDemoCompany: false,
    };
    saveSetupProgress(payload);
    expect(loadSetupProgress()).toEqual(payload);
  });

  it('clearSetupProgress removes the stored value', () => {
    saveSetupProgress({ step: 1, adminEmail: 'x@y.z' });
    clearSetupProgress();
    expect(loadSetupProgress()).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('kisbooks-setup-progress-v1', '{not-json');
    expect(loadSetupProgress()).toBeNull();
  });

  it('tolerates localStorage throwing (quota / private mode)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    try {
      // Should not throw.
      expect(() => saveSetupProgress({ step: 0 })).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
