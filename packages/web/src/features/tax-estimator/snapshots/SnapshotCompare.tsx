// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { presentWarningMessage, type SnapshotCompareDTO } from '@kis-books/shared';
import { dollars, pct } from '../estimate/format';
import { fmtTimestamp } from './labels';

const isRate = (path: string) => path.endsWith('marginalRate');
const show = (path: string, v: string | null) => (v == null ? '—' : isRate(path) ? pct(v) : dollars(v));
const shortValue = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s == null ? '—' : s.length > 60 ? `${s.slice(0, 57)}...` : s;
};

/** Snapshot vs. a live recomputation of the same scenario and range. Display only. */
export function SnapshotCompare({ compare: c }: { compare: SnapshotCompareDTO }) {
  if (c.liveUnavailable || !c.liveComputedAt) {
    return (
      <div className="space-y-4" aria-label="Compare with live">
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {c.liveUnavailable?.message ?? 'No live estimate is available to compare with.'} The snapshot taken {fmtTimestamp(c.snapshotCreatedAt)} is unchanged.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4" aria-label="Compare with live">
      <p className="text-sm text-gray-600">
        Snapshot taken {fmtTimestamp(c.snapshotCreatedAt)} compared with a live estimate computed {fmtTimestamp(c.liveComputedAt)}.
      </p>
      {c.engineVersionChanged && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The calculation engine has changed since this snapshot; some differences may come from the engine, not the books.
        </p>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <h3 className="text-base font-semibold text-gray-900">Changed figures</h3>
        {c.differences.length === 0 ? <p className="text-sm text-gray-600">No figures changed.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Line</th>
                  <th className="py-2 pr-3 font-medium text-right">Snapshot</th>
                  <th className="py-2 pr-3 font-medium text-right">Live</th>
                  <th className="py-2 font-medium text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {c.differences.map((d) => (
                  <tr key={d.path} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3">{d.label}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{show(d.path, d.snapshot)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{show(d.path, d.live)}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.delta == null ? '—' : isRate(d.path) ? pct(d.delta) : dollars(d.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <h3 className="text-base font-semibold text-gray-900">Parameter and state-rule changes</h3>
        {c.parameterChanges.length === 0 ? <p className="text-sm text-gray-600">No parameter or rule changed.</p> : (
          <ul className="space-y-1 text-sm">
            {c.parameterChanges.map((p) => (
              <li key={`${p.scope}|${p.key}`}>
                <span className="font-medium">{p.scope === 'federal' ? 'Federal' : p.scope} {p.key}</span>:{' '}
                {p.snapshot ? `${shortValue(p.snapshot.value)} (${p.snapshot.status})` : 'not used'} &rarr; {p.live ? `${shortValue(p.live.value)} (${p.live.status})` : 'not used'}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <h3 className="text-base font-semibold text-gray-900">Warnings</h3>
        {c.warningsAdded.length === 0 && c.warningsRemoved.length === 0 ? <p className="text-sm text-gray-600">Warnings are unchanged.</p> : (
          <ul className="space-y-1 text-sm">
            {c.warningsAdded.map((w, i) => <li key={`a${i}`}><span className="font-medium text-amber-800">New:</span> {presentWarningMessage(w)}</li>)}
            {c.warningsRemoved.map((w, i) => <li key={`r${i}`}><span className="font-medium text-green-800">Resolved:</span> {presentWarningMessage(w)}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
