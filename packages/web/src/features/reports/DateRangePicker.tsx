// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useCompanySettings } from '../../api/hooks/useCompany';
import { todayLocalISO, fiscalYearRange } from '../../utils/date';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

// All presets derive from the browser-LOCAL today. The old version
// mixed local (start) with UTC (end via toISOString), which inverted
// the "This Year" range during the first hours of Jan 1 in east-of-UTC
// timezones. Fiscal presets appear when the company's fiscal year
// doesn't start in January.
function buildPresets(fyMonth: number): Array<{ label: string; start: string; end: string }> {
  const today = todayLocalISO();
  const y = parseInt(today.slice(0, 4), 10);
  const m = parseInt(today.slice(5, 7), 10);
  const q = Math.floor((m - 1) / 3) * 3 + 1;
  const presets = [
    { label: 'This Month', start: `${today.slice(0, 8)}01`, end: today },
    { label: 'This Quarter', start: `${y}-${String(q).padStart(2, '0')}-01`, end: today },
    { label: 'This Year', start: `${y}-01-01`, end: today },
    { label: 'Last Year', start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
  ];
  if (fyMonth !== 1) {
    const thisFy = fiscalYearRange(fyMonth);
    // Last fiscal year: same window shifted back one year; its end is
    // the day before this fiscal year's start (UTC-safe arithmetic).
    const lastStart = `${parseInt(thisFy.start.slice(0, 4), 10) - 1}${thisFy.start.slice(4)}`;
    const lastEndD = new Date(thisFy.start + 'T00:00:00Z');
    lastEndD.setUTCDate(lastEndD.getUTCDate() - 1);
    presets.push(
      { label: 'This Fiscal Year', start: thisFy.start, end: today },
      { label: 'Last Fiscal Year', start: lastStart, end: lastEndD.toISOString().split('T')[0]! },
    );
  }
  return presets;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const { data: settingsData } = useCompanySettings();
  const fyMonth = settingsData?.settings?.fiscalYearStartMonth ?? 1;
  const presets = buildPresets(fyMonth);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button key={p.label} type="button" onClick={() => onChange(p.start, p.end)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
          {p.label}
        </button>
      ))}
      <input type="date" value={startDate} onChange={(e) => onChange(e.target.value, endDate)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
      <span className="text-gray-400">to</span>
      <input type="date" value={endDate} onChange={(e) => onChange(startDate, e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
    </div>
  );
}
