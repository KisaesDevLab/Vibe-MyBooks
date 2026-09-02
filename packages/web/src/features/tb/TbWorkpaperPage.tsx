// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// TB workpaper screen (Phase 6.1–6.7): five-column grid with DR/CR &
// basis toggles, live PY comparative, inline tax-code assignment,
// activity view, diagnostics panel (+ advisory AI warnings), drill-
// down, workflow state, per-user prefs, and the popout launcher (6B).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useTbProfile } from '../../api/hooks/useTb';
import { useActivityUnits } from '../../api/hooks/useTb';
import { useMe } from '../../api/hooks/useAuth';
import { useTags } from '../../api/hooks/useTags';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { useSessionState } from '../../hooks/useSessionState';
import { ExternalLink, AlertTriangle, Download } from 'lucide-react';
import { TbWorkpaperGrid, TB_VIEW_BY_TAG, type TbGridPrefs } from './TbWorkpaperGrid';
import { buildCellMarks, TickmarkCellPicker } from './TickmarkCellPicker';
import {
  activeCompanyId, fiscalYearEndFor, openTbPopout, useTbDiagnostics,
  useTbYearOverride, useWorkpaper,
} from './workpaperShared';

// Per-user prefs (6.7) ride users.displayPreferences.tb via the
// merge-patch preferences endpoint.
interface TbPrefsState extends TbGridPrefs {
  basis: 'accrual' | 'cash';
}

const DEFAULT_PREFS: TbPrefsState = {
  drCrMode: true, showPy: false, showTax: true, nonZeroOnly: false, activityView: '', basis: 'accrual',
};

export function TbWorkpaperPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: meData } = useMe();
  const companyCtx = useCompanyContext();
  const companyId = companyCtx?.activeCompanyId ?? activeCompanyId();

  const { data: profileData } = useTbProfile();
  // Session-persisted period: an explicit date wins; otherwise follow
  // the module-wide tax-year override, then the profile's current FY.
  const [yearOverride] = useTbYearOverride();
  const [periodEnd, setPeriodEnd] = useSessionState('vibe:tb:periodEnd', '');
  const defaultPeriodEnd = profileData
    ? fiscalYearEndFor(yearOverride ?? profileData.fiscal.currentTaxYear, profileData.fiscal.fiscalYearStartMonth)
    : `${new Date().getFullYear()}-12-31`;
  const effPeriodEnd = periodEnd || defaultPeriodEnd;

  // Prefs: seed from server displayPreferences.tb once, persist on change.
  const serverPrefs = (meData?.user as { displayPreferences?: { tb?: Partial<TbPrefsState> } } | undefined)?.displayPreferences?.tb;
  const [prefs, setPrefs] = useState<TbPrefsState>({ ...DEFAULT_PREFS });
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && serverPrefs) {
      setPrefs((p) => ({ ...p, ...serverPrefs }));
      seeded.current = true;
    }
  }, [serverPrefs]);
  const savePrefs = (next: TbPrefsState) => {
    setPrefs(next);
    // Patch the cached /auth/me too — otherwise a remount within the
    // staleTime window re-seeds from the old server copy and visibly
    // reverts the user's toggle.
    queryClient.setQueryData(['me'], (prev: unknown) => {
      if (!prev || typeof prev !== 'object') return prev;
      const me = prev as { user?: { displayPreferences?: Record<string, unknown> } };
      if (!me.user) return prev;
      return {
        ...me,
        user: { ...me.user, displayPreferences: { ...(me.user.displayPreferences ?? {}), tb: next } },
      };
    });
    apiClient('/auth/me/preferences', { method: 'PUT', body: JSON.stringify({ tb: next }) }).catch(() => undefined);
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [tagFilter, setTagFilter] = useSessionState<string>('vibe:tb:tagFilter', '');
  const { data: tagsData } = useTags({ isActive: true });
  const { data: wpData, isLoading, isError, refetch } = useWorkpaper(effPeriodEnd, prefs.basis, true, tagFilter || null);
  const { data: diagData } = useTbDiagnostics(effPeriodEnd, prefs.basis);
  const { data: unitsData } = useActivityUnits();
  const pyEnd = profileData ? profileData.fiscal.priorFiscalYearEnd : null;
  const { data: pyData } = useWorkpaper(pyEnd ?? '', prefs.basis, prefs.showPy && !!pyEnd, tagFilter || null);

  const taxYear = wpData?.workpaper.taxYear ?? new Date().getFullYear();
  const { data: statusData } = useQuery({
    queryKey: ['tb', 'status', taxYear],
    enabled: !!wpData,
    queryFn: () => apiClient<{ status: { workflowState: string } }>(`/tb/status?taxYear=${taxYear}`),
  });

  const setStatus = useMutation({
    mutationFn: (workflowState: string) =>
      apiClient('/tb/status', { method: 'PUT', body: JSON.stringify({ taxYear, workflowState }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'status'] }),
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Status change failed'),
  });

  const unitNames = useMemo(() => new Map(
    (unitsData?.units ?? []).map((u) => [u.id, `${u.displayName}`]),
  ), [unitsData]);
  const unitNumbers = useMemo(() => new Map(
    (unitsData?.units ?? []).map((u) => [u.id, u.instanceNumber]),
  ), [unitsData]);

  // LS Ref + Tickmark columns: leadsheet membership and the tax year's
  // applied tickmarks (assignment moved to the Tax Mapping screen).
  const { data: groupData } = useQuery({
    queryKey: ['tb', 'groupings'],
    queryFn: () => apiClient<{ groupings: Array<{ id: string; name: string; leadsheetCode: string | null; accountIds: string[] }> }>('/tb/groupings'),
  });
  const { data: marksData } = useQuery({
    queryKey: ['tb', 'tickmarks'],
    queryFn: () => apiClient<{ tickmarks: Array<{ id: string; symbol: string; description: string; color: string | null }> }>('/tb/tickmarks'),
  });
  const { data: appsData } = useQuery({
    queryKey: ['tb', 'tickmark-applications', taxYear],
    enabled: !!wpData,
    queryFn: () => apiClient<{ applications: Array<{ id: string; accountId: string; column: string; tickmarkId: string }> }>(`/tb/tickmark-applications?taxYear=${taxYear}`),
  });
  const cellMarks = useMemo(
    () => buildCellMarks(appsData?.applications, marksData?.tickmarks as Array<{ id: string; symbol: string; description: string; color: string | null }> | undefined),
    [appsData, marksData],
  );
  const [pickAccount, setPickAccount] = useState<{ accountId: string; accountName: string } | null>(null);

  const wpRefByAccount = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    for (const g of groupData?.groupings ?? []) {
      for (const accountId of g.accountIds) {
        m.set(accountId, { code: g.leadsheetCode ?? '·', name: g.name });
      }
    }
    return m;
  }, [groupData]);

  const marksByAccount = useMemo(() => {
    const lib = new Map((marksData?.tickmarks ?? []).map((t) => [t.id, t]));
    const m = new Map<string, Array<{ symbol: string; description: string }>>();
    for (const a of appsData?.applications ?? []) {
      const mark = lib.get(a.tickmarkId);
      if (!mark) continue;
      const list = m.get(a.accountId) ?? [];
      if (!list.some((x) => x.symbol === mark.symbol)) list.push({ symbol: mark.symbol, description: mark.description });
      m.set(a.accountId, list);
    }
    return m;
  }, [marksData, appsData]);

  const diagnostics = diagData?.diagnostics ?? [];
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const workflowState = statusData?.status.workflowState ?? 'open';

  // ── Download what's on screen ───────────────────────────────
  // CSV/PDF ride the tb-workpaper report; Excel rides the Working TB
  // export. Both take the current period, basis, tag filter, activity
  // view and toolbar filters so the file foots to the grid.
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!downloadOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!downloadRef.current?.contains(e.target as Node)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [downloadOpen]);
  const [downloading, setDownloading] = useState(false);

  const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    'X-Company-Id': localStorage.getItem('activeCompanyId') ?? '',
  });
  const downloadScreen = async (format: 'csv' | 'pdf' | 'xlsx') => {
    setDownloadOpen(false);
    setDownloading(true);
    try {
      if (format === 'xlsx') {
        const res = await apiClient<{ export: { id: string; fileName: string } }>('/tb/exports', {
          method: 'POST',
          body: JSON.stringify({
            taxYear: wpData?.workpaper.taxYear, basis: prefs.basis, software: 'workingtb',
            periodEnd: effPeriodEnd, tagId: tagFilter || undefined,
            view: { activityView: prefs.activityView, accountType: typeFilter, search, nonZeroOnly: prefs.nonZeroOnly },
          }),
        });
        queryClient.invalidateQueries({ queryKey: ['tb', 'exports'] });
        const file = await fetch(`${import.meta.env.BASE_URL}api/v1/tb/exports/${res.export.id}/download`, { headers: authHeaders() });
        if (!file.ok) throw new Error('Download failed');
        saveBlob(await file.blob(), res.export.fileName);
        return;
      }
      const params = new URLSearchParams({ as_of_date: effPeriodEnd, basis: prefs.basis, format });
      if (tagFilter) params.set('tag_id', tagFilter);
      if (prefs.activityView) params.set('activity_view', prefs.activityView);
      if (typeFilter) params.set('account_type', typeFilter);
      if (search.trim()) params.set('q', search.trim());
      if (prefs.nonZeroOnly) params.set('nonzero_only', '1');
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/reports/tb-workpaper?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Download failed');
      saveBlob(await res.blob(), `tb-workpaper-${effPeriodEnd}${prefs.activityView === TB_VIEW_BY_TAG ? '-by-tag' : ''}.${format}`);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Trial Balance</h1>
          <p className="text-sm text-gray-500">
            {wpData ? `${wpData.workpaper.rows.length} accounts · TY${wpData.workpaper.taxYear} · FY ${wpData.workpaper.fyStart} → ${wpData.workpaper.periodEnd}` : ' '}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={workflowState} aria-label="Workflow status"
            onChange={(e) => setStatus.mutate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="complete">Complete</option>
          </select>
          <Button variant="secondary" onClick={() => navigate('/tb/ajes/new')}>New AJE</Button>
          <div className="relative" ref={downloadRef}>
            <Button variant="secondary" onClick={() => setDownloadOpen((v) => !v)} disabled={!wpData || downloading}
              title="Download the trial balance as shown on screen">
              <Download className="h-4 w-4 mr-1" />{downloading ? 'Preparing…' : 'Download'}
            </Button>
            {downloadOpen && (
              <div className="absolute right-0 mt-2 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-2 text-sm">
                <div className="px-3 pb-2 text-xs text-gray-500">
                  As shown: {prefs.basis} · {effPeriodEnd}
                  {prefs.activityView === TB_VIEW_BY_TAG ? ' · by tag / unit #' : prefs.activityView ? ` · ${unitNames.get(prefs.activityView) ?? 'unit'}` : ''}
                  {tagFilter ? ' · tag filter' : ''}{typeFilter || search.trim() || prefs.nonZeroOnly ? ' · filtered' : ''}
                </div>
                {([['csv', 'CSV'], ['pdf', 'PDF'], ['xlsx', 'Excel (Working TB)']] as const).map(([fmt, label]) => (
                  <button key={fmt} type="button" onClick={() => downloadScreen(fmt)}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" onClick={() => openTbPopout(companyId)} title="Open a live read-only popout window">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts…" className="rounded-lg border border-gray-300 px-3 py-1.5 w-52" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Category filter"
          className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="">All categories</option>
          <option value="asset">Assets</option>
          <option value="liability">Liabilities</option>
          <option value="equity">Equity</option>
          <option value="revenue">Revenue</option>
          <option value="cogs">Cost of Goods Sold</option>
          <option value="expense">Expenses</option>
          <option value="other_revenue">Other Income</option>
          <option value="other_expense">Other Expenses</option>
        </select>
        <select value={tagFilter} aria-label="Tag filter"
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="">All tags</option>
          {(tagsData?.tags ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={prefs.activityView} aria-label="Activity view"
          onChange={(e) => savePrefs({ ...prefs, activityView: e.target.value })}
          className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="">Consolidated</option>
          <option value={TB_VIEW_BY_TAG}>By tag / unit #</option>
          {(unitsData?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </select>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!prefs.drCrMode} onChange={(e) => savePrefs({ ...prefs, drCrMode: !e.target.checked })} />
          Single
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={prefs.showPy} onChange={(e) => savePrefs({ ...prefs, showPy: e.target.checked })} />
          PY
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={prefs.showTax} onChange={(e) => savePrefs({ ...prefs, showTax: e.target.checked })} />
          Tax
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={prefs.nonZeroOnly} onChange={(e) => savePrefs({ ...prefs, nonZeroOnly: e.target.checked })} />
          Non-zero only
        </label>
        <select value={prefs.basis} aria-label="Accounting basis"
          onChange={(e) => savePrefs({ ...prefs, basis: e.target.value as 'accrual' | 'cash' })}
          className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="accrual">Accrual</option>
          <option value="cash">Cash</option>
        </select>
        <input type="date" value={effPeriodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
          aria-label="Period end" className="rounded-lg border border-gray-300 px-2 py-1.5" />
        <button onClick={() => setShowDiagnostics((s) => !s)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 border ${diagData?.errorCount ? 'border-red-300 bg-red-50 text-red-700' : diagData?.warningCount ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 text-gray-500'}`}>
          <AlertTriangle className="h-4 w-4" />
          {diagData ? `${diagData.errorCount} / ${diagData.warningCount}` : '…'}
        </button>
      </div>

      <ClosedPeriodBanner />

      {/* ── Diagnostics panel (6.4) ────────────────────────── */}
      {showDiagnostics && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-900 mb-2">Diagnostics</h2>
          {diagnostics.length === 0 && <p className="text-sm text-green-700">All checks pass.</p>}
          <ul className="space-y-1">
            {diagnostics.map((d, i) => (
              <li key={i} className={`text-sm ${d.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                {d.severity === 'error' ? '●' : '○'} {d.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && <LoadingSpinner className="py-16" />}
      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to compute the trial balance. <button onClick={() => refetch()} className="underline font-medium">Retry</button>
        </div>
      )}
      {wpData && (
        <TbWorkpaperGrid
          workpaper={wpData.workpaper}
          pyRows={prefs.showPy && pyData ? pyData.workpaper.rows : undefined}
          prefs={prefs}
          search={search}
          typeFilter={typeFilter}
          unitNames={unitNames}
          unitNumbers={unitNumbers}
          unitNumberPlacement={profileData?.profile?.unitNumberPlacement ?? 'suffix'}
          onAmountClick={(row, column) => {
            // 6.5 drill-down, respecting the column filter and TB period.
            const params = new URLSearchParams({ account: row.accountId });
            if (column === 'aje') params.set('type', 'aje');
            params.set('from', wpData.workpaper.fyStart);
            params.set('to', effPeriodEnd);
            navigate(`/transactions?${params}`);
          }}
          cellMarks={cellMarks}
          extraHeaders={<>
            <th className="px-2 py-2 text-left">LS Ref</th>
            <th className="px-2 py-2 text-left">Tickmark</th>
          </>}
          renderRowExtra={(row) => {
            if (row.isVirtualRe) {
              return <><td className="px-2 py-1.5 text-xs text-gray-400">—</td><td className="px-2 py-1.5 text-xs text-gray-400">—</td></>;
            }
            const ref = wpRefByAccount.get(row.accountId);
            const marks = marksByAccount.get(row.accountId) ?? [];
            return (
              <>
                <td className="px-2 py-1.5">
                  {ref ? (
                    <button className="font-mono text-xs text-blue-700 hover:underline" title={ref.name}
                      onClick={() => navigate('/tb/leadsheets')}>
                      {ref.code}
                    </button>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <button
                    className="text-left hover:bg-gray-100 rounded px-1 py-0.5"
                    title="Apply or remove tickmarks"
                    onClick={() => setPickAccount({ accountId: row.accountId, accountName: row.name })}>
                    {marks.length > 0
                      ? marks.map((m) => (
                        <span key={m.symbol} title={m.description}
                          className="inline-flex items-center justify-center h-5 min-w-5 px-1 mr-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                          {m.symbol}
                        </span>
                      ))
                      : <span className="text-xs text-gray-400 underline decoration-dotted">add</span>}
                  </button>
                </td>
              </>
            );
          }}
        />
      )}

      {pickAccount && (
        <TickmarkCellPicker
          accountId={pickAccount.accountId}
          accountName={pickAccount.accountName}
          taxYear={taxYear}
          initialColumn="adjusted"
          allowColumnChange
          onClose={() => setPickAccount(null)}
        />
      )}
    </div>
  );
}

// ── "Closed period modified since close" banner (10.5) ──────────────

function ClosedPeriodBanner() {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ['tb', 'closed-period-changes'],
    queryFn: () => apiClient<{
      closingDate: string | null;
      total: number;
      changes: Array<{ id: string; txn_type: string; txn_date: string; memo: string | null; total: string | null }>;
    }>('/tb/closed-period-changes'),
  });
  if (!data?.closingDate || data.total === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <button className="font-medium" onClick={() => setExpanded((e) => !e)}>
        ⚠ Closed period modified since close — {data.total} transaction{data.total === 1 ? '' : 's'} dated on or before {data.closingDate} changed after it was closed. {expanded ? '▴' : '▾'}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {data.changes.map((c) => (
            <li key={c.id}>
              <a href={`${import.meta.env.BASE_URL}transactions/${c.id}`} className="underline">
                {c.txn_date} · {c.txn_type}{c.memo ? ` — ${c.memo}` : ''}{c.total ? ` (${Number(c.total).toLocaleString('en-US', { style: 'currency', currency: 'USD' })})` : ''}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
