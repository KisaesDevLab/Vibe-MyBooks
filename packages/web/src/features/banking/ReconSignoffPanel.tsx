// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Electronic sign-off on a completed reconciliation (migration 0214): one row
// per role — Preparer, then Reviewer (a different person, firm staff). Signed
// rows show "/s/ Name, date time zone" with Remove for the signer; a stale
// signature (the reconciliation or its transactions changed after signing)
// shows in amber with the sign button back; an in-progress reconciliation
// shows the buttons disabled with a hint. The server re-checks every rule.

import { CheckCircle2, AlertTriangle, PenLine } from 'lucide-react';
import {
  reconSignoffStaleText,
  reconSignoffStamp,
  type ReconSignoffEntry,
  type ReconSignoffRole,
} from '@kis-books/shared';
import { useReconciliationSignoffs, useSignReconciliation, useRemoveReconciliationSignoff } from '../../api/hooks/useBanking';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';

const ROLE_LABEL: Record<ReconSignoffRole, string> = { preparer: 'Preparer', reviewer: 'Reviewer' };

function browserTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
}

export function ReconSignoffPanel({ reconId }: { reconId: string }) {
  const { data, isLoading, isError } = useReconciliationSignoffs(reconId);
  const sign = useSignReconciliation();
  const remove = useRemoveReconciliationSignoff();
  const toast = useToast();
  const tz = browserTimeZone();

  if (isLoading || !data) {
    return isError
      ? <div className="bg-white rounded-lg border p-4 text-sm text-red-700" data-testid="recon-signoff-panel">Couldn&apos;t load the sign-offs.</div>
      : null;
  }
  const { signoffs, viewer } = data;

  const onSign = (role: ReconSignoffRole) => sign.mutate({ id: reconId, role }, {
    onSuccess: () => toast.success(`Signed off as ${role}.`),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not sign off.'),
  });
  const onRemove = (role: ReconSignoffRole) => remove.mutate({ id: reconId, role }, {
    onSuccess: () => toast.success(role === 'preparer' ? 'Preparer sign-off removed (the reviewer must re-sign).' : 'Reviewer sign-off removed.'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not remove the sign-off.'),
  });

  const renderRow = (entry: ReconSignoffEntry) => {
    const role = entry.role;
    const canSign = role === 'preparer' ? viewer.canSignPreparer : viewer.canSignReviewer;
    const blocked = role === 'preparer' ? viewer.preparerBlockedReason : viewer.reviewerBlockedReason;
    const canRemove = role === 'preparer' ? viewer.canRemovePreparer : viewer.canRemoveReviewer;
    return (
      <div key={role} className="flex items-start justify-between gap-3 flex-wrap py-2" data-testid={`recon-signoff-${role}`}>
        <div className="text-sm min-w-0">
          <p className="font-medium text-gray-900">{ROLE_LABEL[role]}</p>
          {entry.state === 'signed' && (
            <p className="text-green-700 inline-flex items-center gap-1" data-testid={`recon-signoff-${role}-stamp`}>
              <CheckCircle2 className="h-4 w-4" /> {reconSignoffStamp(entry, tz)}
            </p>
          )}
          {entry.state === 'stale' && (
            <p className="text-amber-700 inline-flex items-start gap-1" data-testid={`recon-signoff-${role}-stale`}>
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {reconSignoffStaleText(entry, tz)}
            </p>
          )}
          {entry.state === 'unsigned' && <p className="text-gray-500">Not signed</p>}
          {entry.state !== 'signed' && !canSign && blocked && (
            <p className="text-xs text-gray-500 mt-0.5" data-testid={`recon-signoff-${role}-hint`}>{blocked}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {entry.state === 'signed' ? (
            canRemove && (
              <Button variant="ghost" size="sm" onClick={() => onRemove(role)} loading={remove.isPending}>
                Remove my sign-off
              </Button>
            )
          ) : (
            <Button
              size="sm"
              variant={entry.state === 'stale' ? 'primary' : 'secondary'}
              onClick={() => onSign(role)}
              disabled={!canSign}
              title={!canSign && blocked ? blocked : undefined}
              loading={sign.isPending && sign.variables?.role === role}
            >
              <PenLine className="h-4 w-4 mr-1" />
              {entry.state === 'stale' ? `Re-sign as ${role}` : `Sign as ${role}`}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-lg border p-4" data-testid="recon-signoff-panel">
      <h2 className="text-base font-semibold text-gray-900">Sign-off</h2>
      <p className="text-xs text-gray-500 mb-1">
        The preparer signs first; the reviewer must be a different person on the firm&apos;s staff.
        A sign-off goes stale if the reconciliation or its transactions change afterward.
      </p>
      {!signoffs.signable && (
        <p className="text-xs text-amber-700" data-testid="recon-signoff-not-complete">
          Complete the reconciliation to sign it off.
        </p>
      )}
      <div className="divide-y divide-gray-100">
        {renderRow(signoffs.preparer)}
        {renderRow(signoffs.reviewer)}
      </div>
    </section>
  );
}
