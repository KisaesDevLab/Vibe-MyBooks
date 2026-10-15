// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Screen rendering of the professional bank reconciliation (ReconProof):
// Section A (statement to books), the cleared-activity roll, supporting
// schedules with aged-item flags, subsequent activity, the book-side proof
// (reconciliation discrepancies, with drill-down links) and the sign-off.
// Shared by the Reconciliation Detail / Summary reports and the Reconcile
// screen. Line order and labels come from the shared layout helpers so the
// screen matches the PDF / CSV exports.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  reconBookProofLines,
  reconClearedRollLines,
  reconDiscrepancyComponentLines,
  reconDiscrepancyReasonLabel,
  reconMoney,
  reconSubsequentLines,
  reconSummaryLines,
  formatReconSignoffTime,
  reconSignoffBadge,
  reconSignoffShortText,
  reconSignoffStaleText,
  reconSignoffStatusText,
  RECON_SIGNOFF_BADGE_LABEL,
  type ReconProof,
  type ReconSignoffBadge,
  type ReconSignoffEntry,
  type ReconSignoffSummary,
  type ReconSchedule,
  type ReconScheduleItem,
  type ReconStatementLine,
} from '@kis-books/shared';

export function ReconStatementTable({ lines, testId }: { lines: ReconStatementLine[]; testId?: string }) {
  return (
    <table className="w-full max-w-2xl text-sm" data-testid={testId}>
      <tbody>
        {lines.map((l) => {
          const indent = l.kind === 'line' && /^(Add|Less)/.test(l.label);
          const rule = l.kind === 'subtotal'
            ? 'border-t border-gray-800 font-semibold'
            : l.kind === 'result' ? 'border-t border-gray-800 border-b-4 border-double font-bold' : '';
          return (
            <tr key={l.key} className={rule} data-line={l.key}>
              <td className={`py-1 pr-4 ${indent ? 'pl-6' : 'pl-1'}`}>{l.label}</td>
              <td className="py-1 pr-1 text-right font-mono whitespace-nowrap">{reconMoney(l.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ReconFlagBadge({ item }: { item: Pick<ReconScheduleItem, 'flag' | 'flagLabel'> }) {
  if (!item.flag || !item.flagLabel) return null;
  const cls = item.flag === 'stale_dated'
    ? 'bg-red-100 text-red-800'
    : item.flag === 'stale' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';
  return (
    <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${cls}`} data-testid="recon-flag">
      {item.flagLabel}
    </span>
  );
}

function Heading({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="text-lg font-semibold text-gray-900 mb-2">{children}</h2>;
}

/** Section A — statement to books, with the reconciled / not-reconciled verdict. */
export function ReconSummarySection({ proof }: { proof: ReconProof }) {
  const s = proof.summary;
  return (
    <section className="bg-white rounded-lg border p-4" data-testid="recon-summary">
      <Heading>Reconciliation summary — statement to books</Heading>
      {proof.orientation === 'liability' && (
        <p className="text-xs text-gray-500 mb-2">Credit card / liability account: balances are shown as amounts owed.</p>
      )}
      <ReconStatementTable lines={reconSummaryLines(proof)} testId="recon-summary-lines" />
      {s.reconciledToBooks ? (
        <p className="mt-3 text-sm font-semibold text-green-700" data-testid="recon-verdict">
          Reconciled to books — the adjusted statement balance equals the adjusted book balance.
        </p>
      ) : (
        <div className="mt-3 text-sm text-red-700" data-testid="recon-verdict">
          <p className="font-semibold">Not reconciled to books — unreconciled difference {reconMoney(s.unreconciledDifference)}.</p>
          {s.explanations.length > 0 && (
            <ul className="list-disc ml-5 mt-1">{s.explanations.map((e) => <li key={e}>{e}</li>)}</ul>
          )}
        </div>
      )}
      {!s.unrecorded && s.unrecordedNote && (
        <p className="mt-2 text-xs text-gray-500">Unrecorded bank items: {s.unrecordedNote}</p>
      )}
    </section>
  );
}

export function ReconClearedRollSection({ proof }: { proof: ReconProof }) {
  return (
    <section className="bg-white rounded-lg border p-4">
      <Heading>Cleared activity</Heading>
      <ReconStatementTable lines={reconClearedRollLines(proof)} testId="recon-cleared-roll" />
    </section>
  );
}

function ScheduleTable({ schedule, mode, topItems }: { schedule: ReconSchedule; mode: 'detail' | 'summary'; topItems: number }) {
  if (schedule.count === 0) return <p className="text-sm text-gray-500">None.</p>;
  const items = mode === 'detail' ? schedule.items : schedule.items.slice(0, topItems);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-gray-200">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Number</th>
            <th className="px-3 py-2 text-left">Payee / Description</th>
            <th className="px-3 py-2 text-right">Age (days)</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((i) => (
            <tr key={i.journalLineId}>
              <td className="px-3 py-1.5 whitespace-nowrap">
                <Link to={`/transactions/${i.transactionId}`} className="text-primary-600 hover:underline">{i.txnDate}</Link>
              </td>
              <td className="px-3 py-1.5">{i.txnType.replace(/_/g, ' ')}</td>
              <td className="px-3 py-1.5">{i.number ?? ''}</td>
              <td className="px-3 py-1.5">
                {[i.payee, i.description].filter(Boolean).join(' — ') || '—'}
                <ReconFlagBadge item={i} />
              </td>
              <td className="px-3 py-1.5 text-right">{i.ageDays}</td>
              <td className="px-3 py-1.5 text-right font-mono">{reconMoney(i.amount)}</td>
            </tr>
          ))}
          {mode === 'summary' && schedule.items.length > items.length && (
            <tr><td colSpan={6} className="px-3 py-1.5 text-xs text-gray-500">… {schedule.items.length - items.length} more (oldest shown) — see the Reconciliation Detail report.</td></tr>
          )}
          <tr className="font-semibold border-t-2 border-gray-800">
            <td colSpan={5} className="px-3 py-1.5">Total {schedule.label.toLowerCase()} ({schedule.count})</td>
            <td className="px-3 py-1.5 text-right font-mono">{reconMoney(schedule.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Section B — deposits in transit / outstanding checks (or card equivalents), unrecorded bank items. */
export function ReconSchedulesSection({ proof, mode, topItems = 5 }: { proof: ReconProof; mode: 'detail' | 'summary'; topItems?: number }) {
  const fc = proof.flagCounts;
  const aged = [
    fc.staleDated ? `${fc.staleDated} stale-dated (over 180 days)` : '',
    fc.stale ? `${fc.stale} stale (over 90 days)` : '',
    fc.investigate ? `${fc.investigate} to investigate` : '',
  ].filter(Boolean);
  return (
    <section className="bg-white rounded-lg border p-4 space-y-4" data-testid="recon-schedules">
      <Heading>Supporting schedules</Heading>
      {aged.length > 0 && <p className="text-sm font-medium text-amber-700">Aged items: {aged.join(' · ')}</p>}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">{proof.schedules.increases.label} ({proof.schedules.increases.count})</h3>
        <ScheduleTable schedule={proof.schedules.increases} mode={mode} topItems={topItems} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">{proof.schedules.decreases.label} ({proof.schedules.decreases.count})</h3>
        <ScheduleTable schedule={proof.schedules.decreases} mode={mode} topItems={topItems} />
      </div>
      {proof.summary.unrecorded && proof.schedules.unrecorded.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">{proof.labels.unrecorded} ({proof.schedules.unrecorded.length})</h3>
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Check #</th><th className="px-3 py-2 text-left">Statement description</th><th className="px-3 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {proof.schedules.unrecorded.map((u) => (
                <tr key={u.statementLineId}>
                  <td className="px-3 py-1.5">{u.lineDate}</td>
                  <td className="px-3 py-1.5">{u.checkNumber ?? ''}</td>
                  <td className="px-3 py-1.5">{u.description ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{reconMoney(u.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Section C — subsequent activity, today's register balance. */
export function ReconSubsequentSection({ proof }: { proof: ReconProof }) {
  return (
    <section className="bg-white rounded-lg border p-4">
      <Heading>Subsequent activity — register balance</Heading>
      <ReconStatementTable lines={reconSubsequentLines(proof)} testId="recon-subsequent" />
    </section>
  );
}

/** Section D — book-side proof and the reconciliation discrepancies drill-down. */
export function ReconBookProofSection({ proof }: { proof: ReconProof }) {
  const b = proof.bookProof;
  const comps = reconDiscrepancyComponentLines(proof);
  return (
    <section id="reconciliation-discrepancies" className="bg-white rounded-lg border p-4 space-y-3" data-testid="recon-book-proof">
      <Heading>Book-side proof — reconciliation discrepancies</Heading>
      <ReconStatementTable lines={reconBookProofLines(proof)} />
      {b.ties ? (
        <p className="text-sm font-semibold text-green-700">The books tie to the reconciled and outstanding items — no discrepancies.</p>
      ) : (
        <div className="text-sm text-red-700 space-y-2">
          <p className="font-semibold">Discrepancy of {reconMoney(b.discrepancy)} between the books and the reconciled activity.</p>
          {comps.length > 0 && <ReconStatementTable lines={comps} />}
          {b.explanations.length > 0 && <ul className="list-disc ml-5">{b.explanations.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      )}
      {b.priorChanges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Changes since prior reconciliations</h3>
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2 text-left">Reconciliation</th><th className="px-3 py-2 text-right">Cleared at completion</th><th className="px-3 py-2 text-right">Cleared now</th><th className="px-3 py-2 text-right">Change</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {b.priorChanges.map((c) => (
                <tr key={c.reconciliationId}>
                  <td className="px-3 py-1.5">
                    <Link to={`/reports/reconciliation-detail?reconciliation_id=${c.reconciliationId}`} className="text-primary-600 hover:underline">{c.statementDate}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{reconMoney(c.clearedAtCompletion)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{reconMoney(c.clearedNow)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{reconMoney(c.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {b.items.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Reconciled items changed since they were reconciled ({b.items.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Reconciled</th><th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Number</th><th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">What changed</th><th className="px-3 py-2 text-right">Current amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {b.items.map((i) => (
                  <tr key={`${i.reconciliationId}-${i.journalLineId}`} data-testid="recon-discrepancy-item">
                    <td className="px-3 py-1.5">{i.thisReconciliation ? 'This reconciliation' : i.reconciliationDate}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {i.transactionId
                        ? <Link to={`/transactions/${i.transactionId}`} className="text-primary-600 hover:underline">{i.txnDate}</Link>
                        : '—'}
                    </td>
                    <td className="px-3 py-1.5">{i.number ?? ''}</td>
                    <td className="px-3 py-1.5">{i.description ?? (i.transactionId ? '' : 'Transaction no longer exists')}</td>
                    <td className="px-3 py-1.5">
                      {i.reasons.map(reconDiscrepancyReasonLabel).join('; ')}
                      {i.editedAt ? ` (${i.editedAt.slice(0, 10)})` : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{i.currentAmount === null ? '—' : reconMoney(i.currentAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function browserTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
}

/** Section E — sign-off block, from the stored electronic sign-offs. */
export function ReconSignOffSection({ proof }: { proof: ReconProof }) {
  const so = proof.signOff;
  const tz = browserTimeZone();
  const Line = ({ value, caption, tone }: { value: ReactNode; caption: string; tone?: 'stale' | 'muted' }) => (
    <div>
      <div className={`border-b border-gray-800 min-h-[1.5rem] px-1 text-sm ${tone === 'stale' ? 'text-amber-700 font-medium' : tone === 'muted' ? 'text-gray-400' : ''}`}>{value}</div>
      <div className="text-xs text-gray-500">{caption}</div>
    </div>
  );
  const sig = (e: ReconSignoffEntry) => (e.state === 'signed' ? `/s/ ${e.signerName ?? ''}` : reconSignoffShortText(e, tz));
  const tone = (e: ReconSignoffEntry) => (e.state === 'stale' ? 'stale' as const : e.state === 'unsigned' ? 'muted' as const : undefined);
  const p = so.signoffs.preparer;
  const r = so.signoffs.reviewer;
  return (
    <section className="bg-white rounded-lg border p-4" data-testid="recon-signoff">
      <Heading>Sign-off</Heading>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-2xl">
        <Line value={sig(p)} caption="Prepared by" tone={tone(p)} />
        <Line value={p.state === 'signed' ? formatReconSignoffTime(p.signedAt, tz) : ''} caption="Date" />
        <Line value={sig(r)} caption="Reviewed by" tone={tone(r)} />
        <Line value={r.state === 'signed' ? formatReconSignoffTime(r.signedAt, tz) : ''} caption="Date" />
      </div>
      {[p, r].filter((e) => e.state === 'stale').map((e) => (
        <p key={e.role} className="mt-2 text-sm text-amber-700" data-testid={`recon-signoff-section-stale-${e.role}`}>
          {e.role === 'preparer' ? 'Preparer' : 'Reviewer'}: {reconSignoffStaleText(e, tz)}.
        </p>
      ))}
      {(so.completedBy || so.completedAt) && (
        <p className="mt-2 text-xs text-gray-500">
          Completed in the books{so.completedBy ? ` by ${so.completedBy}` : ''}{so.completedAt ? ` on ${so.completedAt.slice(0, 10)}` : ''}.
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500">
        {so.statementPeriod
          ? `Bank statement: ${so.statementPeriod}${so.statementFileName ? ` — ${so.statementFileName}` : ' — no file attached'}`
          : 'Bank statement: none linked to this reconciliation.'}
      </p>
    </section>
  );
}

const BADGE_STYLE: Record<ReconSignoffBadge, string> = {
  reviewed: 'bg-green-100 text-green-700',
  prepared: 'bg-blue-100 text-blue-700',
  stale: 'bg-amber-100 text-amber-800',
  unsigned: 'bg-gray-100 text-gray-500',
};

/** Sign-off status pill (reconciliation history list). */
export function ReconSignoffStatusBadge({ signoffs }: { signoffs: ReconSignoffSummary }) {
  const b = reconSignoffBadge(signoffs);
  const tz = browserTimeZone();
  const title = [signoffs.preparer, signoffs.reviewer]
    .map((e) => `${e.role === 'preparer' ? 'Preparer' : 'Reviewer'}: ${reconSignoffStatusText(e, tz)}`).join('\n');
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE_STYLE[b]}`} title={title} data-testid="recon-signoff-badge">
      {RECON_SIGNOFF_BADGE_LABEL[b]}
    </span>
  );
}
