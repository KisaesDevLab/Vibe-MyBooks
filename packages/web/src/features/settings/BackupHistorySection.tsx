// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Backup History — the persisted backup-run log (backup_runs), rendered on
// the admin System Settings page under the backup configuration cards.
// Shows an at-a-glance health header (last success per kind, red banner
// when the most recent run of a kind failed) and a filterable table of
// runs with per-destination outcomes, verifier results, and expandable
// error detail.
//
// NOTE: no Tailwind dark: variants here — the dark theme is hand-rolled in
// index.css via [data-theme="dark"] remaps of the light-palette classes
// used below (bg-*-100 / text-*-800 badge pairs are all remapped).

import { Fragment, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import {
  History, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert,
} from 'lucide-react';

interface DestinationResult {
  configured?: boolean;
  ok?: boolean;
  error?: string;
  skipped?: string;
  copied?: number;
  failed?: number;
  uploaded?: number;
  partCount?: number;
}

interface BackupRun {
  id: string;
  kind: string;
  tenantId: string | null;
  tenantName: string | null;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  sizeBytes: number | null;
  artifactName: string | null;
  destinations: { local?: DestinationResult; remote?: DestinationResult; mirror?: DestinationResult };
  verify: { ok: boolean; depth?: string; error?: string; warning?: string; at: string } | null;
  error: string | null;
}

interface KindSummary {
  lastSuccessAt: string | null;
  lastRun: { startedAt: string; status: string } | null;
  consecutiveFailures: number;
}

interface RunsResponse {
  runs: BackupRun[];
  total: number;
  limit: number;
  offset: number;
  summary: Record<string, KindSummary>;
}

const KIND_LABELS: Record<string, string> = {
  tenant_backup: 'Tenant',
  system_backup: 'Full system',
  db_backup: 'Database',
  dr_bundle: 'DR bundle',
  verify: 'Verification',
};

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
};

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(run: BackupRun): string {
  if (!run.finishedAt) return run.status === 'running' ? 'running…' : '—';
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return '<1s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/** One compact per-destination badge: name + outcome glyph. */
function DestBadge({ label, dest }: { label: string; dest: DestinationResult | undefined }) {
  if (!dest || dest.configured === false) {
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">{label} —</span>;
  }
  if (dest.ok === false) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-800" title={dest.error || dest.skipped || 'failed'}>
        {label} <XCircle className="h-3 w-3" />
      </span>
    );
  }
  if (dest.ok === true) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800">
        {label} <CheckCircle className="h-3 w-3" />
      </span>
    );
  }
  // Result not (yet) recorded — e.g. a fire-and-forget upload still in flight.
  return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">{label} ?</span>;
}

function describeDest(name: string, dest: DestinationResult | undefined): string | null {
  if (!dest) return null;
  if (dest.configured === false) return `${name}: not configured${dest.skipped ? ` (${dest.skipped})` : ''}`;
  const bits: string[] = [dest.ok === true ? 'ok' : dest.ok === false ? 'FAILED' : 'pending'];
  if (dest.partCount != null && dest.uploaded != null) bits.push(`${dest.uploaded}/${dest.partCount} parts uploaded`);
  else if (dest.partCount != null) bits.push(`${dest.partCount} part(s)`);
  if (dest.copied != null) bits.push(`${dest.copied} copied`);
  if (dest.failed != null && dest.failed > 0) bits.push(`${dest.failed} failed`);
  if (dest.skipped) bits.push(`skipped: ${dest.skipped}`);
  if (dest.error) bits.push(dest.error);
  return `${name}: ${bits.join(', ')}`;
}

// The backup kinds worth surfacing in the health header, in display order.
const HEALTH_KINDS = ['system_backup', 'db_backup', 'tenant_backup'] as const;

export function BackupHistorySection() {
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: String(limit) });
  if (kind) params.set('kind', kind);
  if (status) params.set('status', status);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'backup-runs', kind, status, limit],
    queryFn: () => apiClient<RunsResponse>(`/admin/backup/runs?${params.toString()}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const summary = data?.summary ?? {};
  const failingKinds = HEALTH_KINDS.filter((k) => summary[k]?.lastRun?.status === 'failed');

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-800">Backup History</h2>
      </div>

      {failingKinds.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">The most recent {failingKinds.map((k) => KIND_LABELS[k]?.toLowerCase()).join(', ')} backup failed.</p>
            <p className="text-xs mt-0.5">
              {failingKinds.map((k) => `${KIND_LABELS[k]}: ${summary[k]!.consecutiveFailures} consecutive failure(s)`).join(' · ')}
              {' — '}see the runs below for the error detail.
            </p>
          </div>
        </div>
      )}

      {/* Health header: last success per kind */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {HEALTH_KINDS.map((k) => {
          const s = summary[k];
          const lastFailed = s?.lastRun?.status === 'failed';
          return (
            <div key={k} className={`rounded-lg border p-3 ${lastFailed ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase">{KIND_LABELS[k]} backup</p>
              <p className={`text-sm mt-1 font-medium ${lastFailed ? 'text-red-700' : 'text-gray-900'}`}>
                {s?.lastSuccessAt
                  ? `Last success: ${new Date(s.lastSuccessAt).toLocaleString()}`
                  : 'No successful run recorded'}
              </p>
              {s?.lastRun && s.lastRun.status !== 'success' && (
                <p className="text-xs mt-0.5 text-gray-600">
                  Latest run: {s.lastRun.status} ({new Date(s.lastRun.startedAt).toLocaleString()})
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={kind} onChange={(e) => { setKind(e.target.value); setExpanded(null); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All kinds</option>
          {Object.entries(KIND_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setExpanded(null); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        {data && <span className="text-xs text-gray-500">{data.total} run(s)</span>}
      </div>

      {isLoading && <LoadingSpinner className="py-8" />}
      {isError && <p className="text-sm text-red-600">Failed to load backup history.</p>}

      {data && data.runs.length === 0 && (
        <p className="text-sm text-gray-500 py-4">
          No backup runs recorded yet. Runs appear here as scheduled or manual backups execute.
        </p>
      )}

      {data && data.runs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-6"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kind</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Destinations</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.runs.map((run) => {
                const isOpen = expanded === run.id;
                const destDetails = [
                  describeDest('Local', run.destinations?.local),
                  describeDest('Remote', run.destinations?.remote),
                  describeDest('Mirror', run.destinations?.mirror),
                ].filter(Boolean);
                return (
                  <Fragment key={run.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : run.id)}>
                      <td className="px-3 py-2 text-gray-400">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{new Date(run.startedAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        <div>{KIND_LABELS[run.kind] ?? run.kind}</div>
                        {run.tenantName && <div className="text-xs text-gray-500">{run.tenantName}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{run.trigger}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDuration(run)}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatBytes(run.sizeBytes)}</td>
                      <td className="px-3 py-2">
                        {run.kind === 'verify' ? (
                          <span className="text-xs text-gray-500">—</span>
                        ) : (
                          <span className="inline-flex flex-wrap gap-1">
                            <DestBadge label="Local" dest={run.destinations?.local} />
                            <DestBadge label="Remote" dest={run.destinations?.remote} />
                            <DestBadge label="Mirror" dest={run.destinations?.mirror} />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {run.verify ? (
                          run.verify.ok ? (
                            <span className="inline-flex items-center gap-1 text-green-700 text-xs" title={run.verify.warning || `depth: ${run.verify.depth ?? '?'}`}>
                              <ShieldCheck className="h-4 w-4" /> {run.verify.depth ?? 'ok'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 text-xs" title={run.verify.error}>
                              <ShieldAlert className="h-4 w-4" /> failed
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[run.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {run.status}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td></td>
                        <td colSpan={8} className="px-3 py-2 text-xs text-gray-600 space-y-1">
                          {run.artifactName && <p><span className="font-medium">Artifact:</span> {run.artifactName}</p>}
                          {destDetails.map((d) => <p key={d}>{d}</p>)}
                          {run.verify && (
                            <p>
                              <span className="font-medium">Verifier:</span> {run.verify.ok ? 'ok' : 'FAILED'}
                              {run.verify.depth ? ` (depth: ${run.verify.depth})` : ''} at {new Date(run.verify.at).toLocaleString()}
                              {run.verify.warning ? ` — ${run.verify.warning}` : ''}
                              {run.verify.error ? ` — ${run.verify.error}` : ''}
                            </p>
                          )}
                          {run.error && <p className="text-red-600 break-all"><span className="font-medium">Error:</span> {run.error}</p>}
                          {!run.error && destDetails.length === 0 && !run.verify && !run.artifactName && <p>No further detail recorded.</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.runs.length < data.total && (
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => Math.min(l + 50, 200))}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
