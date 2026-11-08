// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { ApiError, isApiError } from '../../api/client';

/** What the Bank Feed shows when the engine refuses an action. */
export interface FeedActionError {
  message: string;
  /** The server's own wording, when the headline replaces it. */
  detail?: string;
  /** The row's state on the server differs from what the page shows. */
  refresh: boolean;
}

/**
 * Turns an engine refusal on a feed action (approve, assign, exclude,
 * restore, match, categorize) into toast text. Keyed on the error code the
 * engine returns; anything else shows the server's message as is.
 */
export function describeFeedActionError(err: unknown, fallback: string): FeedActionError {
  if (!isApiError(err)) {
    return { message: err instanceof Error && err.message ? err.message : fallback, refresh: false };
  }
  const serverMessage = err.message || fallback;
  if (err.code === 'FEED_ITEM_NOT_PENDING') {
    return {
      message: 'This bank line was already handled (it is no longer waiting). The feed has been refreshed.',
      detail: serverMessage,
      refresh: true,
    };
  }
  if (err.code === 'SPLITS_DONT_BALANCE') {
    return {
      message: 'The split doesn’t add up to the bank amount (or to 100%). Fix the split or the rule, then try again.',
      detail: serverMessage,
      refresh: false,
    };
  }
  // 423: a closed accounting period (TB_PERIOD_LOCKED) or a final financial
  // statement lock (TB_FS_FINAL_LOCKED). Keyed on the status so any lock
  // code reads the same.
  if (err.status === 423) {
    return {
      message: 'This date is in a locked period, so nothing was posted. Reopen the period or ask your accountant.',
      detail: serverMessage,
      refresh: false,
    };
  }
  if (err.code === 'LINE_REQUIRED') {
    return {
      message: 'This entry has more than one bank line with this amount. Pick the line to match.',
      detail: serverMessage,
      refresh: false,
    };
  }
  if (err.code === 'LINE_ALREADY_MATCHED') {
    return {
      message: 'Another bank line is already matched to that entry line. The feed has been refreshed.',
      detail: serverMessage,
      refresh: true,
    };
  }
  if (err.code === 'MATCH_MISMATCH') {
    return {
      message: 'That entry no longer fits this bank line (account or amount differs).',
      detail: serverMessage,
      refresh: true,
    };
  }
  return { message: serverMessage, refresh: false };
}

/** The journal line ids a 400 LINE_REQUIRED offers, if any. */
export function lineRequiredIds(err: unknown): string[] | null {
  if (!isApiError(err) || err.code !== 'LINE_REQUIRED') return null;
  const ids = (err.details as { journalLineIds?: unknown } | undefined)?.journalLineIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

/** Lock codes the engine reports in a bulk `failures[]` entry (a single
 *  request carries them with HTTP 423). */
const LOCK_CODES = new Set(['TB_PERIOD_LOCKED', 'TB_FS_FINAL_LOCKED']);

/** A bulk response's `failures[]` entry as the error a single request
 *  would have thrown, so it reads the same. */
export function bulkFailureError(f: { error: string; code?: string }): ApiError {
  return new ApiError(f.error, f.code, undefined, f.code && LOCK_CODES.has(f.code) ? 423 : undefined);
}
