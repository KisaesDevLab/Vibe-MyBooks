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
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { SearchableDropdown, type DropdownOption } from '../../components/forms/SearchableDropdown';
import { ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { TbWorkpaperGrid, type TbGridPrefs } from './TbWorkpaperGrid';
import {
  activeCompanyId, openTbPopout, publishTbChange, resolveAssignment,
  useAvailableCodes, useTbAssignmentsQuery, useTbDiagnostics, useWorkpaper,
  type TbWorkpaperRow,
} from './workpaperShared';

interface AiSuggestion {
  accountId: string;
  accountName: string;
  accountNumber: string | null;
  code: string;
  activityType: string;
  description: string;
  confidence: number;
}

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
  const defaultPeriodEnd = profileData?.fiscal.currentFiscalYearEnd ?? `${new Date().getFullYear()}-12-31`;
  const [periodEnd, setPeriodEnd] = useState('');
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
    apiClient('/auth/me/preferences', { method: 'PUT', body: JSON.stringify({ tb: next }) }).catch(() => undefined);
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAi, setShowAi] = useState(false);

  const { data: wpData, isLoading, isError, refetch } = useWorkpaper(effPeriodEnd, prefs.basis);
  const { data: assignData } = useTbAssignmentsQuery();
  const { data: codesData, error: codesError } = useAvailableCodes();
  const { data: diagData } = useTbDiagnostics(effPeriodEnd, prefs.basis);
  const { data: unitsData } = useActivityUnits();
  const pyEnd = profileData ? profileData.fiscal.priorFiscalYearEnd : null;
  const { data: pyData } = useWorkpaper(pyEnd ?? '', prefs.basis, prefs.showPy && !!pyEnd);

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

  const assign = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiClient('/tb/assignments', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
      publishTbChange(companyId);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Assignment failed'),
  });

  const unitNames = useMemo(() => new Map(
    (unitsData?.units ?? []).map((u) => [u.id, `${u.displayName}`]),
  ), [unitsData]);

  // Tax-code picker options, filtered per row activity context lazily.
  const codeOptions = useMemo<DropdownOption[]>(() => {
    if (!codesData) return [];
    return [
      ...codesData.seedCodes.map((c) => ({
        id: `seed|${c.activityType}|${c.code}`,
        label: `${c.code}`,
        sublabel: c.description,
        group: c.activityType,
      })),
      ...codesData.firmCodes.map((c) => ({
        id: `firm|${c.id}`,
        label: c.code,
        sublabel: c.description,
        group: 'firm custom',
      })),
    ];
  }, [codesData]);

  const assignments = assignData?.assignments ?? [];

  const onPickCode = (row: TbWorkpaperRow, optionId: string) => {
    if (!optionId) return;
    const [kind, a, b] = optionId.split('|');
    if (kind === 'seed') {
      assign.mutate({ accountId: row.accountId, seedCode: b, seedActivityType: a, activityUnitType: 'common' });
    } else {
      assign.mutate({ accountId: row.accountId, firmCodeId: a, activityUnitType: 'common' });
    }
  };

  const diagnostics = diagData?.diagnostics ?? [];
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const workflowState = statusData?.status.workflowState ?? 'open';

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
          <Button variant="secondary" onClick={() => setShowAi(true)}>
            <Sparkles className="h-4 w-4 mr-1" /> Auto-assign
          </Button>
          <Button variant="secondary" onClick={() => navigate('/tb/ajes/new')}>New AJE</Button>
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
          <option value="expense">Expenses</option>
        </select>
        <select value={prefs.activityView} aria-label="Activity view"
          onChange={(e) => savePrefs({ ...prefs, activityView: e.target.value })}
          className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="">Consolidated</option>
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

      {codesError != null && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-800">
          {isApiError(codesError) ? codesError.message : 'Tax codes unavailable'} — set the return form in <button className="underline" onClick={() => navigate('/tb/settings')}>TB Settings</button>.
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
          pyByAccount={prefs.showPy && pyData ? new Map(pyData.workpaper.rows.map((r) => [r.accountId, r.adjusted])) : undefined}
          prefs={prefs}
          search={search}
          typeFilter={typeFilter}
          unitNames={unitNames}
          onAmountClick={(row, column) => {
            // 6.5 drill-down, respecting the column filter.
            const params = new URLSearchParams({ accountId: row.accountId });
            if (column === 'aje') params.set('txnType', 'aje');
            navigate(`/transactions?${params}`);
          }}
          extraHeaders={<th className="px-2 py-2 text-left">Tax Code</th>}
          renderRowExtra={(row) => {
            if (row.isVirtualRe) return <td className="px-2 py-1.5 text-xs text-gray-400">—</td>;
            const current = resolveAssignment(assignments, row.accountId, prefs.activityView || null);
            const currentId = current
              ? current.firmCodeId ? `firm|${current.firmCodeId}` : `seed|${current.seedActivityType}|${current.seedCode}`
              : '';
            const currentLabel = current ? (current.seedCode ?? 'FIRM code') : '';
            return (
              <td className="px-2 py-1 min-w-[180px]">
                <SearchableDropdown
                  options={codeOptions}
                  value={currentId}
                  selectedLabel={currentLabel}
                  onChange={(id) => onPickCode(row, id)}
                  placeholder="Assign…"
                  compact
                />
                {current?.source === 'ai' && (
                  <span className="ml-1 text-[10px] text-purple-600" title={`AI-assigned (${current.aiConfidence ?? '?'}% confidence)`}>AI</span>
                )}
              </td>
            );
          }}
        />
      )}

      {showAi && wpData && (
        <TbAiPanel
          periodEnd={effPeriodEnd}
          basis={prefs.basis}
          onClose={() => setShowAi(false)}
          onAccepted={() => {
            queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
            queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
            publishTbChange(companyId);
          }}
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

// ── AI suggestion review panel (6C.4) ───────────────────────────────

function TbAiPanel({ periodEnd, basis, onClose, onAccepted }: {
  periodEnd: string;
  basis: 'accrual' | 'cash';
  onClose: () => void;
  onAccepted: () => void;
}) {
  const toast = useToast();
  const [threshold, setThreshold] = useState(80);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const suggest = useQuery({
    queryKey: ['tb', 'ai-suggest', periodEnd, basis],
    retry: false,
    queryFn: () => apiClient<{ suggestions: AiSuggestion[] }>('/tb/ai/suggest-assignments', {
      method: 'POST', body: JSON.stringify({ periodEnd, basis }),
    }),
  });

  const accept = useMutation({
    mutationFn: (s: AiSuggestion) => apiClient('/tb/assignments', {
      method: 'PUT',
      body: JSON.stringify({
        accountId: s.accountId,
        seedCode: s.code,
        seedActivityType: s.activityType,
        activityUnitType: 'common',
        source: 'ai',
        aiConfidence: s.confidence,
      }),
    }),
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Accept failed'),
  });

  const pending = (suggest.data?.suggestions ?? []).filter((s) => !accepted.has(s.accountId));

  const acceptOne = async (s: AiSuggestion) => {
    await accept.mutateAsync(s);
    setAccepted((prev) => new Set(prev).add(s.accountId));
    onAccepted();
  };

  const acceptAll = async () => {
    const targets = pending.filter((s) => s.confidence >= threshold);
    for (const s of targets) {
      try {
        await accept.mutateAsync(s);
        setAccepted((prev) => new Set(prev).add(s.accountId));
      } catch {
        // per-row toast already fired; keep going
      }
    }
    onAccepted();
    toast.success(`Accepted ${targets.length} suggestions`);
  };

  const confidenceTone = (c: number) =>
    c >= 90 ? 'bg-green-100 text-green-700' : c >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">AI tax-code suggestions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
        </div>
        <div className="p-5 overflow-y-auto grow">
          {suggest.isLoading && <div className="py-8 text-center"><LoadingSpinner /> <p className="text-sm text-gray-500 mt-2">Analyzing unassigned accounts…</p></div>}
          {suggest.isError && (
            <p className="text-sm text-red-700">{isApiError(suggest.error) ? suggest.error.message : 'AI suggestion failed'}</p>
          )}
          {suggest.data && suggest.data.suggestions.length === 0 && (
            <p className="text-sm text-gray-500">Nothing to suggest — every account already has a tax code.</p>
          )}
          {pending.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Suggested code</th>
                  <th className="py-2 pr-3">Confidence</th>
                  <th className="py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {pending.map((s) => (
                  <tr key={s.accountId} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{s.accountNumber ? `${s.accountNumber} ` : ''}{s.accountName}</td>
                    <td className="py-2 pr-3"><span className="font-mono text-xs">{s.code}</span> <span className="text-gray-500 text-xs">{s.description}</span></td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceTone(s.confidence)}`}>{s.confidence}%</span>
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="secondary" disabled={accept.isPending} onClick={() => acceptOne(s)}>Accept</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {pending.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Accept all at ≥
              <input type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" />%
            </label>
            <Button onClick={acceptAll} disabled={accept.isPending}>
              Accept {pending.filter((s) => s.confidence >= threshold).length} suggestions
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
