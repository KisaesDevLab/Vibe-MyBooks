// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';

interface ClaudeModelInfo { id: string; displayName: string; createdAt: string }
interface ClaudeModelSlot { slot: string; label: string; current: string }
interface ClaudeModelUpgrade extends ClaudeModelSlot { latest: string; latestDisplayName: string }
interface UpgradeCheck {
  latestByFamily: Record<string, ClaudeModelInfo>;
  configured: ClaudeModelSlot[];
  upgrades: ClaudeModelUpgrade[];
}

const FAMILY_ORDER = ['fable', 'opus', 'sonnet', 'haiku'];

// Admin → AI: ask Anthropic which Claude models exist now and move every
// configured Claude model (tasks, statement extraction, chat, Task Settings
// overrides) to the newest model of its family in one click.
export function ClaudeModelUpdatesCard({ onApplied }: { onApplied?: () => void }) {
  const qc = useQueryClient();
  const [check, setCheck] = useState<UpgradeCheck | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const runCheck = useMutation({
    mutationFn: () => apiClient<UpgradeCheck>('/ai/admin/models/anthropic/upgrades'),
    onSuccess: (r) => { setCheck(r); setAppliedCount(null); },
  });
  const apply = useMutation({
    mutationFn: (slots?: string[]) =>
      apiClient<{ applied: ClaudeModelUpgrade[] }>('/ai/admin/models/anthropic/upgrade', {
        method: 'POST', body: JSON.stringify(slots ? { slots } : {}),
      }),
    onSuccess: async (r) => {
      setAppliedCount(r.applied.length);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ai'] }),
        qc.invalidateQueries({ queryKey: ['chat', 'admin', 'config'] }),
      ]);
      onApplied?.();
      runCheck.mutate();
    },
  });

  const families = check
    ? Object.entries(check.latestByFamily).sort(
      ([a], [b]) => (FAMILY_ORDER.indexOf(a) + 1 || 99) - (FAMILY_ORDER.indexOf(b) + 1 || 99),
    )
    : [];
  const error = runCheck.error ?? apply.error;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Claude Models</h2>
          <p className="text-xs text-gray-500 mt-1">
            Check Anthropic for newer Claude models and move your configured models to the newest of each family
            (Haiku → newest Haiku, Sonnet → newest Sonnet).
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => runCheck.mutate()} loading={runCheck.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" /> Check for new models
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error instanceof Error ? error.message : 'Could not check Claude models.'}
        </p>
      )}

      {appliedCount !== null && (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" /> Updated {appliedCount} model setting{appliedCount === 1 ? '' : 's'}.
          Unsaved edits on this page were reloaded.
        </p>
      )}

      {check && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-gray-500">Newest available:</span>
            {families.map(([fam, m]) => (
              <span key={fam} className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-700" title={m.displayName}>
                {m.id}
              </span>
            ))}
          </div>

          {check.configured.length === 0 ? (
            <p className="text-sm text-gray-500">No task is set to an Anthropic Claude model.</p>
          ) : check.upgrades.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" /> All {check.configured.length} Claude model setting
              {check.configured.length === 1 ? ' is' : 's are'} on the newest model.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
                {check.upgrades.map((u) => (
                  <li key={u.slot} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="flex-1 min-w-[10rem] text-gray-800">{u.label}</span>
                    <span className="font-mono text-xs text-gray-500">{u.current}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                    <span className="font-mono text-xs text-gray-900" title={u.latestDisplayName}>{u.latest}</span>
                    <Button size="sm" variant="secondary" disabled={apply.isPending} onClick={() => apply.mutate([u.slot])}>
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => apply.mutate(undefined)} loading={apply.isPending}>
                  Update all ({check.upgrades.length})
                </Button>
                <span className="text-xs text-gray-500">Saves immediately. Run the Self-test afterwards to confirm.</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
