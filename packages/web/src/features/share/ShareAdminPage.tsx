// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Firm-admin surface for peer screen share (2.7, 12.4–12.6, 13.8):
// tenant settings (enable/inherit, inbound cross-firm refusal), per-user
// overrides, and the session log with cross-firm filtering + CSV export.

import { useState } from 'react';
import { MonitorUp, Download, ShieldAlert, Ban } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { apiClient } from '../../api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useTenantShareSettings,
  useUpdateTenantShareSettings,
  useAdminShareSessions,
  type AdminShareSessionRow,
} from './useShare';

interface TeamUserRow {
  id: string;
  email: string;
  displayName: string | null;
  shareAllowed?: boolean | null;
}

/** Per-user tri-state override (D9). Revoking ends the user's live sessions
 *  immediately — as sharer and as viewer. */
function UserOverridesSection({ disabled }: { disabled: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['share', 'team-users'],
    queryFn: () => apiClient<{ users: TeamUserRow[] }>('/company/users'),
  });
  const setOverride = useMutation({
    mutationFn: (input: { userId: string; shareAllowed: boolean | null }) =>
      apiClient(`/share/admin/users/${input.userId}/share-allowed`, {
        method: 'PUT',
        body: JSON.stringify({ shareAllowed: input.shareAllowed }),
      }),
    onSuccess: (_r, input) => {
      if (input.shareAllowed === false) toast.info('Screen sharing revoked — any live sessions were ended.');
      void qc.invalidateQueries({ queryKey: ['share', 'team-users'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update the user.'),
  });

  if (!data?.users?.length) return null;
  return (
    <div className="bg-white rounded-lg border p-5 mb-6 max-w-2xl">
      <h2 className="font-semibold text-gray-900 mb-1">Per-user access</h2>
      <p className="text-xs text-gray-500 mb-3">
        "Inherit" follows the firm setting above. Blocking a user ends their live sessions immediately,
        both sharing and viewing.
      </p>
      <ul className="divide-y divide-gray-100">
        {data.users.map((u) => (
          <li key={u.id} className="py-2 flex items-center gap-3">
            <span className="flex-1 text-sm text-gray-900 truncate">{u.displayName ?? u.email}</span>
            <select
              aria-label={`Screen sharing for ${u.displayName ?? u.email}`}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
              value={u.shareAllowed === false ? 'blocked' : u.shareAllowed === true ? 'allowed' : 'inherit'}
              disabled={disabled || setOverride.isPending}
              onChange={(e) => {
                const v = e.target.value;
                setOverride.mutate({ userId: u.id, shareAllowed: v === 'blocked' ? false : v === 'allowed' ? true : null });
              }}
            >
              <option value="inherit">Inherit</option>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmt(dt: string | null | undefined): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function durationOf(row: AdminShareSessionRow): string {
  const start = new Date(row.session.createdAt).getTime();
  const end = row.session.endedAt ? new Date(row.session.endedAt).getTime() : Date.now();
  const mins = Math.round((end - start) / 60_000);
  return `${mins} min`;
}

export function ShareAdminPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading, isError } = useTenantShareSettings();
  const update = useUpdateTenantShareSettings();
  const [crossFirmOnly, setCrossFirmOnly] = useState(false);
  const { data: log, isLoading: logLoading } = useAdminShareSessions({ crossFirmOnly });

  const endSession = useMutation({
    mutationFn: (sessionId: string) => apiClient(`/share/admin/sessions/${sessionId}/end`, { method: 'POST' }),
    onSuccess: () => {
      toast.info('Session terminated.');
      void qc.invalidateQueries({ queryKey: ['share', 'admin-sessions'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not end the session.'),
  });

  if (isLoading) {
    return <div className="bg-white rounded-lg border p-12 flex justify-center"><LoadingSpinner /></div>;
  }
  if (isError || !settings) {
    return (
      <div className="bg-white rounded-lg border p-8 max-w-xl">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Screen Sharing</h1>
        <p className="text-sm text-gray-600">
          Screen sharing is not enabled on this appliance. The operator can enable it by setting
          <code className="mx-1 text-xs bg-gray-100 rounded px-1 py-0.5">SHARE_ENABLED=true</code>
          in the appliance environment.
        </p>
      </div>
    );
  }

  const effectiveEnabled = settings.enabled !== false;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <MonitorUp className="h-6 w-6 text-gray-500" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Screen Sharing</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Users share their MyBooks screen — never their desktop — with other MyBooks users. Every viewer
        is approved by the sharer by name, all typed input and tax IDs are masked before anything leaves
        the sharer's browser, and every session is logged here for 3 years. Nothing that is shown on a
        shared screen is ever recorded or stored.
      </p>

      {/* Tenant settings (2.4, 2.5) */}
      <div className="bg-white rounded-lg border p-5 mb-6 max-w-2xl space-y-4">
        <h2 className="font-semibold text-gray-900">Firm settings</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={effectiveEnabled}
            onChange={(e) => update.mutate({ enabled: e.target.checked ? null : false })}
            disabled={update.isPending}
          />
          <span className="text-sm">
            <span className="font-medium text-gray-900">Allow screen sharing for this firm</span>
            <span className="block text-gray-500">
              Turning this off ends any live sessions immediately and hides the feature from everyone in the firm.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.allowInboundCrossFirm !== false}
            onChange={(e) => update.mutate({ allowInboundCrossFirm: e.target.checked })}
            disabled={update.isPending || !effectiveEnabled}
          />
          <span className="text-sm">
            <span className="font-medium text-gray-900">Allow people outside this firm to view our screens</span>
            <span className="block text-gray-500">
              When off, join requests from users who don't belong to this firm are rejected — your users can
              still view screens elsewhere if the other firm permits it. Cross-firm viewers always require a
              second confirmation from the sharer either way.
            </span>
          </span>
        </label>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            Remind your team: only approve a share request from someone you were already talking to. Support
            scams start with an unexpected "can you share your screen?".
          </span>
        </div>
      </div>

      {/* Per-user overrides (2.6, D9) */}
      <UserOverridesSection disabled={!effectiveEnabled} />

      {/* Session log (12.4–12.6) */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Session log</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={crossFirmOnly} onChange={(e) => setCrossFirmOnly(e.target.checked)} />
            Cross-firm only
          </label>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              window.open(`/api/v1/share/admin/sessions?format=csv${crossFirmOnly ? '&crossFirm=1' : ''}`, '_blank');
            }}
          >
            <Download className="h-4 w-4 mr-1" aria-hidden="true" /> CSV
          </Button>
        </div>
      </div>

      {logLoading && <div className="bg-white rounded-lg border p-12 flex justify-center"><LoadingSpinner /></div>}

      {!logLoading && (log?.sessions?.length ?? 0) === 0 && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          No screen-share sessions yet.
        </div>
      )}

      {!logLoading && (log?.sessions?.length ?? 0) > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Started</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Sharer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Viewers</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {log!.sessions.map((row) => {
                const liveNow = ['pending', 'active'].includes(row.session.status);
                return (
                  <tr key={row.session.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmt(row.session.createdAt)}</td>
                    <td className="px-4 py-2 text-gray-900">{row.sharerName}</td>
                    <td className="px-4 py-2">
                      {row.participants.length === 0 && <span className="text-gray-400">none</span>}
                      <ul className="space-y-0.5">
                        {row.participants.map((p) => (
                          <li key={p.id} className="text-gray-700">
                            {p.viewerName}
                            {p.isCrossFirm && (
                              <span className="ml-1 text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 rounded px-1" title={p.viewerFirmName}>
                                {p.viewerFirmName}
                              </span>
                            )}
                            {p.scopeWarningShown && (
                              <span className="ml-1 text-[10px] uppercase tracking-wide bg-red-100 text-red-700 rounded px-1" title="The sharer confirmed an entity-access warning for this viewer">
                                scope warned
                              </span>
                            )}
                            <span className="text-xs text-gray-400"> · {p.status}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{durationOf(row)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${liveNow ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {liveNow ? 'Live' : row.session.endedReason ?? row.session.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {liveNow && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => endSession.mutate(row.session.id)}
                          loading={endSession.isPending && endSession.variables === row.session.id}
                        >
                          <Ban className="h-4 w-4 mr-1" aria-hidden="true" /> Terminate
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
