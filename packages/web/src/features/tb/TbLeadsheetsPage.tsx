// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Leadsheets (Phase 7): grouping tree with a review queue of sign-off
// status, per-group workpaper view (five columns + subtotals + drill-
// down), per-cell tickmarks with hover legend, account/TB notes, and
// the preparer/reviewer sign-off workflow with staleness flags.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useTbProfile } from '../../api/hooks/useTb';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { useTbYearOverride, fiscalYearEndFor, useWorkpaper, usd, type TbWorkpaperRow } from './workpaperShared';
import { Download } from 'lucide-react';
import clsx from 'clsx';

interface Grouping {
  id: string;
  name: string;
  leadsheetCode: string | null;
  sortOrder: number;
  accountIds: string[];
}

interface Tickmark { id: string; symbol: string; description: string; color: string | null }
interface TickmarkApplication { id: string; accountId: string; column: string; tickmarkId: string; note: string | null }
interface Note { id: string; accountId: string | null; body: string; resolvedAt: string | null; createdAt: string }
interface Signoff { id: string; groupingId: string; role: 'preparer' | 'reviewer'; signedAt: string; stale: boolean; signedByName: string | null }

const MARK_TONES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700', green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
};

export function TbLeadsheetsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profileData } = useTbProfile();
  const [yearOverride, setYearOverride] = useTbYearOverride();
  const taxYear = yearOverride ?? profileData?.fiscal.currentTaxYear ?? new Date().getFullYear();
  const periodEnd = fiscalYearEndFor(taxYear, profileData?.fiscal.fiscalYearStartMonth ?? 1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markPicker, setMarkPicker] = useState<{ accountId: string; column: string } | null>(null);
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');

  const { data: groupData, isLoading } = useQuery({
    queryKey: ['tb', 'groupings'],
    queryFn: () => apiClient<{ groupings: Grouping[] }>('/tb/groupings'),
  });
  const { data: wpData } = useWorkpaper(periodEnd, basis);
  const { data: marksData } = useQuery({
    queryKey: ['tb', 'tickmarks'],
    queryFn: () => apiClient<{ tickmarks: Tickmark[] }>('/tb/tickmarks'),
  });
  const { data: appsData } = useQuery({
    queryKey: ['tb', 'tickmark-applications', taxYear],
    queryFn: () => apiClient<{ applications: TickmarkApplication[] }>(`/tb/tickmark-applications?taxYear=${taxYear}`),
  });
  const { data: notesData } = useQuery({
    queryKey: ['tb', 'notes', taxYear],
    queryFn: () => apiClient<{ notes: Note[] }>(`/tb/notes?taxYear=${taxYear}`),
  });
  const { data: signoffData } = useQuery({
    queryKey: ['tb', 'signoffs', taxYear],
    queryFn: () => apiClient<{ signoffs: Signoff[] }>(`/tb/signoffs?taxYear=${taxYear}`),
  });

  const invalidate = (...keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: ['tb', k] }));
  const err = (e: unknown) => toast.error(isApiError(e) ? e.message : 'Operation failed');

  const seedDefaults = useMutation({
    mutationFn: () => apiClient('/tb/groupings/seed-defaults', { method: 'POST' }),
    onSuccess: () => invalidate('groupings'),
    onError: err,
  });
  const seedMarks = useMutation({
    mutationFn: () => apiClient('/tb/tickmarks/seed-defaults', { method: 'POST' }),
    onSuccess: () => invalidate('tickmarks'),
    onError: err,
  });
  const signMutation = useMutation({
    mutationFn: (input: { groupingId: string; role: 'preparer' | 'reviewer' }) =>
      apiClient('/tb/signoffs', { method: 'POST', body: JSON.stringify({ ...input, taxYear }) }),
    onSuccess: () => invalidate('signoffs'),
    onError: err,
  });
  const unsignMutation = useMutation({
    mutationFn: (signoffId: string) => apiClient(`/tb/signoffs/${signoffId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate('signoffs'),
    onError: err,
  });
  const applyMark = useMutation({
    mutationFn: (input: { accountId: string; column: string; tickmarkId: string }) =>
      apiClient('/tb/tickmark-applications', { method: 'POST', body: JSON.stringify({ ...input, taxYear }) }),
    onSuccess: () => { invalidate('tickmark-applications'); setMarkPicker(null); },
    onError: err,
  });
  const removeMark = useMutation({
    mutationFn: (id: string) => apiClient(`/tb/tickmark-applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate('tickmark-applications'),
    onError: err,
  });
  const addNote = useMutation({
    mutationFn: (input: { accountId: string | null; body: string }) =>
      apiClient('/tb/notes', { method: 'POST', body: JSON.stringify({ ...input, taxYear }) }),
    onSuccess: () => invalidate('notes'),
    onError: err,
  });
  const resolveNote = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      apiClient(`/tb/notes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolved }) }),
    onSuccess: () => invalidate('notes'),
    onError: err,
  });

  const groupings = groupData?.groupings ?? [];
  const selected = groupings.find((g) => g.id === selectedId) ?? groupings[0] ?? null;
  const rowsById = useMemo(() => new Map((wpData?.workpaper.rows ?? []).map((r) => [r.accountId, r])), [wpData]);
  const marks = marksData?.tickmarks ?? [];
  const marksById = useMemo(() => new Map(marks.map((m) => [m.id, m])), [marks]);
  const apps = appsData?.applications ?? [];
  const notes = notesData?.notes ?? [];
  const signoffs = signoffData?.signoffs ?? [];

  const signoffsFor = (groupingId: string) => signoffs.filter((s) => s.groupingId === groupingId);

  const memberRows: TbWorkpaperRow[] = (selected?.accountIds ?? [])
    .map((id) => rowsById.get(id))
    .filter((r): r is TbWorkpaperRow => !!r)
    .sort((a, b) => (a.accountNumber ?? '').localeCompare(b.accountNumber ?? ''));

  const subtotal = (col: 'unadjusted' | 'aje' | 'adjusted' | 'taxRje' | 'tax') =>
    memberRows.reduce((sum, r) => sum + r[col], 0);

  const [noteDraft, setNoteDraft] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  // Selected leadsheet → PDF via the tb-leadsheets report endpoint
  // (grouping_id scopes it to the one on screen).
  const downloadPdf = async (groupingId: string) => {
    setPdfBusy(true);
    try {
      const params = new URLSearchParams({ as_of_date: periodEnd, basis, grouping_id: groupingId, format: 'pdf' });
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/reports/tb-leadsheets?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Company-Id': localStorage.getItem('activeCompanyId') ?? '',
        },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'leadsheet.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setPdfBusy(false);
    }
  };

  if (isLoading) return <LoadingSpinner className="py-16" />;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leadsheets</h1>
          <p className="text-sm text-gray-500">TY{taxYear} workpapers by grouping — sign-offs stamp the GL version and flag stale on later changes.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={taxYear} aria-label="Tax year"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 2000 && v <= 2100) setYearOverride(v); }}
            className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          <select value={basis} aria-label="Accounting basis"
            onChange={(e) => setBasis(e.target.value as 'accrual' | 'cash')}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </select>
          {marks.length === 0 && (
            <Button variant="secondary" onClick={() => seedMarks.mutate()}>Load standard tickmarks</Button>
          )}
        </div>
      </div>

      {groupings.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-600 mb-3">No groupings yet. Seed the standard leadsheet structure (Cash, AR, Fixed Assets, …) with automatic account membership.</p>
          <Button onClick={() => seedDefaults.mutate()} loading={seedDefaults.isPending}>Seed default leadsheets</Button>
        </div>
      )}

      {groupings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
          {/* ── Review queue / grouping list (7.7) ─────────── */}
          <div className="space-y-4 h-fit">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <h2 className="text-xs uppercase text-gray-500 font-medium px-1 mb-2">Groupings</h2>
              <ul className="space-y-1">
                {groupings.map((g) => {
                  const sigs = signoffsFor(g.id);
                  const prep = sigs.find((s) => s.role === 'preparer');
                  const rev = sigs.find((s) => s.role === 'reviewer');
                  return (
                    <li key={g.id}>
                      <button onClick={() => setSelectedId(g.id)}
                        className={clsx('w-full text-left rounded-lg px-2 py-1.5 text-sm flex items-center justify-between gap-2',
                          selected?.id === g.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50')}>
                        <span className="truncate">
                          {g.leadsheetCode && <span className="font-mono text-xs text-gray-400 mr-1">{g.leadsheetCode}</span>}
                          {g.name}
                          <span className="text-xs text-gray-400 ml-1">({g.accountIds.length})</span>
                        </span>
                        <span className="flex gap-1 shrink-0">
                          <SignBadge label="P" signed={!!prep} stale={prep?.stale} />
                          <SignBadge label="R" signed={!!rev} stale={rev?.stale} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <AddGroupingForm onAdded={() => invalidate('groupings')} />
            </div>
            <UngroupedPanel groupings={groupings} rows={wpData?.workpaper.rows ?? []} onChanged={() => invalidate('groupings')} />
          </div>

          {/* ── Selected leadsheet ─────────────────────────── */}
          {selected && (
            <div className="space-y-4 min-w-0">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h2 className="text-lg font-medium text-gray-900">
                    {selected.leadsheetCode && <span className="font-mono text-sm text-gray-400 mr-2">{selected.leadsheetCode}</span>}
                    {selected.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" disabled={pdfBusy}
                      onClick={() => downloadPdf(selected.id)} title="Download this leadsheet as PDF">
                      <Download className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    {(['preparer', 'reviewer'] as const).map((role) => {
                      const sig = signoffsFor(selected.id).find((s) => s.role === role);
                      return (
                        <Button key={role} size="sm" variant={sig && !sig.stale ? 'secondary' : 'primary'}
                          disabled={signMutation.isPending}
                          onClick={() => signMutation.mutate({ groupingId: selected.id, role })}
                          title={sig?.stale ? 'Signed before subsequent changes — click to re-sign' : undefined}>
                          {sig ? (sig.stale ? `Re-sign (${role})` : `${role} ✓`) : `Sign off (${role})`}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                {signoffsFor(selected.id).length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                    {signoffsFor(selected.id).map((s) => (
                      <span key={s.id} className="flex items-center gap-1.5">
                        <span className="capitalize font-medium">{s.role}:</span>
                        {s.signedByName ?? 'Unknown user'} · {new Date(s.signedAt).toLocaleString()}
                        {s.stale && <span className="text-amber-700 font-medium">(stale)</span>}
                        <button onClick={() => {
                          if (window.confirm(`Remove the ${s.role} sign-off by ${s.signedByName ?? 'unknown user'}? This is recorded in the audit log.`)) {
                            unsignMutation.mutate(s.id);
                          }
                        }} disabled={unsignMutation.isPending}
                          className="text-gray-400 hover:text-red-600" title={`Remove ${s.role} sign-off`} aria-label={`Remove ${s.role} sign-off`}>
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {signoffsFor(selected.id).some((s) => s.stale) && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    Signed before subsequent changes — the GL, AJEs, or tax entries moved after this signature. Review and re-sign.
                  </p>
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3">Acct</th>
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3 text-right">Unadjusted</th>
                      <th className="py-2 pr-3 text-right">AJE</th>
                      <th className="py-2 pr-3 text-right">Adjusted</th>
                      <th className="py-2 pr-3 text-right">Tax RJE</th>
                      <th className="py-2 pr-3 text-right">Tax</th>
                      <th className="py-2">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map((r) => {
                      const rowApps = apps.filter((a) => a.accountId === r.accountId);
                      return (
                        <tr key={r.accountId} className="border-b border-gray-100">
                          <td className="py-1.5 pr-3 font-mono text-xs text-gray-500">{r.accountNumber}</td>
                          <td className="py-1.5 pr-3">
                            <button className="hover:text-blue-700 hover:underline text-left"
                              onClick={() => navigate(`/transactions?account=${r.accountId}&from=${wpData?.workpaper.fyStart ?? ''}&to=${periodEnd}`)}>
                              {r.name}
                            </button>
                          </td>
                          {(['unadjusted', 'aje', 'adjusted', 'taxRje', 'tax'] as const).map((c) => (
                            <td key={c} className="py-1.5 pr-3 text-right font-mono tabular-nums text-xs">
                              {r[c] < 0 ? `(${usd(-r[c])})` : usd(r[c])}
                            </td>
                          ))}
                          <td className="py-1.5 relative">
                            <span className="flex items-center gap-1 flex-wrap">
                              {rowApps.map((a) => {
                                const m = marksById.get(a.tickmarkId);
                                if (!m) return null;
                                return (
                                  <button key={a.id}
                                    className={clsx('text-[11px] px-1.5 py-0.5 rounded font-medium', MARK_TONES[m.color ?? 'gray'] ?? MARK_TONES['gray'])}
                                    title={`${m.description} (${a.column}) — click to remove`}
                                    onClick={() => removeMark.mutate(a.id)}>
                                    {m.symbol}
                                  </button>
                                );
                              })}
                              <button className="text-xs text-gray-400 hover:text-blue-600"
                                onClick={() => setMarkPicker(markPicker?.accountId === r.accountId ? null : { accountId: r.accountId, column: 'adjusted' })}>
                                +
                              </button>
                            </span>
                            {markPicker?.accountId === r.accountId && (
                              <div className="absolute right-0 top-7 z-20 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
                                <div className="flex items-center justify-between mb-1 px-1">
                                  <span className="text-xs text-gray-500">Apply to</span>
                                  <select value={markPicker.column} aria-label="Column"
                                    onChange={(e) => setMarkPicker({ ...markPicker, column: e.target.value })}
                                    className="text-xs rounded border border-gray-300 px-1 py-0.5">
                                    {['unadjusted', 'aje', 'adjusted', 'tax_rje', 'tax'].map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                                <ul className="max-h-56 overflow-y-auto">
                                  {marks.map((m) => (
                                    <li key={m.id}>
                                      <button className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-sm flex items-center gap-2"
                                        onClick={() => applyMark.mutate({ accountId: r.accountId, column: markPicker.column, tickmarkId: m.id })}>
                                        <span className={clsx('text-[11px] px-1.5 py-0.5 rounded font-medium', MARK_TONES[m.color ?? 'gray'] ?? MARK_TONES['gray'])}>{m.symbol}</span>
                                        <span className="text-xs text-gray-600 truncate">{m.description}</span>
                                      </button>
                                    </li>
                                  ))}
                                  {marks.length === 0 && <li className="text-xs text-gray-400 px-2 py-1">Load the standard library first.</li>}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {memberRows.length === 0 && (
                      <tr><td colSpan={8} className="py-4 text-sm text-gray-500">No accounts with activity in this grouping.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-medium">
                      <td className="py-2 pr-3 text-xs uppercase text-gray-500" colSpan={2}>Subtotal</td>
                      {(['unadjusted', 'aje', 'adjusted', 'taxRje', 'tax'] as const).map((c) => {
                        const v = subtotal(c);
                        return <td key={c} className="py-2 pr-3 text-right font-mono tabular-nums text-xs">{v < 0 ? `(${usd(-v)})` : usd(v)}</td>;
                      })}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Notes (7.4) ──────────────────────────────── */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
                <ul className="space-y-2 mb-3">
                  {notes
                    .filter((n) => !n.accountId || selected.accountIds.includes(n.accountId))
                    .map((n) => (
                      <li key={n.id} className={clsx('text-sm flex items-start gap-2', n.resolvedAt && 'opacity-50')}>
                        <input type="checkbox" checked={!!n.resolvedAt} className="mt-1"
                          aria-label="Resolved"
                          onChange={(e) => resolveNote.mutate({ id: n.id, resolved: e.target.checked })} />
                        <span>
                          {n.accountId && <span className="text-xs text-gray-400 mr-1">[{rowsById.get(n.accountId)?.name ?? 'account'}]</span>}
                          {n.body}
                        </span>
                      </li>
                    ))}
                  {notes.length === 0 && <li className="text-sm text-gray-400">No notes for TY{taxYear}.</li>}
                </ul>
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (!noteDraft.trim()) return;
                  addNote.mutate({ accountId: null, body: noteDraft.trim() }, { onSuccess: () => setNoteDraft('') });
                }}>
                  <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add a workpaper note…" className="grow rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  <Button type="submit" size="sm" variant="secondary" disabled={!noteDraft.trim()}>Add</Button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddGroupingForm({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const create = useMutation({
    mutationFn: () => apiClient('/tb/groupings', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), leadsheetCode: code.trim() || null, sortOrder: 1000 }),
    }),
    onSuccess: () => { setName(''); setCode(''); onAdded(); },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Create failed'),
  });
  return (
    <form className="mt-3 flex gap-1.5 px-1" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Z"
        aria-label="Leadsheet code" className="w-10 rounded border border-gray-300 px-1.5 py-1 text-xs font-mono" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New grouping…"
        aria-label="Grouping name" className="grow min-w-0 rounded border border-gray-300 px-2 py-1 text-xs" />
      <button type="submit" className="text-xs text-blue-600 font-medium" disabled={create.isPending || !name.trim()}>Add</button>
    </form>
  );
}

function UngroupedPanel({ groupings, rows, onChanged }: {
  groupings: Grouping[];
  rows: TbWorkpaperRow[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const grouped = new Set(groupings.flatMap((g) => g.accountIds));
  const ungrouped = rows.filter((r) => !r.isVirtualRe && !grouped.has(r.accountId));
  const move = useMutation({
    mutationFn: ({ accountId, groupingId }: { accountId: string; groupingId: string }) =>
      apiClient(`/tb/groupings/membership/${accountId}`, { method: 'PUT', body: JSON.stringify({ groupingId }) }),
    onSuccess: onChanged,
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Move failed'),
  });
  if (ungrouped.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <h2 className="text-xs uppercase text-amber-700 font-medium px-1 mb-2">Ungrouped ({ungrouped.length})</h2>
      <ul className="space-y-1.5">
        {ungrouped.map((r) => (
          <li key={r.accountId} className="flex items-center justify-between gap-2 text-xs px-1">
            <span className="truncate">{r.accountNumber} {r.name}</span>
            <select defaultValue="" aria-label={`Grouping for ${r.name}`}
              onChange={(e) => e.target.value && move.mutate({ accountId: r.accountId, groupingId: e.target.value })}
              className="rounded border border-gray-300 px-1 py-0.5 text-xs max-w-[120px]">
              <option value="" disabled>Assign…</option>
              {groupings.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignBadge({ label, signed, stale }: { label: string; signed: boolean; stale?: boolean }) {
  return (
    <span className={clsx('text-[10px] w-5 h-5 inline-flex items-center justify-center rounded-full font-medium',
      !signed ? 'bg-gray-100 text-gray-400'
        : stale ? 'bg-amber-100 text-amber-700'
          : 'bg-green-100 text-green-700')}
      title={!signed ? 'Not signed' : stale ? 'Signed before subsequent changes' : 'Signed'}>
      {label}
    </span>
  );
}
