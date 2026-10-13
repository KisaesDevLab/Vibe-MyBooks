// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Q50: share one person-target account between the owners linked to the business —
// by % (rows total exactly 100) or by fixed annual $ per tax year (the books' difference goes
// to the LAST owner, warned). Only linked owners are offered (OwnerCandidateDto).
import type { OwnerCandidateDto, SplitMode } from '@kis-books/shared';
import { dAdd, dIsPos, dSum, pctTotal, pctTotalIs100 } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { formatMoney } from '../../../utils/money';
import { LINK_OWNER_HELP, linkedTaxpayers, ownerLabel } from './PaymentTargetPicker';
import { SELECT_CLASS } from './labels';
import { NumericInput } from '../../../components/forms/NumericInput';

export interface SplitDraftRow {
  taxpayerId: string | null;
  personId: string | null;
  pct: string;
  amount: string;
  taxYear: number | null;
}

const PCT_RE = /^\d{1,3}(\.\d{1,6})?$/;
const MONEY_RE = /^\d{1,15}(\.\d{1,4})?$/;

/** Rows the editor shows: every % row; in $ mode the rows of `taxYear` (other years are kept). */
export const visibleRows = (mode: SplitMode, rows: SplitDraftRow[], taxYear: number) =>
  mode === 'pct' ? rows : rows.filter((r) => r.taxYear === taxYear);

/** Why the split cannot be saved, or null. */
export function splitProblem(mode: SplitMode, rows: SplitDraftRow[], isPayment: boolean, taxYear: number): string | null {
  const shown = visibleRows(mode, rows, taxYear);
  if (shown.length === 0) return mode === 'pct' ? 'Add at least one owner' : `Add the ${taxYear} fixed amounts`;
  if (shown.some((r) => (isPayment ? !r.taxpayerId : !r.personId))) return isPayment ? 'Pick the taxpayer on every row' : 'Pick the owner on every row';
  const keys = shown.map((r) => (isPayment ? `${r.taxpayerId}|${r.personId ?? ''}` : r.personId));
  if (new Set(keys).size !== keys.length) return 'Each owner may appear once';
  if (mode === 'pct') {
    if (shown.some((r) => !PCT_RE.test(r.pct) || !dIsPos(r.pct))) return 'Each % must be above 0 (up to 6 decimals)';
    if (!pctTotalIs100(shown.map((r) => r.pct))) return `The percentages total ${pctTotal(shown.map((r) => r.pct))}%; they must total exactly 100%`;
    return null;
  }
  if (shown.some((r) => !MONEY_RE.test(r.amount))) return 'Enter each fixed annual amount';
  if (!dIsPos(dSum(shown.map((r) => r.amount)))) return 'The fixed amounts total zero';
  return null;
}

/** Default % rows from the owners' profit % on the business links (Q50: normalized to 100). */
export function defaultSplitRows(candidates: ReadonlyArray<OwnerCandidateDto>, isPayment: boolean): SplitDraftRow[] {
  const withPct = candidates.filter((c) => c.defaultPct !== null && dIsPos(c.defaultPct));
  if (!isPayment) return withPct.map((c) => ({ taxpayerId: c.taxpayerId, personId: c.personId, pct: c.defaultPct!, amount: '', taxYear: null }));
  // Payments are credited per taxpayer: a couple's two linked persons add up to one row.
  const byTp = new Map<string, string>();
  for (const c of withPct) byTp.set(c.taxpayerId, dAdd(byTp.get(c.taxpayerId) ?? '0', c.defaultPct!));
  return [...byTp.entries()].map(([taxpayerId, pct]) => ({ taxpayerId, personId: null, pct, amount: '', taxYear: null }));
}

export function OwnerSplitEditor({ mode, rows, isPayment, taxYear, candidates, disabled, accountName, onChange }: {
  mode: SplitMode; rows: SplitDraftRow[]; isPayment: boolean; taxYear: number; candidates: ReadonlyArray<OwnerCandidateDto>;
  disabled: boolean; accountName: string; onChange: (mode: SplitMode, rows: SplitDraftRow[]) => void;
}) {
  const shown = visibleRows(mode, rows, taxYear);
  const otherYears = rows.length - shown.length;
  const taxpayers = linkedTaxpayers(candidates);
  const problem = splitProblem(mode, rows, isPayment, taxYear);
  const replaceShown = (next: SplitDraftRow[]) =>
    onChange(mode, mode === 'pct' ? next : [...rows.filter((r) => r.taxYear !== taxYear), ...next]);
  const patchRow = (i: number, p: Partial<SplitDraftRow>) => replaceShown(shown.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const switchMode = (m: SplitMode) => {
    if (m === mode) return;
    const targets = shown.map((r) => ({ taxpayerId: r.taxpayerId, personId: r.personId }));
    onChange(m, targets.map((t) => ({ ...t, pct: '', amount: '', taxYear: m === 'amount' ? taxYear : null })));
  };
  const total = mode === 'pct' ? pctTotal(shown.map((r) => r.pct || '0')) : dSum(shown.map((r) => (MONEY_RE.test(r.amount) ? r.amount : '0')));
  const lastName = (() => {
    const last = shown[shown.length - 1];
    const c = last && candidates.find((x) => (isPayment ? x.taxpayerId === last.taxpayerId : x.personId === last.personId));
    return c ? (isPayment ? c.taxpayerName : `${c.firstName} ${c.lastName}`.trim()) : 'the last owner';
  })();

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2" data-testid="owner-split" aria-label={`Owner split for ${accountName}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-gray-700">Split by</span>
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden" role="group" aria-label="Split mode">
          {(['pct', 'amount'] as const).map((m) => (
            <button key={m} type="button" disabled={disabled} aria-pressed={mode === m} onClick={() => switchMode(m)}
              className={`px-2 py-1 ${mode === m ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'} disabled:opacity-60`}>
              {m === 'pct' ? '%' : `$ (${taxYear})`}
            </button>
          ))}
        </div>
        {mode === 'pct' && (
          <Button size="sm" variant="ghost" disabled={disabled || candidates.length === 0}
            onClick={() => onChange('pct', defaultSplitRows(candidates, isPayment))}>
            Default from ownership
          </Button>
        )}
      </div>
      {candidates.length === 0 && <p className="text-xs text-amber-700" role="note">{LINK_OWNER_HELP}</p>}
      {shown.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2" data-testid="split-row">
          {isPayment ? (
            <>
              <select aria-label={`Split taxpayer ${i + 1}`} className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={r.taxpayerId ?? ''}
                onChange={(e) => patchRow(i, { taxpayerId: e.target.value || null, personId: null })}>
                <option value="">Taxpayer...</option>
                {r.taxpayerId && !taxpayers.some((t) => t.id === r.taxpayerId) && <option value={r.taxpayerId}>Not linked to this business</option>}
                {taxpayers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select aria-label={`Split person ${i + 1}`} className={`${SELECT_CLASS} !w-auto`} disabled={disabled || !r.taxpayerId} value={r.personId ?? ''}
                onChange={(e) => patchRow(i, { personId: e.target.value || null })}>
                <option value="">Person (optional)...</option>
                {candidates.filter((c) => c.taxpayerId === r.taxpayerId).map((c) => <option key={c.personId} value={c.personId}>{c.firstName} {c.lastName}</option>)}
              </select>
            </>
          ) : (
            <select aria-label={`Split owner ${i + 1}`} className={`${SELECT_CLASS} !w-auto`} disabled={disabled} value={r.personId ?? ''}
              onChange={(e) => {
                const c = candidates.find((x) => x.personId === e.target.value);
                patchRow(i, { personId: c?.personId ?? null, taxpayerId: c?.taxpayerId ?? null });
              }}>
              <option value="">Owner...</option>
              {r.personId && !candidates.some((c) => c.personId === r.personId) && <option value={r.personId}>Not linked to this business</option>}
              {candidates.map((c) => <option key={c.personId} value={c.personId}>{ownerLabel(c)}</option>)}
            </select>
          )}
          {mode === 'pct' ? (
            <span className="inline-flex items-center gap-1">
              <NumericInput aria-label={`Split % ${i + 1}`} disabled={disabled} value={r.pct}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50" onChange={(v) => patchRow(i, { pct: v })} />
              <span className="text-xs text-gray-500">%</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs text-gray-500">$</span>
              <NumericInput aria-label={`Fixed annual amount ${i + 1}`} disabled={disabled} value={r.amount}
                className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50" onChange={(v) => patchRow(i, { amount: v })} />
            </span>
          )}
          <Button size="sm" variant="ghost" disabled={disabled} aria-label={`Remove split row ${i + 1}`}
            onClick={() => replaceShown(shown.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Button size="sm" variant="ghost" disabled={disabled}
          onClick={() => replaceShown([...shown, { taxpayerId: null, personId: null, pct: '', amount: '', taxYear: mode === 'amount' ? taxYear : null }])}>
          Add owner
        </Button>
        <span data-testid="split-total" className={problem ? 'text-red-600' : 'text-gray-700'}>
          {mode === 'pct' ? `Total ${total}%` : `Fixed total ${formatMoney(total)} for ${taxYear}`}
        </span>
        {otherYears > 0 && <span className="text-gray-500">{otherYears} row(s) for other years kept</span>}
      </div>
      {mode === 'amount' && (
        <p className="text-xs text-gray-600">
          Each owner gets the fixed annual amount; the difference between the books&apos; total and the fixed total goes to {lastName} (the last row).
          Until the year is complete the books amount is shared in proportion to the fixed amounts.
        </p>
      )}
      {problem && shown.length > 0 && <p className="text-xs text-red-600" role="alert">{problem}</p>}
    </div>
  );
}
