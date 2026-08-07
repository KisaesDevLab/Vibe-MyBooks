// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Presentational five-column TB grid shared by the workpaper screen
// and the read-only popout (6B). Signed nets arrive from the engine;
// this component renders DR/CR pairs or the netted "single" mode, the
// optional PY comparative and tax columns, per-unit expansion, and the
// diff-flash highlight used by the popout.

import { Fragment } from 'react';
import clsx from 'clsx';
import { usd, type TbWorkpaperRow, type TbWorkpaper } from './workpaperShared';

export interface TbGridPrefs {
  drCrMode: boolean;   // false = netted single column per group
  showPy: boolean;
  showTax: boolean;    // tax rje + tax columns
  nonZeroOnly: boolean;
  activityView: string; // '' = consolidated, else unitId
}

export interface TbGridProps {
  workpaper: TbWorkpaper;
  pyByAccount?: Map<string, number>;
  prefs: TbGridPrefs;
  search: string;
  typeFilter: string;
  flashIds?: Set<string>;
  unitNames?: Map<string, string>;
  // Render extra cells at the end of each row (tax code picker, marks…).
  renderRowExtra?: (row: TbWorkpaperRow) => React.ReactNode;
  extraHeaders?: React.ReactNode;
  onAmountClick?: (row: TbWorkpaperRow, column: 'unadjusted' | 'aje') => void;
}

const TYPE_ABBREV: Record<string, { label: string; tone: string }> = {
  asset: { label: 'Ass', tone: 'text-blue-600' },
  liability: { label: 'Lia', tone: 'text-orange-600' },
  equity: { label: 'Equ', tone: 'text-purple-600' },
  revenue: { label: 'Rev', tone: 'text-green-700' },
  expense: { label: 'Exp', tone: 'text-red-600' },
};

function AmountPair({ value, onClick, flash }: { value: number; onClick?: () => void; flash?: boolean }) {
  const dr = value > 0 ? value : 0;
  const cr = value < 0 ? -value : 0;
  const cell = (v: number, side: 'dr' | 'cr') => (
    <td key={side} className={clsx('px-2 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap', flash && 'tb-flash')}>
      {onClick && v !== 0 ? (
        <button className="underline decoration-dotted hover:text-blue-700" onClick={onClick}>{usd(v)}</button>
      ) : usd(v)}
    </td>
  );
  return <>{cell(dr, 'dr')}{cell(cr, 'cr')}</>;
}

function AmountSingle({ value, onClick, flash }: { value: number; onClick?: () => void; flash?: boolean }) {
  const negative = value < -0.004;
  const text = Math.abs(value) < 0.005 ? '—' : negative ? `(${usd(-value)})` : usd(value);
  return (
    <td className={clsx('px-2 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap', negative && 'text-red-700', flash && 'tb-flash')}>
      {onClick && Math.abs(value) >= 0.005 ? (
        <button className="underline decoration-dotted hover:text-blue-700" onClick={onClick}>{text}</button>
      ) : text}
    </td>
  );
}

export function TbWorkpaperGrid({
  workpaper, pyByAccount, prefs, search, typeFilter, flashIds, unitNames,
  renderRowExtra, extraHeaders, onAmountClick,
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
  const filterUnit = prefs.activityView;
  const rows = workpaper.rows
    .map((r) => {
      if (!filterUnit) return r;
      const u = r.units.find((x) => x.unitId === filterUnit);
      if (!u) return null;
      return { ...r, unadjusted: u.unadjusted, aje: u.aje, adjusted: u.adjusted, taxRje: u.taxRje, tax: u.tax, units: [] };
    })
    .filter((r): r is TbWorkpaperRow => !!r)
    .filter((r) => !typeFilter || r.accountType === typeFilter)
    .filter((r) => !term || r.name.toLowerCase().includes(term) || (r.accountNumber ?? '').includes(term))
    .filter((r) => !prefs.nonZeroOnly ||
      Math.abs(r.unadjusted) >= 0.005 || Math.abs(r.aje) >= 0.005 || Math.abs(r.taxRje) >= 0.005);

  const colSpanPerGroup = prefs.drCrMode ? 2 : 1;
  // Totals + net income must foot to what's ON SCREEN — with an
  // activity view or filters active, the engine's consolidated totals
  // would visibly disagree with the rows above them.
  const totalsFor = (key: 'unadjusted' | 'aje' | 'adjusted' | 'taxRje' | 'tax'): [number, number] => {
    let dr = 0;
    let cr = 0;
    for (const r of rows) {
      const v = r[key];
      if (v > 0) dr += v;
      else cr += -v;
    }
    return [Math.round(dr * 100) / 100, Math.round(cr * 100) / 100];
  };

  let netIncome = 0;
  for (const r of rows) {
    if (r.accountType === 'revenue' || r.accountType === 'expense') netIncome -= r.adjusted;
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
          {rows.map((row) => {
            const flash = flashIds?.has(row.accountId);
            const py = pyByAccount?.get(row.accountId) ?? 0;
            const type = TYPE_ABBREV[row.accountType];
            return (
              <Fragment key={row.accountId}>
                <tr className={clsx('border-b border-gray-100 hover:bg-gray-50', flash && 'tb-flash-row')}>
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{row.accountNumber ?? ''}</td>
                  <td className="px-3 py-1.5">{row.name}</td>
                  <td className={clsx('px-2 py-1.5 text-xs font-medium', type?.tone)}>{type?.label ?? '—'}</td>
                  {prefs.showPy && (prefs.drCrMode
                    ? <AmountPair value={py} flash={flash} />
                    : <AmountSingle value={py} flash={flash} />)}
                  {groups.map((g) => {
                    const value = row[g.key];
                    const clickable = (g.key === 'unadjusted' || g.key === 'aje') && onAmountClick
                      ? () => onAmountClick(row, g.key as 'unadjusted' | 'aje')
                      : undefined;
                    return prefs.drCrMode
                      ? <AmountPair key={g.key} value={value} onClick={clickable} flash={flash} />
                      : <AmountSingle key={g.key} value={value} onClick={clickable} flash={flash} />;
                  })}
                  {renderRowExtra?.(row)}
                </tr>
                {/* Per-unit split sub-rows in consolidated view. */}
                {!filterUnit && row.units.length > 1 && row.units.map((u) => (
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
