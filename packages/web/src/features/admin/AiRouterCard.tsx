// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, Route } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useUpdateAiConfig, type UpdateAiConfigInput } from '../../api/hooks/useAi';
import { useToast } from '../../components/ui/Toaster';
import { Button } from '../../components/ui/Button';

export interface RouterInfo {
  available: boolean;
  enabled: boolean;
  enabledSetting: boolean | null;
  statementsOnBox: boolean;
  features: Array<{ taskClass: string; label: string; routed: boolean }>;
}

const STATEMENT_CLASS = 'mybooks_statement_extract';

// Admin -> AI: send individual AI features through the appliance's Vibe AI
// Router instead of the providers configured on this page. The router URL
// and token come from `vibe enable` (env); everything else is set here and
// applies immediately, no restart.
export function AiRouterCard({ router }: { router: RouterInfo }) {
  const update = useUpdateAiConfig();
  const toast = useToast();
  const [confirmStatements, setConfirmStatements] = useState(false);
  const test = useMutation({
    mutationFn: () => apiClient<{ success: boolean; error?: string; modelInfo?: string }>('/ai/admin/test-router', { method: 'POST' }),
  });

  const save = (patch: UpdateAiConfigInput, done?: string) =>
    update.mutate(patch, {
      onSuccess: () => { if (done) toast.success(done); },
      onError: (e: Error) => toast.error(e.message || 'Could not save.'),
    });

  const setFeature = (taskClass: string, mode: 'router' | 'direct') => {
    if (taskClass === STATEMENT_CLASS && mode === 'router' && !confirmStatements) {
      setConfirmStatements(true);
      return;
    }
    setConfirmStatements(false);
    save({ routerFeatures: { [taskClass]: mode } });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Route className="mt-0.5 h-5 w-5 text-sky-700" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">Vibe AI Router</h2>
          <p className="mt-1 text-xs text-gray-600">
            Send chosen AI features through the appliance&apos;s AI Router, which picks the model and applies its own
            data-boundary and budget rules. Features left on <strong>Direct</strong> use the providers set on this page.
            GLM-OCR and the local extraction model always stay direct.
          </p>
        </div>
      </div>

      {!router.available ? (
        <p className="mt-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
          The router is not set up on this server. Run <code>vibe enable</code> to connect it, then come back here.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={router.enabled}
                onChange={(e) => save({ routerEnabled: e.target.checked }, e.target.checked ? 'AI Router turned on.' : 'AI Router turned off. Every feature now runs direct.')}
                aria-label="Use the AI Router"
              />
              Use the AI Router
            </label>
            <Button size="sm" variant="secondary" onClick={() => test.mutate()} loading={test.isPending}>Test connection</Button>
            {test.data && (
              <span className={`text-xs ${test.data.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {test.data.success ? 'Router is reachable.' : `Not reachable: ${test.data.error ?? 'unknown error'}`}
              </span>
            )}
          </div>
          {router.enabledSetting === null && router.enabled && (
            <p className="mt-2 text-xs text-amber-700">
              Turned on by the server setting VIBE_AI_MODE=router. Saving any choice here takes over from it.
            </p>
          )}

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="py-1.5 font-medium">Feature</th>
                <th className="py-1.5 text-right font-medium">Runs through</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {router.features.map((f) => (
                <tr key={f.taskClass}>
                  <td className="py-2">
                    <div className="text-gray-900">{f.label}</div>
                    <div className="text-[11px] text-gray-400">{f.taskClass}</div>
                  </td>
                  <td className="py-2 text-right">
                    <div role="radiogroup" aria-label={`${f.label} routing`} className="inline-flex rounded-lg border border-gray-200 p-0.5">
                      {(['direct', 'router'] as const).map((m) => {
                        const active = (m === 'router') === f.routed;
                        return (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={!router.enabled || update.isPending}
                            onClick={() => setFeature(f.taskClass, m)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${active ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {m === 'direct' ? 'Direct' : 'Router'}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 text-gray-500" colSpan={2}>
                  <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Statement page reading (GLM-OCR) and the local extraction model — always direct</span>
                </td>
              </tr>
            </tbody>
          </table>

          {confirmStatements && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">Route bank statements through the router?</p>
              <p className="mt-1">
                Statement text is scrubbed of personal details before it is sent, unless you confirm below that the router
                keeps statements on this server. Check images are only sent if the router keeps statements here or cloud
                vision is on. The local model&apos;s thinking and context settings do not apply through the router.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => { setConfirmStatements(false); save({ routerFeatures: { [STATEMENT_CLASS]: 'router' } }, 'Statements now go through the router.'); }}>
                  Route statements
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmStatements(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <label className="mt-4 flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={router.statementsOnBox}
              onChange={(e) => save({ routerStatementsOnBox: e.target.checked })}
              aria-label="The router keeps bank statements on this server"
            />
            <span>
              The router keeps bank statements on this server (its statement task is local-only). When checked, routed
              statement text is not scrubbed and check images may be sent to it.
            </span>
          </label>
        </>
      )}
    </div>
  );
}
