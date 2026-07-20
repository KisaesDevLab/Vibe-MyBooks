// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Report Pack builder — two-pane page for creating / editing a pack.
//
// LEFT: the report catalog, grouped, with checkboxes (check appends to the
// pack, uncheck removes). RIGHT: pack settings — name, global date range
// (from a saved relative preset), as-of mode, default basis, the ordered
// list of reports (up/down reorder + remove), a count/cap indicator, output
// chrome toggles, and a filename template. Save persists the pack; Generate
// saves then kicks off an async render and navigates to the run page.
//
// Per-report options: each report in the pack renders the controls its
// catalog `ReportOptionSpec` declares (basis, compare, grouping, % of income,
// tag filter). Values persist to that item's options_json and flow through to
// rendering. Reports with no options show nothing. Arrow reorder (no drag),
// no ad-hoc runs.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, Trash2, FileText, Play, Save } from 'lucide-react';
import {
  REPORT_CATALOG,
  PACK_WARN_COUNT,
  PACK_MAX_COUNT,
  getReportDef,
  resolvePreset,
  resolveReportDates,
  type ReportDef,
  type PeriodPreset,
  type ReportPackItemOptions,
} from '@kis-books/shared';
import {
  useReportCatalog,
  useReportPack,
  useReportPackLetters,
  useCreateReportPack,
  useUpdateReportPack,
  useCreatePackRun,
  type ReportPackInput,
} from '../../../api/hooks/useReportPacks';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useToast } from '../../../components/ui/Toaster';
import { DateRangePicker } from '../DateRangePicker';
import { ReportTagFilter } from '../ReportTagFilter';

const PRESET_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'qtd', label: 'Quarter to Date' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom' },
];

/** One-line human summary of the concrete dates a report will render with. */
function describeReportDates(
  def: ReportDef,
  range: { start: string; end: string },
  asOfOverride: string | undefined,
): string {
  const dates = resolveReportDates(def, range, asOfOverride);
  if (def.temporal === 'date-range') {
    return dates['start_date'] && dates['end_date']
      ? `${dates['start_date']} → ${dates['end_date']}`
      : 'Set a date range';
  }
  if (def.temporal === 'as-of') {
    return dates['as_of_date'] ? `As of ${dates['as_of_date']}` : 'Set an as-of date';
  }
  return 'Live balances';
}

/**
 * Per-report options row, driven entirely by the report's catalog
 * `ReportOptionSpec`. Renders only the controls that spec declares; a report
 * with no options renders nothing. Empty / default selections are pruned so
 * options_json stays minimal.
 */
function ReportItemOptions({
  def,
  options,
  onChange,
}: {
  def: ReportDef;
  options: ReportPackItemOptions;
  onChange: (next: ReportPackItemOptions) => void;
}) {
  const spec = def.options;
  const hasAny = spec.basis || spec.compare || spec.groupBy || spec.showPct || spec.tagFilter;
  if (!hasAny) return null;

  // Merge a patch and drop keys that carry no meaning (undefined / null /
  // false / '') so the persisted options_json only holds real overrides.
  const set = (patch: Partial<ReportPackItemOptions>) => {
    const next: ReportPackItemOptions = { ...options, ...patch };
    for (const key of Object.keys(next) as Array<keyof ReportPackItemOptions>) {
      const v = next[key];
      if (v === undefined || v === null || v === false || v === '') delete next[key];
    }
    onChange(next);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-2">
      {spec.basis && (
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Basis
          <select
            value={options.basis ?? ''}
            onChange={(e) => set({ basis: (e.target.value || undefined) as 'accrual' | 'cash' | undefined })}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            aria-label={`${def.label} basis`}
          >
            <option value="">Pack default</option>
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </select>
        </label>
      )}
      {spec.groupBy && (
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Grouping
          <select
            value={options.groupBy ?? ''}
            onChange={(e) => set({ groupBy: (e.target.value || undefined) as 'detail_type' | undefined })}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            aria-label={`${def.label} grouping`}
          >
            <option value="">None</option>
            <option value="detail_type">By detail type</option>
          </select>
        </label>
      )}
      {spec.compare && (
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Compare
          <select
            value={options.compare === true ? 'previous_period' : (options.compare || '')}
            onChange={(e) => set({ compare: (e.target.value || undefined) as ReportPackItemOptions['compare'] })}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            aria-label={`${def.label} comparison`}
          >
            <option value="">None</option>
            {(spec.compareModes ?? ['previous_period', 'previous_year']).map((m) => (
              <option key={m} value={m}>
                {m === 'previous_period' ? 'vs. Previous Period' : m === 'previous_year' ? 'vs. Previous Year' : 'Trend (multi-period)'}
              </option>
            ))}
          </select>
        </label>
      )}
      {spec.showPct && (
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={options.showPct ?? false}
            onChange={(e) => set({ showPct: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            aria-label={`${def.label} percent of income`}
          />
          % of income
        </label>
      )}
      {spec.tagFilter && (
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Tag
          <ReportTagFilter
            value={options.tagId ?? ''}
            onChange={(tagId) => set({ tagId: tagId || undefined })}
          />
        </label>
      )}
    </div>
  );
}

export function ReportPackBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { activeCompanyName } = useCompanyContext();

  const catalogQuery = useReportCatalog();
  const lettersQuery = useReportPackLetters();
  const packQuery = useReportPack(id);
  const createPack = useCreateReportPack();
  const updatePack = useUpdateReportPack();
  const createRun = useCreatePackRun();

  // The catalog the API serves is the authoritative source, but fall back to
  // the bundled REPORT_CATALOG so grouping renders even before the fetch
  // resolves (and in tests that don't mock the network).
  const catalog = catalogQuery.data?.catalog ?? REPORT_CATALOG;

  // ── Pack settings state ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this-month');
  const initial = resolvePreset('this-month');
  const [rangeStart, setRangeStart] = useState(initial.start);
  const [rangeEnd, setRangeEnd] = useState(initial.end);
  const [asOfMode, setAsOfMode] = useState<'range-end' | 'custom'>('range-end');
  const [asOfCustom, setAsOfCustom] = useState('');
  const [defaultBasis, setDefaultBasis] = useState<'accrual' | 'cash'>('accrual');
  const [coverPage, setCoverPage] = useState(true);
  const [toc, setToc] = useState(true);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [pageFooter, setPageFooter] = useState('');
  const [filenameTemplate, setFilenameTemplate] = useState('{pack}-{date}');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Per-report options keyed by reportId (a report id is unique within a pack).
  const [itemOptions, setItemOptions] = useState<Record<string, ReportPackItemOptions>>({});
  // Optional SSARS-21 engagement letter to include as the pack's first section.
  const [letterId, setLetterId] = useState<string>('');

  // Hydrate once from the loaded pack in edit mode.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!isEdit || hydrated.current || !packQuery.data) return;
    const p = packQuery.data;
    hydrated.current = true;
    setName(p.name);
    setDescription(p.description ?? '');
    setPeriodPreset(p.periodPreset);
    setAsOfMode(p.asOfMode);
    setAsOfCustom(p.asOfCustom ?? '');
    setDefaultBasis(p.defaultBasis);
    setCoverPage(p.coverPage);
    setToc(p.toc);
    setPageNumbers(p.pageNumbers);
    setPageFooter(p.pageFooter ?? '');
    setFilenameTemplate(p.filenameTemplate);
    setLetterId(p.letterId ?? '');
    const ordered = [...p.items].sort((a, b) => a.sortOrder - b.sortOrder);
    setSelectedIds(ordered.map((it) => it.reportId));
    setItemOptions(
      Object.fromEntries(ordered.map((it) => [it.reportId, it.optionsJson ?? {}])),
    );
    if (p.periodPreset === 'custom') {
      setRangeStart(p.customRangeStart ?? '');
      setRangeEnd(p.customRangeEnd ?? '');
    } else {
      const r = resolvePreset(p.periodPreset);
      setRangeStart(r.start);
      setRangeEnd(r.end);
    }
  }, [isEdit, packQuery.data]);

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset !== 'custom') {
      const r = resolvePreset(preset);
      setRangeStart(r.start);
      setRangeEnd(r.end);
    }
  };

  const asOfOverride = asOfMode === 'custom' ? asOfCustom || undefined : undefined;
  const range = useMemo(() => ({ start: rangeStart, end: rangeEnd }), [rangeStart, rangeEnd]);

  const atCap = selectedIds.length >= PACK_MAX_COUNT;

  const toggleReport = (reportId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(reportId) || prev.length >= PACK_MAX_COUNT) return prev;
        return [...prev, reportId];
      }
      return prev.filter((r) => r !== reportId);
    });
  };

  const moveReport = (index: number, dir: -1 | 1) => {
    setSelectedIds((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const removeReport = (reportId: string) => {
    setSelectedIds((prev) => prev.filter((r) => r !== reportId));
  };

  // Group the catalog for the left pane, preserving catalog order.
  const grouped = useMemo(() => {
    const map = new Map<string, ReportDef[]>();
    for (const def of catalog) {
      const list = map.get(def.group) ?? [];
      list.push(def);
      map.set(def.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const buildInput = (): ReportPackInput => ({
    name: name.trim(),
    description: description.trim() || null,
    periodPreset,
    customRangeStart: rangeStart || null,
    customRangeEnd: rangeEnd || null,
    asOfMode,
    asOfCustom: asOfCustom || null,
    defaultBasis,
    defaultTagId: null,
    coverPage,
    toc,
    pageNumbers,
    pageFooter: pageFooter.trim() || null,
    filenameTemplate: filenameTemplate.trim() || '{pack}-{date}',
    onError: 'skip',
    letterId: letterId || null,
    items: selectedIds.map((reportId) => {
      const options = itemOptions[reportId];
      return options && Object.keys(options).length > 0 ? { reportId, options } : { reportId };
    }),
  });

  const savePack = async () => {
    const input = buildInput();
    if (isEdit && id) return updatePack.mutateAsync({ id, input });
    return createPack.mutateAsync(input);
  };

  const nameValid = name.trim().length > 0;
  const saving = createPack.isPending || updatePack.isPending;

  const handleSave = async () => {
    if (!nameValid) return;
    try {
      await savePack();
      toast.success(isEdit ? 'Report pack updated' : 'Report pack created');
      navigate('/reports/packs');
    } catch (err) {
      toast.error('Could not save report pack', { detail: (err as Error).message });
    }
  };

  const handleGenerate = async () => {
    if (!nameValid || selectedIds.length === 0) return;
    try {
      const saved = await savePack();
      const asOfDate = asOfMode === 'custom' ? asOfCustom || rangeEnd : rangeEnd;
      const run = await createRun.mutateAsync({
        packId: saved.id,
        input: { rangeStart, rangeEnd, asOfDate },
      });
      navigate(`/reports/packs/runs/${run.id}`);
    } catch (err) {
      toast.error('Could not generate report pack', { detail: (err as Error).message });
    }
  };

  if (isEdit && packQuery.isLoading) {
    return <LoadingSpinner className="py-16" />;
  }
  if (isEdit && packQuery.isError) {
    return <ErrorMessage onRetry={packQuery.refetch} />;
  }

  const countClass = atCap
    ? 'text-red-600'
    : selectedIds.length >= PACK_WARN_COUNT
      ? 'text-amber-600'
      : 'text-gray-500';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Report Pack' : 'New Report Pack'}
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={!nameValid}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button
            onClick={handleGenerate}
            loading={createRun.isPending}
            disabled={!nameValid || selectedIds.length === 0}
          >
            <Play className="h-4 w-4 mr-1" /> Generate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: catalog ── */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {/* Engagement letter — a distinct sub-section above the report list.
              An optional SSARS-21 letter rendered as the pack's first page. */}
          <div className="mb-5 pb-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Engagement letter</h2>
            <p className="text-sm text-gray-500 mb-3">
              Optionally include a CPA letter (compilation / preparation) as the first page of the pack.
            </p>
            <select
              value={letterId}
              onChange={(e) => setLetterId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Engagement letter"
              disabled={lettersQuery.isLoading}
            >
              <option value="">No letter</option>
              {(lettersQuery.data?.letters ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose reports</h2>
          <p className={`text-sm mb-4 ${countClass}`}>
            {selectedIds.length} of {PACK_MAX_COUNT} selected
            {selectedIds.length >= PACK_WARN_COUNT && !atCap && ' — large packs take longer to render'}
            {atCap && ' — maximum reached'}
          </p>
          {catalogQuery.isLoading ? (
            <LoadingSpinner className="py-8" />
          ) : catalogQuery.isError ? (
            <ErrorMessage onRetry={catalogQuery.refetch} />
          ) : grouped.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No reports available.</p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([group, defs]) => (
                <div key={group}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {defs.map((def) => {
                      const checked = selectedIds.includes(def.id);
                      return (
                        <label
                          key={def.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && atCap}
                            onChange={(e) => toggleReport(def.id, e.target.checked)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                          />
                          <span className="text-sm text-gray-700">{def.label}</span>
                          {def.orientation === 'landscape' && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1">
                              landscape
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── RIGHT: settings ── */}
        <section className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <Input
              label="Pack name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Monthly Board Package"
              required
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Optional"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {activeCompanyName || 'Active company'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Date range</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period preset</label>
              <select
                value={periodPreset}
                onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {PRESET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <DateRangePicker
              startDate={rangeStart}
              endDate={rangeEnd}
              onChange={(start, end) => {
                setRangeStart(start);
                setRangeEnd(end);
                setPeriodPreset('custom');
              }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">As-of date (balance sheet, aging)</label>
              <select
                value={asOfMode}
                onChange={(e) => setAsOfMode(e.target.value as 'range-end' | 'custom')}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="range-end">Use range end date</option>
                <option value="custom">Custom date</option>
              </select>
              {asOfMode === 'custom' && (
                <input
                  type="date"
                  value={asOfCustom}
                  onChange={(e) => setAsOfCustom(e.target.value)}
                  className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default basis</label>
              <select
                value={defaultBasis}
                onChange={(e) => setDefaultBasis(e.target.value as 'accrual' | 'cash')}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="accrual">Accrual</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Reports in pack — ordered list */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Reports in pack ({selectedIds.length})
            </h2>
            {selectedIds.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No reports yet — check reports on the left to add them.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedIds.map((reportId, index) => {
                  const def = getReportDef(reportId);
                  if (!def) return null;
                  return (
                    <li
                      key={reportId}
                      className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveReport(index, -1)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          aria-label={`Move ${def.label} up`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveReport(index, 1)}
                          disabled={index === selectedIds.length - 1}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          aria-label={`Move ${def.label} down`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{def.label}</span>
                          {def.orientation === 'landscape' && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1">
                              landscape
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {describeReportDates(def, range, asOfOverride)}
                        </div>
                        <ReportItemOptions
                          def={def}
                          options={itemOptions[reportId] ?? {}}
                          onChange={(next) =>
                            setItemOptions((prev) => ({ ...prev, [reportId]: next }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReport(reportId)}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`Remove ${def.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Output */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-600" /> Output
            </h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={coverPage} onChange={(e) => setCoverPage(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Cover page
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={toc} onChange={(e) => setToc(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Table of contents
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Page numbers
            </label>
            <Input
              label="Page footer"
              value={pageFooter}
              onChange={(e) => setPageFooter(e.target.value)}
              maxLength={500}
              placeholder="Printed on every page (optional)"
            />
            <p className="text-xs text-gray-500">
              Prints on every page of the PDF. Leave blank to use your company's default report footer.
            </p>
            <Input
              label="Filename template"
              value={filenameTemplate}
              onChange={(e) => setFilenameTemplate(e.target.value)}
              maxLength={255}
              placeholder="{pack}-{date}"
            />
            <p className="text-xs text-gray-500">
              Use <code>{'{pack}'}</code> and <code>{'{date}'}</code> as placeholders.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
