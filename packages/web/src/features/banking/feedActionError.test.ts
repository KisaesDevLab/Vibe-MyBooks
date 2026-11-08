// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { ApiError } from '../../api/client';
import { bulkFailureError, describeFeedActionError, lineRequiredIds } from './feedActionError';

describe('describeFeedActionError', () => {
  it('FEED_ITEM_NOT_PENDING asks for a refresh', () => {
    const r = describeFeedActionError(new ApiError('not pending', 'FEED_ITEM_NOT_PENDING', { status: 'matched' }, 409), 'x');
    expect(r.message).toMatch(/already handled/i);
    expect(r.refresh).toBe(true);
  });

  it('SPLITS_DONT_BALANCE keeps the server wording as detail', () => {
    const r = describeFeedActionError(new ApiError('Fixed splits are off by 0.01.', 'SPLITS_DONT_BALANCE', { kind: 'fixed' }, 400), 'x');
    expect(r.message).toMatch(/split doesn.t add up/i);
    expect(r.detail).toBe('Fixed splits are off by 0.01.');
    expect(r.refresh).toBe(false);
  });

  it('any 423 reads as a locked period, whatever the code', () => {
    for (const code of ['TB_PERIOD_LOCKED', 'TB_FS_FINAL_LOCKED', undefined]) {
      expect(describeFeedActionError(new ApiError('locked', code, undefined, 423), 'x').message).toMatch(/locked period/i);
    }
  });

  it('LINE_REQUIRED, LINE_ALREADY_MATCHED and MATCH_MISMATCH have match wording', () => {
    expect(describeFeedActionError(new ApiError('m', 'LINE_REQUIRED', { journalLineIds: ['a'] }, 400), 'x').message).toMatch(/pick the line/i);
    expect(describeFeedActionError(new ApiError('m', 'LINE_ALREADY_MATCHED', {}, 409), 'x').refresh).toBe(true);
    expect(describeFeedActionError(new ApiError('m', 'MATCH_MISMATCH', { field: 'amount' }, 400), 'x').message).toMatch(/no longer fits/i);
  });

  it('falls back to the server message, then to the fallback', () => {
    expect(describeFeedActionError(new ApiError('Server says no', 'OTHER', undefined, 400), 'x').message).toBe('Server says no');
    expect(describeFeedActionError(new Error('plain'), 'x').message).toBe('plain');
    expect(describeFeedActionError('weird', 'Could not do it.').message).toBe('Could not do it.');
  });
});

describe('lineRequiredIds', () => {
  it('reads the offered lines from LINE_REQUIRED only', () => {
    expect(lineRequiredIds(new ApiError('m', 'LINE_REQUIRED', { journalLineIds: ['a', 'b'] }, 400))).toEqual(['a', 'b']);
    expect(lineRequiredIds(new ApiError('m', 'OTHER', undefined, 400))).toBeNull();
  });
});

describe('bulkFailureError', () => {
  it('turns a lock code into a 423 so it reads like a single refusal', () => {
    expect(bulkFailureError({ error: 'closed', code: 'TB_PERIOD_LOCKED' }).status).toBe(423);
    expect(bulkFailureError({ error: 'x', code: 'SPLITS_DONT_BALANCE' }).status).toBeUndefined();
  });
});
