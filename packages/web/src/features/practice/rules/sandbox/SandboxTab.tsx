// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Beaker, ListChecks, Play } from 'lucide-react';
import type { ActionsField, ConditionAST } from '@kis-books/shared';
import { Button } from '../../../../components/ui/Button';
import { useRecentSamples, useRunBatchSandbox, useRunSandbox } from '../../../../api/hooks/useRuleTestSandbox';
import { ConditionTrace } from './ConditionTrace';

interface Props {
  conditions: ConditionAST;
  actions: ActionsField;
}

// Phase 5b §5.5 — Sandbox tab inside the rule editor modal.
// Lets the bookkeeper dry-run an UNSAVED rule body against:
//   - a sample bank-feed item picked from the dropdown, OR
//   - the most recent up-to-100 feed items in batch.
// The single-sample path renders a per-condition trace; the
// batch path renders a count + first-N matched samples.
export function SandboxTab({ conditions, actions }: Props) {
  const { data: samples } = useRecentSamples();
  const [selectedId, setSelectedId] = useState<string>('');
  const single = useRunSandbox();
  const batch = useRunBatchSandbox();

  const runSingle = () => {
    if (!selectedId) return;
    single.mutate({
      rule: { conditions, actions },
      sampleFeedItemId: selectedId,
    });
  };

  const runBatch = () => {
    batch.mutate({ rule: { conditions, actions }, limit: 100 });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Beaker className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Test against a single sample</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Pick a recent feed item…</option>
            {samples?.samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.feedDate} — {s.description ?? '(no description)'} — {s.amount}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={runSingle}
            disabled={!selectedId || single.isPending}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Run
          </Button>
        </div>
        {single.data && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-xs text-gray-700">
              Result:{' '}
              <span className={single.data.matched ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
                {single.data.matched ? 'rule matched' : 'no match'}
              </span>
            </div>
            <ConditionTrace trace={single.data.trace} />
            {single.data.matched && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs">
                <div className="font-semibold text-emerald-800 mb-1">Actions that would apply</div>
                {single.data.appliedActions.length === 0 ? (
                  <span className="italic text-gray-600">No actions configured for this branch.</span>
                ) : (
                  <ul className="list-disc list-inside space-y-0.5 font-mono">
                    {single.data.appliedActions.map((a, i) => (
                      <li key={i}>{a.type}{Object.keys(a).length > 1 ? ` — ${JSON.stringify({ ...a, type: undefined })}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Test against last 100 feed items</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={runBatch} disabled={batch.isPending}>
            {batch.isPending ? 'Running…' : 'Run batch'}
          </Button>
          {batch.data && (
            <span className="text-xs text-gray-700">
              <span className="font-mono">{batch.data.totalMatched}</span> of{' '}
              <span className="font-mono">{batch.data.totalScanned}</span> would fire
            </span>
          )}
        </div>
        {batch.data && batch.data.firstMatches.length > 0 && (
          <div className="rounded-md border border-gray-200 bg-white p-2">
            <div className="text-xs font-semibold text-gray-700 mb-1">First {batch.data.firstMatches.length} matched</div>
            <ul className="text-xs text-gray-700 space-y-1 font-mono">
              {batch.data.firstMatches.map((m) => (
                <li key={m.bankFeedItemId}>
                  {m.feedDate} — {m.description} — {m.amount}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
