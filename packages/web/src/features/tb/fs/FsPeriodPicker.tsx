// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Reporting-period + column-layout pickers for financial statements:
// annual (fiscal year), fiscal quarter, month, year to date, or a custom
// date range; and the income-statement column layout for that period.

import {
  fsAddDays, fsFiscalQuarter, fsFiscalYearEnd, fsFiscalYearStart, fsResolvePeriod, fsShiftMonths,
  type FsColumnsConfig, type FsPeriodType, type FsReportSettings,
} from '@kis-books/shared';

const sel = 'rounded-md border border-gray-300 px-2 text-sm py-1';

const pad = (n: number) => String(n).padStart(2, '0');

// Fiscal year labelled by the calendar year it ends in.
export function fiscalYearEndOf(label: number, fyStartMonth: number): string {
  return fsAddDays(`${fyStartMonth === 1 ? label + 1 : label}-${pad(fyStartMonth)}-01`, -1);
}

export interface FsPeriodValue { type: FsPeriodType; start: string; end: string }

export function periodOf(settings: FsReportSettings, fyStartMonth: number): FsPeriodValue {
  if (settings.period) return { type: settings.period.type, start: settings.period.start, end: settings.periodEnd };
  const start = fsFiscalYearStart(settings.periodEnd, fyStartMonth);
  const annual = settings.periodEnd === fsFiscalYearEnd(settings.periodEnd, fyStartMonth);
  return { type: annual ? 'annual' : 'ytd', start, end: settings.periodEnd };
}

export function FsPeriodPicker({ value, onChange, fyStartMonth, taxBasis, disabled }: {
  value: FsPeriodValue;
  onChange: (v: FsPeriodValue) => void;
  fyStartMonth: number;
  taxBasis?: boolean;
  disabled?: boolean;
}) {
  const fyLabel = (iso: string) => Number(fsFiscalYearEnd(iso, fyStartMonth).slice(0, 4));
  const thisFy = fyLabel(new Date().toISOString().slice(0, 10));
  const years = Array.from({ length: 8 }, (_, i) => thisFy + 1 - i);
  const yearName = (y: number) => (fyStartMonth === 1 ? String(y) : `FY ${y}`);
  const setType = (type: FsPeriodType) => {
    const r = fsResolvePeriod(type, type === 'annual' ? value.end : value.end, fyStartMonth, value.start);
    onChange(r);
  };
  const curFy = fyLabel(value.end);
  const curQ = fsFiscalQuarter(value.start, fyStartMonth).q;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select className={sel} value={value.type} disabled={disabled} aria-label="Period type" onChange={(e) => setType(e.target.value as FsPeriodType)}>
        <option value="annual">Year</option>
        <option value="quarter" disabled={taxBasis}>Quarter</option>
        <option value="month" disabled={taxBasis}>Month</option>
        <option value="ytd" disabled={taxBasis}>Year to date</option>
        <option value="custom" disabled={taxBasis}>Date range</option>
      </select>
      {(value.type === 'annual' || value.type === 'quarter') && (
        <select className={sel} value={curFy} disabled={disabled} aria-label="Fiscal year" onChange={(e) => {
          const fye = fiscalYearEndOf(Number(e.target.value), fyStartMonth);
          if (value.type === 'annual') onChange(fsResolvePeriod('annual', fye, fyStartMonth));
          else onChange(fsResolvePeriod('quarter', fsShiftMonths(fsFiscalYearStart(fye, fyStartMonth), 3 * (curQ - 1)), fyStartMonth));
        }}>
          {years.map((y) => <option key={y} value={y}>{yearName(y)}</option>)}
        </select>
      )}
      {value.type === 'quarter' && (
        <select className={sel} value={curQ} disabled={disabled} aria-label="Quarter" onChange={(e) => {
          const fyS = fsFiscalYearStart(value.start, fyStartMonth);
          onChange(fsResolvePeriod('quarter', fsShiftMonths(fyS, 3 * (Number(e.target.value) - 1)), fyStartMonth));
        }}>
          {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
        </select>
      )}
      {value.type === 'month' && (
        <input type="month" className={sel} disabled={disabled} aria-label="Month" value={value.start.slice(0, 7)}
          onChange={(e) => e.target.value && onChange(fsResolvePeriod('month', `${e.target.value}-01`, fyStartMonth))} />
      )}
      {value.type === 'ytd' && (
        <label className="inline-flex items-center gap-1 text-sm">through
          <input type="date" className={sel} disabled={disabled} value={value.end}
            onChange={(e) => e.target.value && onChange(fsResolvePeriod('ytd', e.target.value, fyStartMonth))} />
        </label>
      )}
      {value.type === 'custom' && (
        <>
          <input type="date" className={sel} disabled={disabled} aria-label="Start date" value={value.start}
            onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value })} />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" className={sel} disabled={disabled} aria-label="End date" value={value.end}
            onChange={(e) => e.target.value && onChange({ ...value, end: e.target.value })} />
        </>
      )}
      <span className="text-xs text-gray-400">{value.start} – {value.end}</span>
    </span>
  );
}

export function FsColumnsPicker({ value, onChange, taxBasis, disabled }: {
  value: FsColumnsConfig;
  onChange: (v: FsColumnsConfig) => void;
  taxBasis?: boolean;
  disabled?: boolean;
}) {
  const mode = value.mode === 'month_ytd' ? 'period_ytd' : value.mode;
  const comparative = mode === 'cy_py' || mode === 'period_ytd_py';
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <select className={sel} value={mode} disabled={disabled} aria-label="Columns" onChange={(e) => onChange({ ...value, mode: e.target.value as FsColumnsConfig['mode'] })}>
        <option value="single">This period</option>
        <option value="cy_py">vs same period last year</option>
        <option value="period_ytd" disabled={taxBasis}>Period + year to date</option>
        <option value="period_ytd_py" disabled={taxBasis}>Period + YTD, vs last year</option>
        <option value="side_by_side" disabled={taxBasis}>Side by side</option>
      </select>
      {mode === 'side_by_side' && (
        <select className={sel} value={value.sideBy ?? 'month'} disabled={disabled} aria-label="Side-by-side columns" onChange={(e) => onChange({ ...value, sideBy: e.target.value as 'month' | 'quarter' })}>
          <option value="month">by month</option>
          <option value="quarter">by quarter</option>
        </select>
      )}
      {comparative && (
        <select className={sel} value={value.bsCompare ?? 'prior_fye'} disabled={disabled} aria-label="Balance sheet comparison" onChange={(e) => onChange({ ...value, bsCompare: e.target.value as 'prior_fye' | 'same_date' })}>
          <option value="prior_fye">Balance sheet vs prior year-end</option>
          <option value="same_date">Balance sheet vs same date last year</option>
        </select>
      )}
      <label className="inline-flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={value.pctOfRevenue} onChange={(e) => onChange({ ...value, pctOfRevenue: e.target.checked })} />% of revenue</label>
      {mode === 'cy_py' && (
        <>
          <label className="inline-flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={value.varianceAmt} onChange={(e) => onChange({ ...value, varianceAmt: e.target.checked })} />$ change</label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={value.variancePct} onChange={(e) => onChange({ ...value, variancePct: e.target.checked })} />% change</label>
        </>
      )}
    </span>
  );
}
