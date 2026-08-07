// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Mapping (mirrors the Vibe TB mapping screen): mapped-progress
// bar, Show All / Unmapped / Mapped filters, accounts grouped by type
// with per-row tax-code picker, source + confidence badges, and the
// Auto-assign AI panel (relocated here from the workpaper view).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useTbProfile } from '../../api/hooks/useTb';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { SearchableDropdown, type DropdownOption } from '../../components/forms/SearchableDropdown';
import { Sparkles, X } from 'lucide-react';
import { useTbYearOverride,
  activeCompanyId, fiscalYearEndFor, publishTbChange, resolveAssignment, usd,
  useAvailableCodes, useTbAssignmentsQuery, useWorkpaper,
  type TbAssignment, type TbWorkpaperRow,
} from './workpaperShared';
import clsx from 'clsx';

interface AiSuggestion {
  accountId: string;
  accountName: string;
  accountNumber: string | null;
  code: string;
  activityType: string;
  description: string;
  confidence: number;
}

type MapFilter = 'all' | 'unmapped' | 'mapped';

const TYPE_SECTIONS: Array<{ type: string; label: string }> = [
  { type: 'asset', label: 'Assets' },
  { type: 'liability', label: 'Liabilities' },
  { type: 'equity', label: 'Equity' },
  { type: 'revenue', label: 'Revenue' },
  { type: 'cogs', label: 'Cost of Goods Sold' },
  { type: 'expense', label: 'Expenses' },
  { type: 'other_revenue', label: 'Other Income' },
  { type: 'other_expense', label: 'Other Expenses' },
];

export function TbMappingPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const companyCtx = useCompanyContext();
  const companyId = companyCtx?.activeCompanyId ?? activeCompanyId();

  const { data: profileData } = useTbProfile();
  const [yearOverride, setYearOverride] = useTbYearOverride();
  const taxYear = yearOverride ?? profileData?.fiscal.currentTaxYear ?? new Date().getFullYear();
  const periodEnd = fiscalYearEndFor(taxYear, profileData?.fiscal.fiscalYearStartMonth ?? 1);

  const [filter, setFilter] = useState<MapFilter>('all');
  const [search, setSearch] = useState('');
  const [showAi, setShowAi] = useState(false);

  const { data: wpData, isLoading, isError, refetch } = useWorkpaper(periodEnd, 'accrual');
  const { data: assignData } = useTbAssignmentsQuery();
  const { data: codesData, error: codesError } = useAvailableCodes();

  const assignments = assignData?.assignments ?? [];

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

  const clear = useMutation({
    mutationFn: (accountId: string) =>
      apiClient(`/tb/assignments/${accountId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
      publishTbChange(companyId);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Clear failed'),
  });

  const codeOptions = useMemo<DropdownOption[]>(() => {
    if (!codesData) return [];
    return [
      ...codesData.seedCodes.map((c) => ({
        id: `seed|${c.activityType}|${c.code}`,
        label: `${c.code} — ${c.description}`,
        group: c.activityType,
      })),
      ...codesData.firmCodes.map((c) => ({
        id: `firm|${c.id}`,
        label: `${c.code} — ${c.description}`,
        group: 'firm custom',
      })),
    ];
  }, [codesData]);

  const codeLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of codesData?.seedCodes ?? []) m.set(`seed|${c.activityType}|${c.code}`, `${c.code} — ${c.description}`);
    for (const c of codesData?.firmCodes ?? []) m.set(`firm|${c.id}`, `${c.code} — ${c.description}`);
    return m;
  }, [codesData]);

  const onPickCode = (row: TbWorkpaperRow, optionId: string) => {
    if (!optionId) return;
    const [kind, a, b] = optionId.split('|');
    if (kind === 'seed') {
      assign.mutate({ accountId: row.accountId, seedCode: b, seedActivityType: a, activityUnitType: 'common' });
    } else {
      assign.mutate({ accountId: row.accountId, firmCodeId: a, activityUnitType: 'common' });
    }
  };

  // Mapping progress over real accounts (the virtual RE fold row has no
  // assignment surface).
  const rows = useMemo(() => (wpData?.workpaper.rows ?? []).filter((r) => !r.isVirtualRe), [wpData]);
  const isMapped = (r: TbWorkpaperRow) => !!resolveAssignment(assignments, r.accountId, null);
  const mappedCount = rows.filter(isMapped).length;
  const pct = rows.length > 0 ? Math.round((mappedCount / rows.length) * 100) : 0;

  const visible = rows.filter((r) => {
    if (filter === 'unmapped' && isMapped(r)) return false;
    if (filter === 'mapped' && !isMapped(r)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !(r.accountNumber ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const confidenceTone = (c: number) =>
    c >= 90 ? 'bg-green-100 text-green-700' : c >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700';

  const sourceBadge = (a: TbAssignment) => a.source === 'ai'
    ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">AI</span>
    : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Manual</span>;

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tax Mapping</h1>
          <p className="text-sm text-gray-500">
            {codesData ? `${codesData.returnForm} · ${codesData.activityType.replace('_', ' ')} · ` : ''}
            {wpData ? `TY${wpData.workpaper.taxYear} · FY ${wpData.workpaper.fyStart} → ${wpData.workpaper.periodEnd}` : ' '}
          </p>
        </div>
        <Button onClick={() => setShowAi(true)}>
          <Sparkles className="h-4 w-4 mr-1" /> Auto-assign Tax Codes
        </Button>
      </div>

      {/* ── Progress ───────────────────────────────────────── */}
      <div className="mb-4">
        <p className={clsx('text-sm font-medium mb-1', pct === 100 ? 'text-green-700' : 'text-gray-700')}>
          {mappedCount} of {rows.length} accounts mapped ({pct}%)
        </p>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : 'bg-blue-500')}
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([['all', 'Show All'], ['unmapped', 'Unmapped Only'], ['mapped', 'Mapped Only']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={clsx('rounded-lg px-3 py-1.5 text-sm border',
              filter === key ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input type="number" value={taxYear} aria-label="Tax year"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 2000 && v <= 2100) setYearOverride(v); }}
            className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-52" />
        </div>
      </div>

      {codesError != null && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-800">
          {isApiError(codesError) ? codesError.message : 'Tax codes unavailable'} — set the return form in <button className="underline" onClick={() => navigate('/tb/settings')}>TB Settings</button>.
        </div>
      )}

      {isLoading && <LoadingSpinner className="py-16" />}
      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load accounts. <button onClick={() => refetch()} className="underline font-medium">Retry</button>
        </div>
      )}

      {wpData && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2 w-20">Acct #</th>
                <th className="px-3 py-2">Account Name</th>
                <th className="px-3 py-2 text-right w-36">Balance</th>
                <th className="px-3 py-2 min-w-[260px]">Tax Code</th>
                <th className="px-3 py-2 w-20">Source</th>
                <th className="px-3 py-2 w-28">Confidence</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {[...TYPE_SECTIONS,
                // Safety net: an account type outside the catalog must
                // still render, never silently disappear.
                { type: '__other__', label: 'Other' },
              ].map(({ type, label }) => {
                const sectionRows = type === '__other__'
                  ? visible.filter((r) => !TYPE_SECTIONS.some((sec) => sec.type === r.accountType))
                  : visible.filter((r) => r.accountType === type);
                if (sectionRows.length === 0) return null;
                const total = sectionRows.reduce((sum, r) => sum + r.adjusted, 0);
                return (
                  <SectionRows key={type} label={label} rows={sectionRows} total={total}
                    assignments={assignments} codeOptions={codeOptions} codeLabels={codeLabels}
                    onPick={onPickCode} onClear={(accountId) => clear.mutate(accountId)}
                    confidenceTone={confidenceTone} sourceBadge={sourceBadge} />
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center">
              {filter === 'unmapped' ? 'Every account is mapped — nothing to do here.' : 'No accounts match.'}
            </p>
          )}
        </div>
      )}

      {showAi && wpData && (
        <TbAiPanel
          periodEnd={periodEnd}
          basis="accrual"
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

function SectionRows({ label, rows, total, assignments, codeOptions, codeLabels, onPick, onClear, confidenceTone, sourceBadge }: {
  label: string;
  rows: TbWorkpaperRow[];
  total: number;
  assignments: TbAssignment[];
  codeOptions: DropdownOption[];
  codeLabels: Map<string, string>;
  onPick: (row: TbWorkpaperRow, optionId: string) => void;
  onClear: (accountId: string) => void;
  confidenceTone: (c: number) => string;
  sourceBadge: (a: TbAssignment) => JSX.Element;
}) {
  return (
    <>
      <tr className="bg-gray-50 border-b border-gray-200">
        <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase text-gray-600">{label}</td>
      </tr>
      {rows.map((r) => {
        const current = resolveAssignment(assignments, r.accountId, null);
        const currentId = current
          ? current.firmCodeId ? `firm|${current.firmCodeId}` : `seed|${current.seedActivityType}|${current.seedCode}`
          : '';
        return (
          <tr key={r.accountId} className="border-b border-gray-100">
            <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{r.accountNumber}</td>
            <td className="px-3 py-1.5">{r.name}</td>
            <td className={clsx('px-3 py-1.5 text-right font-mono tabular-nums text-xs', r.adjusted < 0 && 'text-red-700')}>
              {r.adjusted < 0 ? `(${usd(-r.adjusted)})` : usd(r.adjusted)}
            </td>
            <td className="px-3 py-1">
              <SearchableDropdown
                options={codeOptions}
                value={currentId}
                selectedLabel={current ? (codeLabels.get(currentId) ?? current.seedCode ?? 'FIRM code') : ''}
                onChange={(id) => onPick(r, id)}
                placeholder="Assign…"
                compact
              />
            </td>
            <td className="px-3 py-1.5">{current ? sourceBadge(current) : <span className="text-xs text-gray-300">—</span>}</td>
            <td className="px-3 py-1.5">
              {current?.source === 'ai' && current.aiConfidence != null
                ? <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', confidenceTone(current.aiConfidence))}>{current.aiConfidence}%</span>
                : <span className="text-xs text-gray-300">—</span>}
            </td>
            <td className="px-3 py-1.5">
              {current && (
                <button onClick={() => onClear(r.accountId)} aria-label={`Clear mapping for ${r.name}`}
                  className="text-gray-300 hover:text-red-600" title="Clear mapping">
                  <X className="h-4 w-4" />
                </button>
              )}
            </td>
          </tr>
        );
      })}
      <tr className="border-b border-gray-200">
        <td className="px-3 py-1.5" />
        <td className="px-3 py-1.5 text-right font-medium text-gray-700">Total {label}</td>
        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs font-semibold">
          {total < 0 ? `(${usd(-total)})` : usd(total)}
        </td>
        <td colSpan={4} />
      </tr>
    </>
  );
}

// ── AI suggestion review panel (6C.4, relocated from the workpaper) ──

function TbAiPanel({ periodEnd, basis, onClose, onAccepted }: {
  periodEnd: string;
  basis: 'accrual' | 'cash';
  onClose: () => void;
  onAccepted: () => void;
}) {
  const toast = useToast();
  const [threshold, setThreshold] = useState(80);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  // Batched analysis: the server caps each call (a full book in one
  // generation blew the provider timeout), so loop until remaining=0,
  // excluding everything already analyzed. Suggestions stream into the
  // table as each batch lands.
  const [allSuggestions, setAllSuggestions] = useState<AiSuggestion[]>([]);
  const [progress, setProgress] = useState<{ analyzed: number; remaining: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const analyzedIds: string[] = [];
        for (;;) {
          const res = await apiClient<{ suggestions: AiSuggestion[]; analyzedAccountIds: string[]; remaining: number }>(
            '/tb/ai/suggest-assignments',
            { method: 'POST', body: JSON.stringify({ periodEnd, basis, excludeAccountIds: analyzedIds }) },
          );
          if (cancelled) return;
          analyzedIds.push(...res.analyzedAccountIds);
          setAllSuggestions((prev) => [...prev, ...res.suggestions]);
          setProgress({ analyzed: analyzedIds.length, remaining: res.remaining });
          if (res.remaining <= 0 || res.analyzedAccountIds.length === 0) break;
        }
      } catch (e) {
        if (!cancelled) setLoadError(isApiError(e) ? e.message : 'AI suggestion failed');
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const pending = allSuggestions.filter((s) => !accepted.has(s.accountId));

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
          {analyzing && (
            <div className="py-3 text-center">
              <LoadingSpinner />
              <p className="text-sm text-gray-500 mt-2">
                {progress
                  ? `Analyzing accounts… ${progress.analyzed} done, ${progress.remaining} to go`
                  : 'Analyzing unassigned accounts…'}
              </p>
            </div>
          )}
          {loadError && <p className="text-sm text-red-700">{loadError}</p>}
          {!analyzing && !loadError && allSuggestions.length === 0 && (
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
