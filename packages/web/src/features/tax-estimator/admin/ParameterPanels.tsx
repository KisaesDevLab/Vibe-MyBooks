// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { TaxParameterDiffRowDTO, TaxParameterChangeDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useTaxParameterDiff, useTaxParameterChanges, useAdoptShippedParameters } from '../../../api/hooks/useTaxParameters';
import { useToast } from '../../../components/ui/Toaster';

const Skeleton = () => <div className="animate-pulse h-16 bg-gray-100 rounded-lg" aria-label="Loading" />;
const json = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v));

export function DiffPanel({ year }: { year: number }) {
  const q = useTaxParameterDiff(year);
  const adopt = useAdoptShippedParameters(year);
  const toast = useToast();
  const run = (keys?: string[]) =>
    adopt.mutate(keys, {
      onSuccess: (r) => toast.success(`Adopted ${r.adopted} shipped value(s)`),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Adopt failed'),
    });
  const rows: TaxParameterDiffRowDTO[] = q.data ?? [];
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4" aria-label="Shipped-vs-provisional diff">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Shipped-vs-provisional diff</h2>
        {rows.length > 0 && <Button size="sm" onClick={() => run()} loading={adopt.isPending}>Adopt all shipped</Button>}
      </div>
      {q.isLoading ? <Skeleton /> : q.isError ? <ErrorMessage message="Could not load the diff" onRetry={() => q.refetch()} /> :
        rows.length === 0 ? <p className="text-sm text-gray-500">Nothing to adopt — no provisional row has a shipped counterpart for this year yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th className="py-1">Parameter</th><th>Shipped</th><th>Provisional</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-gray-100">
                  <td className="py-1.5">{r.label}<div className="text-xs font-mono text-gray-500">{r.key}</div></td>
                  <td className="font-mono text-xs">{json(r.shippedValue)} <span className="text-gray-500">({r.shippedStatus})</span></td>
                  <td className="font-mono text-xs">{json(r.provisionalValue)}{r.same && <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-sans" title="Identical value: adopting only lets the shipped status and citation take effect">same value</span>}</td>
                  <td className="text-right"><Button size="sm" variant="secondary" onClick={() => run([r.key])} disabled={adopt.isPending}>Adopt shipped</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  );
}

const ACTION_LABEL: Record<TaxParameterChangeDTO['action'], string> = {
  override_set: 'Override set', override_reverted: 'Override reverted', year_created: 'Year created', shipped_adopted: 'Shipped adopted', verified: 'Verified',
};

export function ChangesPanel({ year }: { year: number }) {
  const q = useTaxParameterChanges(year, 50);
  const [open, setOpen] = useState(true);
  const rows: TaxParameterChangeDTO[] = q.data ?? [];
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4" aria-label="Recent changes">
      <button type="button" className="font-semibold text-gray-900" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Recent changes</button>
      {open && (q.isLoading ? <Skeleton /> : q.isError ? <ErrorMessage message="Could not load recent changes" onRetry={() => q.refetch()} /> :
        rows.length === 0 ? <p className="text-sm text-gray-500 mt-2">No changes recorded for {year}.</p> : (
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {rows.map((c, i) => (
              <li key={`${c.at}-${i}`} className="py-1.5">
                <span className="font-medium">{ACTION_LABEL[c.action]}</span>
                {c.key && <span className="font-mono text-xs text-gray-600"> {c.key}</span>}
                <span className="text-gray-500"> · {new Date(c.at).toLocaleString()} · {c.userEmail ?? 'system'}</span>
                {c.reason && <div className="text-xs text-gray-600">Reason: {c.reason}</div>}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
