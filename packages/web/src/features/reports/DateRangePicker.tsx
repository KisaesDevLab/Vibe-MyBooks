import { useState } from 'react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const presets = [
  { label: 'This Month', fn: () => { const d = new Date(); return { start: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, end: d.toISOString().split('T')[0]! }; }},
  { label: 'This Quarter', fn: () => { const d = new Date(); const q = Math.floor(d.getMonth()/3)*3; return { start: `${d.getFullYear()}-${String(q+1).padStart(2,'0')}-01`, end: d.toISOString().split('T')[0]! }; }},
  { label: 'This Year', fn: () => { const d = new Date(); return { start: `${d.getFullYear()}-01-01`, end: d.toISOString().split('T')[0]! }; }},
  { label: 'Last Year', fn: () => { const y = new Date().getFullYear()-1; return { start: `${y}-01-01`, end: `${y}-12-31` }; }},
];

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button key={p.label} type="button" onClick={() => { const r = p.fn(); onChange(r.start, r.end); }}
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
