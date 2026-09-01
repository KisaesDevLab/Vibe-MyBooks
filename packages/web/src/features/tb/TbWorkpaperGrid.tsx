// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Presentational five-column TB grid shared by the workpaper screen
// and the read-only popout (6B). Signed nets arrive from the engine;
// this component renders DR/CR pairs or the netted "single" mode, the
// optional PY comparative and tax columns, per-unit expansion, the
// by-tag segmented view, and the diff-flash highlight used by the
// popout.

import { Fragment } from 'react';
import clsx from 'clsx';
import {
  MARK_TONES, TB_ZERO_UNIT, unitAccountNumber, usd,
  type TbUnitSplit, type TbWorkpaperRow, type TbWorkpaper,
} from './workpaperShared';

// activityView sentinel: one row per account × tag-resolved unit.
export const TB_VIEW_BY_TAG = 'tags';

export interface TbGridPrefs {
  drCrMode: boolean;   // false = netted single column per group
  showPy: boolean;
  showTax: boolean;    // tax rje + tax columns
  nonZeroOnly: boolean;
  activityView: string; // '' = consolidated, TB_VIEW_BY_TAG, else unitId
}

export type TbGridColumn = 'unadjusted' | 'aje' | 'adjusted' | 'taxRje' | 'tax';

export interface TbCellMark { id: string; symbol: string; description: string; color: string | null }

export interface TbGridProps {
  workpaper: TbWorkpaper;
  // Prior-year workpaper rows (same basis); sliced per view like the
  // current-year rows so the comparative lines up in every mode.
  pyRows?: TbWorkpaperRow[];
  prefs: TbGridPrefs;
  search: string;
  typeFilter: string;
  flashIds?: Set<string>;
  unitNames?: Map<string, string>;
  // Activity-unit instance numbers + the tax profile's placement, for
  // the by-tag view's account numbers (1000-2 / 2-1000; no tag → 0).
  unitNumbers?: Map<string, number>;
  unitNumberPlacement?: 'suffix' | 'prefix';
  // Render extra cells at the end of each row (tax code picker, marks…).
  renderRowExtra?: (row: TbWorkpaperRow) => React.ReactNode;
  extraHeaders?: React.ReactNode;
  onAmountClick?: (row: TbWorkpaperRow, column: TbGridColumn) => void;
  // Which amount columns fire onAmountClick (default: the drill-down
  // pair). The popout adds adjusted/tax for the tickmark popup.
  clickableColumns?: ReadonlyArray<TbGridColumn>;
  // Applied tickmarks per cell — chips render beside the amount.
  cellMarks?: (accountId: string, column: TbGridColumn) => TbCellMark[] | undefined;
}

function MarkChips({ marks }: { marks?: TbCellMark[] }) {
  if (!marks || marks.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-0.5 align-middle">
      {marks.map((m) => (
        <span key={m.id} title={m.description}
          className={clsx('inline-flex items-center justify-center h-4 min-w-4 px-0.5 rounded text-[10px] font-semibold', MARK_TONES[m.color ?? 'gray'] ?? MARK_TONES['gray'])}>
          {m.symbol}
        </span>
      ))}
    </span>
  );
}

const TYPE_ABBREV: Record<string, { label: string; tone: string }> = {
  asset: { label: 'Ass', tone: 'text-blue-600' },
  liability: { label: 'Lia', tone: 'text-orange-600' },
  equity: { label: 'Equ', tone: 'text-purple-600' },
  revenue: { label: 'Rev', tone: 'text-green-700' },
  cogs: { label: 'COGS', tone: 'text-amber-700' },
  expense: { label: 'Exp', tone: 'text-red-600' },
  other_revenue: { label: 'OInc', tone: 'text-green-600' },
  other_expense: { label: 'OExp', tone: 'text-red-500' },
};

function AmountPair({ value, onClick, flash, marks }: { value: number; onClick?: () => void; flash?: boolean; marks?: TbCellMark[] }) {
  const dr = value > 0 ? value : 0;
  const cr = value < 0 ? -value : 0;
  // Chips ride the populated side of the pair.
  const cell = (v: number, side: 'dr' | 'cr', withMarks: boolean) => (
    <td key={side} className={clsx('px-2 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap', flash && 'tb-flash')}>
      {onClick && v !== 0 ? (
        <button className="underline decoration-dotted hover:text-blue-700" onClick={onClick}>{usd(v)}</button>
      ) : usd(v)}
      {withMarks && <MarkChips marks={marks} />}
    </td>
  );
  return <>{cell(dr, 'dr', dr !== 0)}{cell(cr, 'cr', dr === 0)}</>;
}

function AmountSingle({ value, onClick, flash, marks }: { value: number; onClick?: () => void; flash?: boolean; marks?: TbCellMark[] }) {
  const negative = value < -0.004;
  const text = Math.abs(value) < 0.005 ? '—' : negative ? `(${usd(-value)})` : usd(value);
  return (
    <td className={clsx('px-2 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap', negative && 'text-red-700', flash && 'tb-flash')}>
      {onClick && Math.abs(value) >= 0.005 ? (
        <button className="underline decoration-dotted hover:text-blue-700" onClick={onClick}>{text}</button>
      ) : text}
      <MarkChips marks={marks} />
    </td>
  );
}

type Amounts = Pick<TbWorkpaperRow, 'unadjusted' | 'aje' | 'adjusted' | 'taxRje' | 'tax'>;

// One rendered line. In the by-tag view an account fans out into one
// line per segment; `primary` marks the first so per-account extras
// (LS ref, tickmarks) render once.
interface DisplayRow {
  key: string;
  row: TbWorkpaperRow;
  amounts: Amounts;
  accountNumber: string;
  segmentLabel: string | null;
  primary: boolean;
  py: number;
}

const ZERO_AMOUNTS: Amounts = { unadjusted: 0, aje: 0, adjusted: 0, taxRje: 0, tax: 0 };
const pick = (s: TbUnitSplit | Amounts | undefined): Amounts =>
  s ? { unadjusted: s.unadjusted, aje: s.aje, adjusted: s.adjusted, taxRje: s.taxRje, tax: s.tax } : ZERO_AMOUNTS;

export function TbWorkpaperGrid({
  workpaper, pyRows, prefs, search, typeFilter, flashIds, unitNames,
  unitNumbers, unitNumberPlacement = 'suffix',
  renderRowExtra, extraHeaders, onAmountClick,
  clickableColumns = ['unadjusted', 'aje'],
  cellMarks,
}: TbGridProps) {
  const groups: Array<{ key: 'unadjusted' | 'aje' | 'adjusted' | 'taxRje' | 'tax'; label: string; tone?: string }> = [
    { key: 'unadjusted', label: 'Unadjusted' },
    { key: 'aje', label: 'AJE', tone: 'text-blue-700' },
    { key: 'adjusted', label: 'Adjusted' },
  ];
  if (prefs.showTax) {
    groups.push({ key: 'taxRje', label: 'Tax RJE', tone: 'text-purple-700' });
    groups.push({ key: 'tax', label: 'Tax', tone: 'text-purple-900' });
  }

  const term = search.trim().toLowerCase();
  const byTagView = prefs.activityView === TB_VIEW_BY_TAG;
  const filterUnit = byTagView ? '' : prefs.activityView;
  const pyByAccount = new Map((pyRows ?? []).map((r) => [r.accountId, r]));
  const unitNumberOf = (unitId: string) => (unitId === TB_ZERO_UNIT ? 0 : unitNumbers?.get(unitId) ?? 0);

  const accountRows = workpaper.rows
    .filter((r) => !typeFilter || r.accountType === typeFilter)
    .filter((r) => !term || r.name.toLowerCase().includes(term) || (r.accountNumber ?? '').includes(term));

  const rows: DisplayRow[] = accountRows.flatMap((row): DisplayRow[] => {
    const py = pyByAccount.get(row.accountId);
    if (filterUnit) {
      const u = row.units.find((x) => x.unitId === filterUnit);
      if (!u) return [];
      return [{
        key: row.accountId, row, amounts: pick(u), accountNumber: row.accountNumber ?? '',
        segmentLabel: null, primary: true,
        py: pick(py?.units.find((x) => x.unitId === filterUnit)).adjusted,
      }];
    }
    if (!byTagView) {
      return [{
        key: row.accountId, row, amounts: pick(row), accountNumber: row.accountNumber ?? '',
        segmentLabel: null, primary: true, py: py?.adjusted ?? 0,
      }];
    }
    // By tag: one line per segment, unit 0 (no tag / balance sheet)
    // first, then ascending unit number. Segments that only exist in
    // the prior year still get a line so the comparative isn't lost.
    const segmentIds = new Set<string>(row.byTag.map((s) => s.unitId));
    for (const s of py?.byTag ?? []) segmentIds.add(s.unitId);
    if (segmentIds.size === 0) segmentIds.add(TB_ZERO_UNIT);
    const balanceSheet = ['asset', 'liability', 'equity'].includes(row.accountType);
    return [...segmentIds]
      .sort((a, b) => unitNumberOf(a) - unitNumberOf(b) || a.localeCompare(b))
      .map((unitId, i) => ({
        key: `${row.accountId}:${unitId}`,
        row,
        amounts: pick(row.byTag.find((s) => s.unitId === unitId)),
        accountNumber: unitAccountNumber(row.accountNumber, unitNumberOf(unitId), unitNumberPlacement),
        segmentLabel: unitId === TB_ZERO_UNIT
          ? (balanceSheet ? 'balance sheet · not segmented' : 'no tag')
          : (unitNames?.get(unitId) ?? 'Unmapped unit'),
        primary: i === 0,
        py: pick(py?.byTag.find((s) => s.unitId === unitId)).adjusted,
      }));
  }).filter((d) => !prefs.nonZeroOnly ||
    Math.abs(d.amounts.unadjusted) >= 0.005 || Math.abs(d.amounts.aje) >= 0.005 || Math.abs(d.amounts.taxRje) >= 0.005);

  const colSpanPerGroup = prefs.drCrMode ? 2 : 1;
  // Totals + net income must foot to what's ON SCREEN — with an
  // activity view or filters active, the engine's consolidated totals
  // would visibly disagree with the rows above them.
  const totalsFor = (key: TbGridColumn): [number, number] => {
    let dr = 0;
    let cr = 0;
    for (const d of rows) {
      const v = d.amounts[key];
      if (v > 0) dr += v;
      else cr += -v;
    }
    return [Math.round(dr * 100) / 100, Math.round(cr * 100) / 100];
  };

  let netIncome = 0;
  for (const d of rows) {
    if (!['asset', 'liability', 'equity'].includes(d.row.accountType)) netIncome -= d.amounts.adjusted;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="text-center text-[11px] uppercase text-gray-400 border-b border-gray-100">
            <th colSpan={3} />
            {prefs.showPy && <th colSpan={colSpanPerGroup} className="py-1 bg-gray-50">Prior Year</th>}
            {groups.map((g) => (
              <th key={g.key} colSpan={colSpanPerGroup} className={clsx('py-1', g.tone, g.key === 'adjusted' ? 'bg-blue-50/50' : g.key.startsWith('tax') ? 'bg-purple-50/40' : '')}>
                {g.label}
              </th>
            ))}
            {extraHeaders ? <th colSpan={99} /> : null}
          </tr>
          <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
            <th className="px-3 py-2 w-20">Acct #</th>
            <th className="px-3 py-2">Account Name</th>
            <th className="px-2 py-2 w-12">Cat.</th>
            {prefs.showPy && (prefs.drCrMode
              ? <><th className="px-2 py-2 text-right">PY DR</th><th className="px-2 py-2 text-right">PY CR</th></>
              : <th className="px-2 py-2 text-right">Prior Year</th>)}
            {groups.map((g) => prefs.drCrMode
              ? <Fragment key={g.key}><th className="px-2 py-2 text-right">DR</th><th className="px-2 py-2 text-right">CR</th></Fragment>
              : <th key={g.key} className="px-2 py-2 text-right">{g.label}</th>)}
            {extraHeaders}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, row, amounts, accountNumber, segmentLabel, primary, py }) => {
            const flash = flashIds?.has(row.accountId);
            const type = TYPE_ABBREV[row.accountType];
            return (
              <Fragment key={key}>
                <tr className={clsx('border-b border-gray-100 hover:bg-gray-50', flash && 'tb-flash-row')}>
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-500 whitespace-nowrap">{accountNumber}</td>
                  <td className="px-3 py-1.5">
                    {row.name}
                    {segmentLabel && <span className="ml-2 text-xs italic text-gray-400">{segmentLabel}</span>}
                  </td>
                  <td className={clsx('px-2 py-1.5 text-xs font-medium', type?.tone)}>{type?.label ?? '—'}</td>
                  {prefs.showPy && (prefs.drCrMode
                    ? <AmountPair value={py} flash={flash} />
                    : <AmountSingle value={py} flash={flash} />)}
                  {groups.map((g) => {
                    const value = amounts[g.key];
                    const clickable = clickableColumns.includes(g.key) && onAmountClick
                      ? () => onAmountClick(row, g.key)
                      : undefined;
                    // Tickmarks are per account/column — once per account.
                    const marks = primary ? cellMarks?.(row.accountId, g.key) : undefined;
                    return prefs.drCrMode
                      ? <AmountPair key={g.key} value={value} onClick={clickable} flash={flash} marks={marks} />
                      : <AmountSingle key={g.key} value={value} onClick={clickable} flash={flash} marks={marks} />;
                  })}
                  {renderRowExtra ? (primary ? renderRowExtra(row) : <td colSpan={99} />) : null}
                </tr>
                {/* Per-unit split sub-rows in consolidated view. */}
                {!filterUnit && !byTagView && row.units.length > 1 && row.units.map((u) => (
                  <tr key={row.accountId + u.unitId} className="border-b border-gray-50 bg-gray-50/50 text-gray-500">
                    <td />
                    <td className="px-3 py-1 pl-8 text-xs italic">↳ {unitNames?.get(u.unitId) ?? 'Unmapped unit'}</td>
                    <td />
                    {prefs.showPy && (prefs.drCrMode ? <><td /><td /></> : <td />)}
                    {groups.map((g) => prefs.drCrMode
                      ? <AmountPair key={g.key} value={u[g.key]} />
                      : <AmountSingle key={g.key} value={u[g.key]} />)}
                    {renderRowExtra ? <td colSpan={99} /> : null}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-medium">
            <td className="px-3 py-2 text-xs uppercase text-gray-500" colSpan={3}>Totals</td>
            {prefs.showPy && (prefs.drCrMode ? <><td /><td /></> : <td />)}
            {groups.map((g) => {
              const [dr, cr] = totalsFor(g.key);
              return prefs.drCrMode
                ? <Fragment key={g.key}>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-xs">{usd(dr)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-xs">{usd(cr)}</td>
                  </Fragment>
                : <td key={g.key} className={clsx('px-2 py-2 text-right font-mono tabular-nums text-xs', Math.abs(dr - cr) >= 0.005 && 'text-red-600')}>
                    {Math.abs(dr - cr) < 0.005 ? usd(dr) + ' ✓' : `${usd(dr)} / ${usd(cr)}`}
                  </td>;
            })}
            {renderRowExtra ? <td colSpan={99} /> : null}
          </tr>
          <tr className="text-xs text-gray-500">
            <td className="px-3 py-1.5" colSpan={3}>Net income/(loss) — adjusted</td>
            {prefs.showPy && (prefs.drCrMode ? <><td /><td /></> : <td />)}
            <td colSpan={groups.length * colSpanPerGroup} className="px-2 py-1.5 text-right font-mono tabular-nums text-green-700">
              {netIncome < 0 ? `(${usd(-netIncome)})` : usd(netIncome)}
            </td>
            {renderRowExtra ? <td colSpan={99} /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
