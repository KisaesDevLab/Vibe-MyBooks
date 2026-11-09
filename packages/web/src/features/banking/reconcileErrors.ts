// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Plain-language messages for the engine's reconciliation error codes
// (kisaes-gl-engine reconcile-exact-v1, reconcile-undo-v2,
// reconcile-hardening-v1, reconcile-qa-v1). Keyed on `ApiError.code` so a
// reworded server message never changes what the user sees; anything not
// listed falls back to the server message, then to `fallback`.

import { isApiError } from '../../api/client';
import { exactAbs, formatExactMoney } from '../../utils/money';

type Details = Record<string, unknown>;

function detailsOf(err: { details?: unknown }): Details {
  return err.details && typeof err.details === 'object' ? (err.details as Details) : {};
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function reconcileErrorMessage(err: unknown, fallback: string): string {
  if (!isApiError(err)) return err instanceof Error && err.message ? err.message : fallback;
  const d = detailsOf(err);
  switch (err.code) {
    case 'RECONCILE_DIFFERENCE_NOT_ZERO': {
      const diff = str(d['difference']);
      return `The difference is ${diff ? formatExactMoney(exactAbs(diff)) : 'not zero'}. `
        + 'Tick or untick transactions (or fix the statement balance) until the difference is exactly $0.00, then finish.';
    }
    case 'RECONCILIATION_IN_PROGRESS':
      return 'This account already has a reconciliation in progress. Resume it or cancel it first.';
    case 'RECONCILIATION_NOT_IN_PROGRESS':
      return d['status'] === 'complete'
        ? 'This reconciliation is already finished, so it can no longer be changed. Reload the page to see it.'
        : 'This reconciliation is no longer in progress. Reload the page to see its current state.';
    case 'RECONCILE_STATEMENT_DATE_ORDER': {
      const latest = str(d['latestStatementDate']);
      return latest
        ? `The statement date must be after ${latest}, the statement date of this account's last finished reconciliation.`
        : "The statement date must be after the statement date of this account's last finished reconciliation.";
    }
    case 'RECONCILE_CHARGE_POSTED':
      return 'The service charge or interest for this reconciliation is already posted. Void that entry before changing it.';
    case 'RECONCILIATION_NOT_LATEST':
      return 'Only the most recent finished reconciliation of an account can be undone. Undo the newer one first.';
    case 'RECONCILIATION_NOT_COMPLETE':
      return 'Only a finished reconciliation can be undone.';
    case 'RECONCILE_ADMIN_REQUIRED':
      return 'Only the company owner can undo a reconciliation.';
    case 'TB_PERIOD_LOCKED': {
      const lockDate = str(d['lockDate']);
      return `The books are closed${lockDate ? ` through ${lockDate}` : ''}, and this falls in the closed period. `
        + 'Move the closing date (or ask the owner to) before trying again.';
    }
    case 'RECONCILED_TRANSACTION': {
      const when = str(d['statementDate']);
      const where = when ? `the reconciliation of ${when}` : 'a finished bank reconciliation';
      const action = d['action'];
      const what = action === 'void'
        ? "it can't be voided"
        : action === 'delete'
          ? "it can't be deleted"
          : d['field'] === 'txnDate'
            ? "its date can't change"
            : "its bank line can't change";
      return `This transaction was cleared in ${where}, so ${what}. `
        + 'Undo that reconciliation first, or record a correcting entry instead.';
    }
    default:
      return err.message || fallback;
  }
}
