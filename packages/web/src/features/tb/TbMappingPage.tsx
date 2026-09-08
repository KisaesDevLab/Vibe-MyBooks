// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Mapping (mirrors the Vibe TB mapping screen): mapped-progress
// bar, Show All / Unmapped / Mapped filters, accounts grouped by type
// with per-row tax-code picker, source + confidence badges, and the
// Auto-assign AI panel (relocated here from the workpaper view).
//
// Two mapping modes (TB Settings → "Map tax codes per activity unit"):
//   account — one picker per account; an account that already splits
//             across 2+ units with balance gets a picker per slice.
//   unit    — every P&L account shows one sub-row per live non-default
//             unit regardless of balance; the account row IS the default
//             unit's code. A non-default unit resolves ONLY via its own
//             row (strict), so the picker state here mirrors what the
//             export will do. Copy mappings / apply-to-all reuse codes
//             across units of the same activity.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useActivityUnits, useCopyAssignments, useTbProfile, type TbActivityUnit } from '../../api/hooks/useTb';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { SearchableDropdown, type DropdownOption } from '../../components/forms/SearchableDropdown';
import { Copy as CopyIcon, Sparkles, X } from 'lucide-react';
import { useTbYearOverride,
  activeCompanyId, fiscalYearEndFor, isBalanceSheetType, publishTbChange, resolveAssignment, usd,
  useAvailableCodes, useTbAssignmentsQuery, useWorkpaper,
  TB_ACCOUNT_MODE, type TbAssignment, type TbResolveContext, type TbWorkpaperRow,
} from './workpaperShared';
import { TbCopyMappingsDialog } from './TbCopyMappingsDialog';
import clsx from 'clsx';

interface AiSuggestion {
  accountId: string;
  accountName: string;
  accountNumber: string | null;
  code: string;
  activityType: string;
  description: string;
  confidence: number;
  activityUnitId: string | null;
  activityUnitType: string;
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

const ACTIVITY_LABELS: Record<string, string> = {
  business: 'Business', rental: 'Rental', farm: 'Farm', farm_rental: 'Farm rental',
};

type UnitMeta = { id: string; activityType: string; instanceNumber: number; displayName: string };
// One mapping sub-row: a unit slice of an account.
interface SubRow { unit: UnitMeta; adjusted: number; carries: boolean }

const carries = (u: { unadjusted: number; aje: number; taxRje: number }) =>
  Math.abs(u.unadjusted) >= 0.005 || Math.abs(u.aje) >= 0.005 || Math.abs(u.taxRje) >= 0.005;

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
  const [showCopy, setShowCopy] = useState(false);
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [showZeroUnits, setShowZeroUnits] = useState(false);

  const { data: wpData, isLoading, isError, refetch } = useWorkpaper(periodEnd, 'accrual');
  const { data: assignData } = useTbAssignmentsQuery();
  const { data: codesData, error: codesError } = useAvailableCodes();
  const { data: unitsData } = useActivityUnits();
  const unitById = useMemo(() => new Map(
    (unitsData?.units ?? []).map((u) => [u.id, u]),
  ), [unitsData]);
  const liveUnits = useMemo(() => (unitsData?.units ?? []).filter((u) => !u.archivedAt), [unitsData]);
  const defaultUnit = liveUnits.find((u) => u.isDefault) ?? null;
  const unitMode = profileData?.profile?.taxCodeMappingMode === 'unit';
  const ctx: TbResolveContext = useMemo(
    () => unitMode ? { mode: 'unit', defaultUnitId: defaultUnit?.id ?? null } : TB_ACCOUNT_MODE,
    [unitMode, defaultUnit?.id],
  );
  // Unit filter only applies in unit mode; drop a stale selection.
  useEffect(() => { if (unitFilter && !liveUnits.some((u) => u.id === unitFilter)) setUnitFilter(''); }, [liveUnits, unitFilter]);

  const assignments = assignData?.assignments ?? [];

  const assign = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiClient('/tb/assignments', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'export-validate'] });
      publishTbChange(companyId);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Assignment failed'),
  });

  const clear = useMutation({
    mutationFn: ({ accountId, activityUnitId }: { accountId: string; activityUnitId?: string }) =>
      apiClient(`/tb/assignments/${accountId}${activityUnitId ? `?activityUnitId=${activityUnitId}` : ''}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'export-validate'] });
      publishTbChange(companyId);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Clear failed'),
  });

  const copy = useCopyAssignments();

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
  // Firm custom codes carry an activity too — filter them like seed codes.
  const firmCodeActivity = useMemo(() => new Map((codesData?.firmCodes ?? []).map((c) => [`firm|${c.id}`, c.activityType])), [codesData]);

  const codeLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of codesData?.seedCodes ?? []) m.set(`seed|${c.activityType}|${c.code}`, `${c.code} — ${c.description}`);
    for (const c of codesData?.firmCodes ?? []) m.set(`firm|${c.id}`, `${c.code} — ${c.description}`);
    return m;
  }, [codesData]);

  // Options a picker offers for an activity scope (a unit's type, or
  // the default unit's type for the account row in unit mode).
  const optionsFor = (activityType: string | null): DropdownOption[] => {
    if (!activityType) return codeOptions;
    return codeOptions.filter((o) => {
      if (o.group === 'firm custom') {
        const t = firmCodeActivity.get(o.id);
        return !t || t === 'common' || t === activityType;
      }
      return !o.group || o.group === 'common' || o.group === activityType;
    });
  };

  // unit=null → account-level (the default unit's code in unit mode); a
  // real unit writes a unit-scoped row validated server-side against
  // that unit's activity type (the tag→unit split scenario: one account,
  // Sch C codes on the business slice, Sch F codes on the farm slice).
  const onPickCode = (row: TbWorkpaperRow, optionId: string, unit: { id: string; activityType: string } | null) => {
    if (!optionId) return;
    const [kind, a, b] = optionId.split('|');
    const scope = unit ? { activityUnitId: unit.id } : {};
    if (kind === 'seed') {
      assign.mutate({ accountId: row.accountId, seedCode: b, seedActivityType: a, ...scope });
    } else {
      assign.mutate({ accountId: row.accountId, firmCodeId: a, ...scope });
    }
  };

  // Sub-rows per account.
  //   account mode: only when the account has balances in 2+ real units
  //   (those rows map per slice instead of account-level).
  //   unit mode: every live non-default unit for P&L accounts (balance
  //   or not — a code can be set before activity lands), narrowed by
  //   the unit filter; zero-balance units hidden unless asked for.
  const subRowsFor = (r: TbWorkpaperRow): SubRow[] | null => {
    if (!unitMode) {
      const real = r.units.filter((u) => unitById.has(u.unitId) && Math.abs(u.adjusted) >= 0.005);
      if (real.length < 2) return null;
      return real.map((u) => ({ unit: unitById.get(u.unitId)!, adjusted: u.adjusted, carries: true }));
    }
    if (isBalanceSheetType(r.accountType)) return null;
    const rows = liveUnits
      .filter((u) => !u.isDefault)
      .filter((u) => !unitFilter || u.id === unitFilter)
      .map((u) => {
        const slice = r.units.find((s) => s.unitId === u.id);
        return { unit: u, adjusted: slice?.adjusted ?? 0, carries: !!slice && carries(slice) };
      })
      .filter((s) => s.carries || showZeroUnits || (unitFilter && unitFilter === s.unit.id));
    return rows;
  };
  // The default unit's slice of a P&L account (for the account row's balance chip).
  const defaultSlice = (r: TbWorkpaperRow) => {
    if (!defaultUnit) return null;
    return r.units.find((s) => s.unitId === defaultUnit.id)?.adjusted ?? 0;
  };

  // Mapping progress over real accounts (the virtual RE fold row has no
  // assignment surface).
  const rows = useMemo(() => (wpData?.workpaper.rows ?? []).filter((r) => !r.isVirtualRe), [wpData]);
  // Progress counts slices: a split account is mapped only when every
  // slice resolves a code. Unit mode: the default bucket per account +
  // every non-default unit slice that carries balance (zero-balance
  // units don't hold the book hostage), scoped by the unit filter.
  const sliceStats = (r: TbWorkpaperRow): { total: number; mapped: number } => {
    if (unitMode) {
      const bs = isBalanceSheetType(r.accountType);
      const accountSlice = !unitFilter || unitFilter === defaultUnit?.id || bs
        ? { total: 1, mapped: resolveAssignment(assignments, r.accountId, null, ctx, r.accountType) ? 1 : 0 }
        : { total: 0, mapped: 0 };
      if (bs) return accountSlice;
      const units = liveUnits.filter((u) => !u.isDefault && (!unitFilter || u.id === unitFilter));
      let total = accountSlice.total;
      let mapped = accountSlice.mapped;
      for (const u of units) {
        const slice = r.units.find((s) => s.unitId === u.id);
        if (!slice || !carries(slice)) continue;
        total += 1;
        if (resolveAssignment(assignments, r.accountId, u.id, ctx, r.accountType)) mapped += 1;
      }
      return { total, mapped };
    }
    const split = subRowsFor(r);
    if (!split) {
      return { total: 1, mapped: resolveAssignment(assignments, r.accountId, null, ctx, r.accountType) ? 1 : 0 };
    }
    return {
      total: split.length,
      mapped: split.filter((s) => resolveAssignment(assignments, r.accountId, s.unit.id, ctx, r.accountType)).length,
    };
  };
  const isMapped = (r: TbWorkpaperRow) => {
    const st = sliceStats(r);
    return st.mapped === st.total;
  };
  const totals = rows.reduce((acc, r) => {
    const st = sliceStats(r);
    return { total: acc.total + st.total, mapped: acc.mapped + st.mapped };
  }, { total: 0, mapped: 0 });
  const mappedCount = totals.mapped;
  const pct = totals.total > 0 ? Math.round((totals.mapped / totals.total) * 100) : 0;

  const visible = rows.filter((r) => {
    if (filter === 'unmapped' && isMapped(r)) return false;
    if (filter === 'mapped' && !isMapped(r)) return false;
    if (unitMode && unitFilter && unitFilter !== defaultUnit?.id && isBalanceSheetType(r.accountType)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !(r.accountNumber ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const accountNames = useMemo(() => new Map(rows.map((r) => [r.accountId, `${r.accountNumber ? r.accountNumber + ' ' : ''}${r.name}`])), [rows]);

  // Per-row "apply to all <type> units": the same code onto every other
  // live non-default unit of the same activity type.
  const applyToAll = (r: TbWorkpaperRow, unit: UnitMeta) => {
    const others = liveUnits.filter((u) => !u.isDefault && u.id !== unit.id && u.activityType === unit.activityType).map((u) => u.id);
    if (others.length === 0) return;
    copy.mutate({ sourceUnitId: unit.id, targetUnitIds: others, mode: 'overwrite', accountIds: [r.accountId] }, {
      onSuccess: (res) => {
        toast.success(`Applied to ${res.copied} ${ACTIVITY_LABELS[unit.activityType]?.toLowerCase() ?? unit.activityType} unit${res.copied === 1 ? '' : 's'}`
          + (res.skippedIncompatible ? ` (${res.skippedIncompatible} incompatible skipped)` : ''));
        publishTbChange(companyId);
      },
      onError: (e) => toast.error(isApiError(e) ? e.message : 'Apply failed'),
    });
  };

  const confidenceTone = (c: number) =>
    c >= 90 ? 'bg-green-100 text-green-700' : c >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700';

  const sourceBadge = (a: TbAssignment) => a.source === 'ai'
    ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">AI</span>
    : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Manual</span>;

  const unitLabel = (u: TbActivityUnit) => `${ACTIVITY_LABELS[u.activityType] ?? u.activityType} #${u.instanceNumber} — ${u.displayName}`;

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tax Mapping</h1>
          <p className="text-sm text-gray-500">
            {codesData ? `${codesData.returnForm} · ` : ''}
            {unitMode
              ? `per activity unit · default: ${defaultUnit ? `${defaultUnit.displayName} (${ACTIVITY_LABELS[defaultUnit.activityType] ?? defaultUnit.activityType})` : 'none'} · `
              : codesData ? `${codesData.activityType.replace('_', ' ')} · ` : ''}
            {wpData ? `TY${wpData.workpaper.taxYear} · FY ${wpData.workpaper.fyStart} → ${wpData.workpaper.periodEnd}` : ' '}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unitMode && (
            <Button variant="secondary" onClick={() => setShowCopy(true)} disabled={liveUnits.length < 2}>
              <CopyIcon className="h-4 w-4 mr-1" /> Copy mappings…
            </Button>
          )}
          <Button onClick={() => setShowAi(true)}>
            <Sparkles className="h-4 w-4 mr-1" /> Auto-assign Tax Codes
          </Button>
        </div>
      </div>

      {/* ── Progress ───────────────────────────────────────── */}
      <div className="mb-4">
        <p className={clsx('text-sm font-medium mb-1', pct === 100 ? 'text-green-700' : 'text-gray-700')}>
          {mappedCount} of {totals.total} {totals.total === rows.length ? 'accounts' : 'activity slices'} mapped ({pct}%)
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
        {unitMode && (
          <>
            <select value={unitFilter} aria-label="Activity unit" onChange={(e) => setUnitFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">All units</option>
              {liveUnits.map((u) => <option key={u.id} value={u.id}>{unitLabel(u)}{u.isDefault ? ' (default)' : ''}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={showZeroUnits} onChange={(e) => setShowZeroUnits(e.target.checked)} />
              Show units with no balance
            </label>
          </>
        )}
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
      {unitMode && !defaultUnit && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-800">
          Per-unit mapping is on but this company has no live default activity unit — add one in <button className="underline" onClick={() => navigate('/tb/settings')}>TB Settings</button>.
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
                <th className="px-3 py-2 w-16" />
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
                    assignments={assignments} codeOptions={codeOptions} optionsFor={optionsFor} codeLabels={codeLabels}
                    onPick={onPickCode}
                    onClear={(accountId, activityUnitId) => clear.mutate({ accountId, activityUnitId })}
                    onApplyToAll={applyToAll}
                    confidenceTone={confidenceTone} sourceBadge={sourceBadge}
                    subRowsFor={subRowsFor} ctx={ctx} unitMode={unitMode} defaultUnit={defaultUnit}
                    defaultSlice={defaultSlice} unitFilter={unitFilter} liveUnits={liveUnits} />
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
          unitMode={unitMode}
          units={liveUnits}
          defaultUnitId={defaultUnit?.id ?? null}
          initialUnitId={unitFilter || defaultUnit?.id || null}
          onClose={() => setShowAi(false)}
          onAccepted={() => {
            queryClient.invalidateQueries({ queryKey: ['tb', 'assignments'] });
            queryClient.invalidateQueries({ queryKey: ['tb', 'diagnostics'] });
            queryClient.invalidateQueries({ queryKey: ['tb', 'export-validate'] });
            publishTbChange(companyId);
          }}
        />
      )}
      {showCopy && (
        <TbCopyMappingsDialog
          units={unitsData?.units ?? []}
          accountNames={accountNames}
          onClose={() => setShowCopy(false)}
          onCopied={() => publishTbChange(companyId)}
        />
      )}
    </div>
  );
}

function SectionRows({
  label, rows, total, assignments, codeOptions, optionsFor, codeLabels, onPick, onClear, onApplyToAll,
  confidenceTone, sourceBadge, subRowsFor, ctx, unitMode, defaultUnit, defaultSlice, unitFilter, liveUnits,
}: {
  label: string;
  rows: TbWorkpaperRow[];
  total: number;
  assignments: TbAssignment[];
  codeOptions: DropdownOption[];
  optionsFor: (activityType: string | null) => DropdownOption[];
  codeLabels: Map<string, string>;
  onPick: (row: TbWorkpaperRow, optionId: string, unit: { id: string; activityType: string } | null) => void;
  onClear: (accountId: string, activityUnitId?: string) => void;
  onApplyToAll: (row: TbWorkpaperRow, unit: UnitMeta) => void;
  confidenceTone: (c: number) => string;
  sourceBadge: (a: TbAssignment) => JSX.Element;
  subRowsFor: (r: TbWorkpaperRow) => SubRow[] | null;
  ctx: TbResolveContext;
  unitMode: boolean;
  defaultUnit: TbActivityUnit | null;
  defaultSlice: (r: TbWorkpaperRow) => number | null;
  unitFilter: string;
  liveUnits: TbActivityUnit[];
}) {
  const currentIdOf = (current: TbAssignment | null) => current
    ? current.firmCodeId ? `firm|${current.firmCodeId}` : `seed|${current.seedActivityType}|${current.seedCode}`
    : '';
  const cells = (r: TbWorkpaperRow, current: TbAssignment | null, currentId: string, amount: number,
    unit: UnitMeta | null, unitLabel: string | null, opts: { muted?: boolean; chip?: string | null; applyAll?: boolean } = {}) => (
    <>
      <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{unitLabel ? '' : r.accountNumber}</td>
      <td className={clsx('px-3 py-1.5', unitLabel && 'pl-8 text-sm text-gray-600', opts.muted && 'text-gray-400')}>
        {unitLabel ?? r.name}
        {opts.chip && <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{opts.chip}</span>}
      </td>
      <td className={clsx('px-3 py-1.5 text-right font-mono tabular-nums text-xs', amount < 0 && 'text-red-700', opts.muted && 'text-gray-400')}>
        {amount < 0 ? `(${usd(-amount)})` : usd(amount)}
      </td>
      <td className="px-3 py-1">
        <SearchableDropdown
          options={unit ? optionsFor(unit.activityType) : (unitMode && defaultUnit && !isBalanceSheetType(r.accountType) ? optionsFor(defaultUnit.activityType) : codeOptions)}
          value={currentId}
          selectedLabel={current ? (codeLabels.get(currentId) ?? current.seedCode ?? 'FIRM code') : ''}
          onChange={(id) => onPick(r, id, unit)}
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
        <div className="flex items-center gap-1.5">
          {opts.applyAll && unit && current?.activityUnitId === unit.id && (
            <button
              onClick={() => onApplyToAll(r, unit)}
              aria-label={`Apply to all ${ACTIVITY_LABELS[unit.activityType] ?? unit.activityType} units`}
              className="text-gray-300 hover:text-blue-600" title={`Apply this code to every other ${ACTIVITY_LABELS[unit.activityType]?.toLowerCase() ?? unit.activityType} unit`}>
              <CopyIcon className="h-4 w-4" />
            </button>
          )}
          {current && (
            <button
              onClick={() => onClear(r.accountId, current.activityUnitId ?? undefined)}
              aria-label={`Clear mapping for ${unitLabel ?? r.name}`}
              className="text-gray-300 hover:text-red-600" title="Clear mapping">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </>
  );
  return (
    <>
      <tr className="bg-gray-50 border-b border-gray-200">
        <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase text-gray-600">{label}</td>
      </tr>
      {rows.map((r) => {
        const split = subRowsFor(r);
        if (unitMode && split && !isBalanceSheetType(r.accountType)) {
          // Unit mode: the account row is the DEFAULT unit's code; one
          // sub-row per live non-default unit. When the unit filter is a
          // non-default unit, the account row is a plain header.
          const showAccountPicker = !unitFilter || unitFilter === defaultUnit?.id;
          const current = resolveAssignment(assignments, r.accountId, null, ctx, r.accountType);
          const currentId = currentIdOf(current);
          const dslice = defaultSlice(r);
          const chip = defaultUnit
            ? `default · ${defaultUnit.displayName} #${defaultUnit.instanceNumber}${dslice != null ? ` · ${dslice < 0 ? `(${usd(-dslice)})` : usd(dslice)}` : ''}`
            : null;
          return (
            <React.Fragment key={r.accountId}>
              {showAccountPicker ? (
                <tr className="border-b border-gray-100">
                  {cells(r, current, currentId, r.adjusted, null, null, { chip })}
                </tr>
              ) : (
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{r.accountNumber}</td>
                  <td className="px-3 py-1.5 font-medium">{r.name}</td>
                  <td className={clsx('px-3 py-1.5 text-right font-mono tabular-nums text-xs', r.adjusted < 0 && 'text-red-700')}>
                    {r.adjusted < 0 ? `(${usd(-r.adjusted)})` : usd(r.adjusted)}
                  </td>
                  <td colSpan={4} className="px-3 py-1.5 text-xs text-gray-400">account total</td>
                </tr>
              )}
              {split.map((s) => {
                const current = resolveAssignment(assignments, r.accountId, s.unit.id, ctx, r.accountType);
                const sameTypeOthers = liveUnits.some((u) => !u.isDefault && u.id !== s.unit.id && u.activityType === s.unit.activityType);
                return (
                  <tr key={`${r.accountId}-${s.unit.id}`} className={clsx('border-b border-gray-100', !s.carries && 'bg-gray-50/30')}>
                    {cells(r, current, currentIdOf(current), s.adjusted,
                      s.unit,
                      `↳ ${s.unit.displayName} (${ACTIVITY_LABELS[s.unit.activityType] ?? s.unit.activityType} #${s.unit.instanceNumber})`,
                      { muted: !s.carries, applyAll: sameTypeOthers })}
                  </tr>
                );
              })}
            </React.Fragment>
          );
        }
        if (split && !unitMode) {
          // Account mode: multi-activity account (tag→unit splits) — one
          // sub-row per unit slice, each with its own activity-scoped picker.
          return (
            <React.Fragment key={r.accountId}>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{r.accountNumber}</td>
                <td className="px-3 py-1.5 font-medium">{r.name}</td>
                <td className={clsx('px-3 py-1.5 text-right font-mono tabular-nums text-xs', r.adjusted < 0 && 'text-red-700')}>
                  {r.adjusted < 0 ? `(${usd(-r.adjusted)})` : usd(r.adjusted)}
                </td>
                <td colSpan={4} className="px-3 py-1.5 text-xs text-gray-400">split across {split.length} activities</td>
              </tr>
              {split.map((s) => {
                const current = resolveAssignment(assignments, r.accountId, s.unit.id, ctx, r.accountType);
                // Show only the unit-scoped assignment on the slice row —
                // an account-level fallback still resolves, and displays
                // here so the preparer sees the effective code.
                return (
                  <tr key={`${r.accountId}-${s.unit.id}`} className="border-b border-gray-100">
                    {cells(r, current, currentIdOf(current), s.adjusted, s.unit, `↳ ${s.unit.displayName} (#${s.unit.instanceNumber})`)}
                  </tr>
                );
              })}
            </React.Fragment>
          );
        }
        const current = resolveAssignment(assignments, r.accountId, null, ctx, r.accountType);
        return (
          <tr key={r.accountId} className="border-b border-gray-100">
            {cells(r, current, currentIdOf(current), r.adjusted, null, null)}
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

const suggestionKey = (s: { accountId: string; activityUnitId: string | null }) => `${s.accountId}|${s.activityUnitId ?? 'acct'}`;

function TbAiPanel({ periodEnd, basis, unitMode, units, defaultUnitId, initialUnitId, onClose, onAccepted }: {
  periodEnd: string;
  basis: 'accrual' | 'cash';
  unitMode: boolean;
  units: TbActivityUnit[];
  defaultUnitId: string | null;
  initialUnitId: string | null;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const toast = useToast();
  const [threshold, setThreshold] = useState(80);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  // Unit mode: one run per unit. The default unit is served by the
  // account-level row, so targeting it is an account-level run.
  const [unitId, setUnitId] = useState<string>(unitMode ? (initialUnitId ?? '') : '');
  const unit = units.find((u) => u.id === unitId) ?? null;
  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, `${u.displayName} (#${u.instanceNumber})`])), [units]);

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
    setAllSuggestions([]);
    setProgress(null);
    setAnalyzing(true);
    setLoadError(null);
    (async () => {
      try {
        const analyzedIds: string[] = [];
        for (;;) {
          const res = await apiClient<{ suggestions: AiSuggestion[]; analyzedAccountIds: string[]; remaining: number }>(
            '/tb/ai/suggest-assignments',
            { method: 'POST', body: JSON.stringify({ periodEnd, basis, excludeAccountIds: analyzedIds, ...(unitMode && unitId ? { activityUnitId: unitId } : {}) }) },
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
  }, [unitId]);

  const accept = useMutation({
    mutationFn: (s: AiSuggestion) => apiClient('/tb/assignments', {
      method: 'PUT',
      body: JSON.stringify({
        accountId: s.accountId,
        seedCode: s.code,
        seedActivityType: s.activityType,
        ...(s.activityUnitId ? { activityUnitId: s.activityUnitId } : {}),
        source: 'ai',
        aiConfidence: s.confidence,
      }),
    }),
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Accept failed'),
  });

  const pending = allSuggestions.filter((s) => !accepted.has(suggestionKey(s)));

  const acceptOne = async (s: AiSuggestion) => {
    await accept.mutateAsync(s);
    setAccepted((prev) => new Set(prev).add(suggestionKey(s)));
    onAccepted();
  };

  const acceptAll = async () => {
    const targets = pending.filter((s) => s.confidence >= threshold);
    for (const s of targets) {
      try {
        await accept.mutateAsync(s);
        setAccepted((prev) => new Set(prev).add(suggestionKey(s)));
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
        {unitMode && (
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-sm">
            <label htmlFor="ai-unit" className="text-gray-700">Activity unit</label>
            <select id="ai-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={analyzing}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {ACTIVITY_LABELS[u.activityType] ?? u.activityType} #{u.instanceNumber} — {u.displayName}{u.id === defaultUnitId ? ' (default · account-level codes)' : ''}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">Only this unit&apos;s codes are suggested; accepted codes are written for this unit.</span>
          </div>
        )}
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
            <p className="text-sm text-gray-500">
              {unitMode && unit ? `Nothing to suggest — every account with a balance in ${unit.displayName} already has a code for it.` : 'Nothing to suggest — every account already has a tax code.'}
            </p>
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
                  <tr key={suggestionKey(s)} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      {s.accountNumber ? `${s.accountNumber} ` : ''}{s.accountName}
                      {s.activityUnitId && <span className="ml-1.5 text-[10px] text-gray-500">↳ {unitNameById.get(s.activityUnitId) ?? 'unit'}</span>}
                    </td>
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
