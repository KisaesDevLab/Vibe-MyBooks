// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Financial-statement editor: settings bar, left-hand panels (statements
// outline, style, front matter, cash-flow classification, checks) and a
// live paginated preview computed IN THE BROWSER with the same engine +
// renderer the server uses for the PDF. Save persists the layout / style
// (shared by this client's statements) and the report's own settings;
// Finalize freezes a version; Publish sends a final to the client portal.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronDown, Download, Eye, FileText, Globe, History, Lock, RotateCcw, Save, TriangleAlert,
} from 'lucide-react';
import {
  computeFsReport, fsPreviewDocument, fsFrameworkNeedsBook,
  type FsCheck, type FsFrontMatter, type FsLayout, type FsRenderedReport, type FsReportSettings, type FsStatementConfig, type FsStyle,
} from './fsShared';
import {
  downloadFsExport, fetchFsPreviewPdf, useFinalizeFsReport, useFsCashFlowOverrides, useFsImpact, useFsLibrary, useFsPreviewData,
  useFsReport, usePublishFsVersion, useReopenFsReport, useSaveFsCashFlowOverrides, useSaveFsLayout, useSaveLayoutAsTemplate,
  useSavePreset, useUnpublishFsVersion, useUpdateFsReport,
} from '../../../api/hooks/useFinancialStatements';
import { API_BASE, isApiError } from '../../../api/client';
import { useMe } from '../../../api/hooks/useAuth';
import { useTags } from '../../../api/hooks/useTags';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useToast } from '../../../components/ui/Toaster';
import { FsOutlinePanel } from './FsOutlinePanel';
import { CashFlowPanel, ChecksPanel, FrontMatterPanel, StatementSettingsPanel, StylePanel } from './FsPanels';
import { FsLivePreview, FsPdfProof } from './FsPreview';

type Tab = 'statements' | 'style' | 'front' | 'cashflow' | 'checks';

const STATEMENT_NAME: Record<FsStatementConfig['kind'], string> = {
  balance_sheet: 'Balance sheet', income_statement: 'Income statement', equity: 'Equity', cash_flows: 'Cash flows',
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function FsEditorPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const id = reportId!;
  const toast = useToast();
  const { data: me } = useMe();
  const canManageLibrary = me?.user?.role === 'owner' || me?.user?.isSuperAdmin === true;
  const { data: detail, isLoading, isError, refetch } = useFsReport(id);
  const { data: library } = useFsLibrary();
  const { data: tagsData } = useTags({ isActive: true });
  const { data: cfData } = useFsCashFlowOverrides();
  const saveCf = useSaveFsCashFlowOverrides();

  const [name, setName] = useState('');
  const [layout, setLayout] = useState<FsLayout | null>(null);
  const [style, setStyle] = useState<FsStyle | null>(null);
  const [settings, setSettings] = useState<FsReportSettings | null>(null);
  const [frontMatter, setFrontMatter] = useState<FsFrontMatter | null>(null);
  const [dirtyLayout, setDirtyLayout] = useState(false);
  const [dirtyReport, setDirtyReport] = useState(false);
  const [tab, setTab] = useState<Tab>('statements');
  const [stmtId, setStmtId] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [view, setView] = useState<'live' | 'pdf'>('live');
  const [pdf, setPdf] = useState<{ blob: Blob | null; loading: boolean; error: string | null }>({ blob: null, loading: false, error: null });
  const [finalizeDlg, setFinalizeDlg] = useState<{ checks: FsCheck[] } | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Load server state once per report (and after finalize / reopen).
  useEffect(() => {
    if (!detail) return;
    setName(detail.report.name);
    setLayout(detail.layout.layout);
    setStyle(detail.layout.style);
    setSettings(detail.report.settings);
    setFrontMatter(detail.report.frontMatter);
    setDirtyLayout(false);
    setDirtyReport(false);
    setStmtId((cur) => cur || detail.layout.layout.statements[0]?.id || '');
  }, [detail]);

  useEffect(() => {
    if (!dirtyLayout && !dirtyReport) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirtyLayout, dirtyReport]);

  const isFinal = detail?.report.status === 'final';
  const debSettings = useDebounced(settings ?? undefined, 400);
  const debFront = useDebounced(frontMatter ?? undefined, 600);
  const preview = useFsPreviewData(id, debSettings, debFront, detail?.glVersionStamp);

  const computed = useMemo((): { model: FsRenderedReport | null; error: string | null } => {
    if (!layout || !style || !settings || !preview.data) return { model: null, error: null };
    try {
      return { model: computeFsReport(settings, layout, style, preview.data.source), error: null };
    } catch (e) {
      return { model: null, error: e instanceof Error ? e.message : 'Could not compute the statements' };
    }
  }, [layout, style, settings, preview.data]);

  const html = useMemo(() => {
    if (!computed.model || !style || !frontMatter) return '';
    return fsPreviewDocument({
      report: computed.model, style, frontMatter,
      letterhead: preview.data?.letterhead ?? null, letter: preview.data?.letter ?? null,
      fonts: { mode: 'url', baseUrl: `${API_BASE}/fs-fonts` },
    });
  }, [computed.model, style, frontMatter, preview.data]);

  const saveLayout = useSaveFsLayout(id);
  const updateReport = useUpdateFsReport(id);
  const finalize = useFinalizeFsReport(id);
  const reopen = useReopenFsReport(id);
  const saveTemplate = useSaveLayoutAsTemplate();
  const savePreset = useSavePreset();

  const save = async (): Promise<boolean> => {
    if (!detail || !layout || !style || !settings || !frontMatter) return false;
    try {
      if (dirtyLayout) {
        await saveLayout.mutateAsync({ layoutId: detail.layout.id, layout, style, expectedUpdatedAt: detail.layout.updatedAt });
        setDirtyLayout(false);
      }
      if (dirtyReport) {
        await updateReport.mutateAsync({ name, settings, frontMatter });
        setDirtyReport(false);
      }
      return true;
    } catch (e) {
      toast.error(isApiError(e) ? e.message : 'Save failed');
      return false;
    }
  };

  const doFinalize = async (override?: { reason: string }) => {
    if (!(await save())) return;
    try {
      const r = await finalize.mutateAsync(override ? { overrideValidation: true, reason: override.reason } : {});
      setFinalizeDlg(null);
      toast.success(`Finalized as version ${r.versionNo} (${r.pageCount} pages)`);
      refetch();
    } catch (e) {
      if (isApiError(e) && e.code === 'TB_FS_VALIDATION') {
        setFinalizeDlg({ checks: ((e.details as { checks?: FsCheck[] } | undefined)?.checks) ?? [] });
      } else toast.error(isApiError(e) ? e.message : 'Finalize failed');
    }
  };

  const doExport = async (format: 'pdf' | 'docx' | 'xlsx') => {
    setExportOpen(false);
    if (!isFinal && !(await save())) return;
    const current = detail?.versions.find((v) => v.status === 'final');
    try {
      await downloadFsExport(id, format, isFinal && current ? current.versionNo : null);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : 'Download failed');
    }
  };

  const loadPdf = async () => {
    if (!layout || !style || !settings || !frontMatter) return;
    setPdf({ blob: null, loading: true, error: null });
    try {
      setPdf({ blob: await fetchFsPreviewPdf(id, { layout, style, settings, frontMatter }), loading: false, error: null });
    } catch (e) {
      setPdf({ blob: null, loading: false, error: isApiError(e) ? e.message : 'Could not render the PDF' });
    }
  };

  if (isLoading || (!layout && !isError)) return <LoadingSpinner className="py-16" />;
  if (isError || !detail || !layout || !style || !settings || !frontMatter) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load these statements. <button className="underline" onClick={() => refetch()}>Retry</button></div>
      </div>
    );
  }

  const statement = layout.statements.find((s) => s.id === stmtId) ?? layout.statements[0]!;
  const setStatement = (next: FsStatementConfig) => {
    setLayout({ ...layout, statements: layout.statements.map((s) => (s.id === next.id ? next : s)) });
    setDirtyLayout(true);
  };
  const moveStatement = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= layout.statements.length) return;
    const list = [...layout.statements];
    [list[i], list[j]] = [list[j]!, list[i]!];
    setLayout({ ...layout, statements: list });
    setDirtyLayout(true);
  };
  const setS = (p: Partial<FsReportSettings>) => { setSettings({ ...settings, ...p } as FsReportSettings); setDirtyReport(true); };
  const checks = computed.model?.checks ?? [];
  const errorCount = checks.filter((c) => c.severity === 'error').length;
  const current = detail.versions.find((v) => v.status === 'final') ?? null;
  const dirty = dirtyLayout || dirtyReport;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header / settings bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <Link to="/tb/financial-statements" className="p-1 text-gray-500 hover:text-gray-800" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
          <input className="text-lg font-semibold text-gray-900 border-transparent hover:border-gray-200 rounded px-1 py-0.5 min-w-0 flex-1 max-w-md" value={name} disabled={isFinal}
            onChange={(e) => { setName(e.target.value); setDirtyReport(true); }} aria-label="Statement set name" />
          {isFinal && current && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><Lock className="h-3 w-3" />Final v{current.versionNo}</span>
          )}
          {isFinal && current?.stale && <StaleBadge reportId={id} versionNo={current.versionNo} />}
          {current?.publishedAt && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"><Globe className="h-3 w-3" />On portal</span>}
          <div className="ml-auto flex items-center gap-2">
            {!isFinal && <Button size="sm" variant="secondary" onClick={() => save()} disabled={!dirty} loading={saveLayout.isPending || updateReport.isPending}><Save className="h-4 w-4 mr-1 inline" />{dirty ? 'Save' : 'Saved'}</Button>}
            <div className="relative">
              <Button size="sm" variant="secondary" onClick={() => setExportOpen((o) => !o)}><Download className="h-4 w-4 mr-1 inline" />Download<ChevronDown className="h-3 w-3 ml-1 inline" /></Button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-20">
                  {(['pdf', 'docx', 'xlsx'] as const).map((f) => (
                    <button key={f} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50" onClick={() => doExport(f)}>
                      {{ pdf: 'PDF', docx: 'Word (.docx)', xlsx: 'Excel (.xlsx)' }[f]}{isFinal ? '' : ' — draft'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => setVersionsOpen(true)}><History className="h-4 w-4 mr-1 inline" />Versions</Button>
            {isFinal
              ? <Button size="sm" variant="secondary" loading={reopen.isPending} onClick={() => reopen.mutate(undefined, { onSuccess: () => { toast.info('Reopened — finalizing again creates a new version'); refetch(); }, onError: (e) => toast.error(isApiError(e) ? e.message : 'Reopen failed') })}><RotateCcw className="h-4 w-4 mr-1 inline" />Reopen</Button>
              : <Button size="sm" loading={finalize.isPending} onClick={() => doFinalize()}><CheckCircle2 className="h-4 w-4 mr-1 inline" />Finalize</Button>}
          </div>
        </div>
        <fieldset disabled={isFinal} className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">Period end
            <input type="date" className="rounded-md border border-gray-300 px-2 text-sm py-1" value={settings.periodEnd} onChange={(e) => e.target.value && setS({ periodEnd: e.target.value })} />
          </label>
          <label className="flex items-center gap-1.5">Basis
            <select className="rounded-md border border-gray-300 px-2 text-sm py-1" value={settings.framework} onChange={(e) => {
              const framework = e.target.value as FsReportSettings['framework'];
              setS({ framework, bookBasis: framework === 'cash' ? 'cash' : settings.bookBasis, columns: framework === 'tax' && settings.columns.mode === 'month_ytd' ? { ...settings.columns, mode: 'single' } : settings.columns });
            }}>
              <option value="gaap">GAAP</option><option value="cash">Cash basis</option><option value="tax">Income tax basis</option>
            </select>
          </label>
          {fsFrameworkNeedsBook(settings.framework) && (
            <select className="rounded-md border border-gray-300 px-2 text-sm py-1" value={settings.bookBasis} onChange={(e) => setS({ bookBasis: e.target.value as 'accrual' | 'cash' })} aria-label="Book basis">
              <option value="accrual">Accrual</option><option value="cash">Cash</option>
            </select>
          )}
          <label className="flex items-center gap-1.5">Columns
            <select className="rounded-md border border-gray-300 px-2 text-sm py-1" value={settings.columns.mode} onChange={(e) => setS({ columns: { ...settings.columns, mode: e.target.value as FsReportSettings['columns']['mode'] } })}>
              <option value="single">This period</option>
              <option value="cy_py">This year vs prior year</option>
              {settings.framework !== 'tax' && <option value="month_ytd">Month + year to date</option>}
            </select>
          </label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={settings.columns.pctOfRevenue} onChange={(e) => setS({ columns: { ...settings.columns, pctOfRevenue: e.target.checked } })} />% of revenue</label>
          {settings.columns.mode === 'cy_py' && (
            <>
              <label className="flex items-center gap-1"><input type="checkbox" checked={settings.columns.varianceAmt} onChange={(e) => setS({ columns: { ...settings.columns, varianceAmt: e.target.checked } })} />$ change</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={settings.columns.variancePct} onChange={(e) => setS({ columns: { ...settings.columns, variancePct: e.target.checked } })} />% change</label>
            </>
          )}
          <label className="flex items-center gap-1.5">Tag
            <select className="rounded-md border border-gray-300 px-2 text-sm py-1 max-w-[10rem]" value={settings.tagId ?? ''} onChange={(e) => setS({ tagId: e.target.value || null })}>
              <option value="">Whole company</option>
              {(tagsData?.tags ?? []).map((t: { id: string; name: string }) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </fieldset>
      </div>

      {isFinal && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-1.5 text-xs text-green-800">
          These statements are final and locked. The numbers, layout and PDF are frozen as version {current?.versionNo}. Reopen to make changes; finalizing again creates a new version.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-[440px] shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-0">
          <div className="flex border-b border-gray-200 text-sm">
            {([['statements', 'Statements'], ['style', 'Style'], ['front', 'Report & cover'], ['cashflow', 'Cash flow'], ['checks', `Checks${checks.length ? ` (${checks.length})` : ''}`]] as Array<[Tab, string]>).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`flex-1 px-2 py-2 text-xs font-medium ${tab === k ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500 hover:text-gray-800'} ${k === 'checks' && errorCount ? 'text-red-600' : ''}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tab === 'statements' && (
              <>
                <div className="space-y-1">
                  {layout.statements.map((s, i) => (
                    <div key={s.id} className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer ${s.id === statement.id ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50 text-gray-700'}`}
                      onClick={() => { setStmtId(s.id); setSelectedNode(null); }}>
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className={`flex-1 ${s.enabled ? '' : 'line-through text-gray-400'}`}>{STATEMENT_NAME[s.kind]}</span>
                      {!isFinal && (
                        <>
                          <button type="button" className="p-0.5 text-gray-400 hover:text-gray-700" aria-label="Move up" onClick={(e) => { e.stopPropagation(); moveStatement(i, -1); }}><ArrowUp className="h-3 w-3" /></button>
                          <button type="button" className="p-0.5 text-gray-400 hover:text-gray-700" aria-label="Move down" onClick={(e) => { e.stopPropagation(); moveStatement(i, 1); }}><ArrowDown className="h-3 w-3" /></button>
                        </>
                      )}
                    </div>
                  ))}
                  <label className="flex items-center gap-2 px-2 pt-1 text-sm text-gray-700">
                    <input type="checkbox" disabled={isFinal} checked={layout.schedules.enabled} onChange={(e) => { setLayout({ ...layout, schedules: { ...layout.schedules, enabled: e.target.checked } }); setDirtyLayout(true); }} />
                    Supporting schedules (Supplementary Information)
                  </label>
                  {layout.schedules.enabled && (
                    <div className="flex gap-2 px-2">
                      <input disabled={isFinal} className="flex-1 rounded-md border border-gray-300 px-2 text-xs py-1" value={layout.schedules.dividerTitle} onChange={(e) => { setLayout({ ...layout, schedules: { ...layout.schedules, dividerTitle: e.target.value } }); setDirtyLayout(true); }} aria-label="Divider title" />
                      <select disabled={isFinal} className="rounded-md border border-gray-300 px-2 text-xs py-1" value={layout.schedules.numbering} onChange={(e) => { setLayout({ ...layout, schedules: { ...layout.schedules, numbering: e.target.value as 'numeric' | 'alpha' } }); setDirtyLayout(true); }} aria-label="Schedule numbering">
                        <option value="numeric">Schedule 1, 2…</option><option value="alpha">Schedule A, B…</option>
                      </select>
                    </div>
                  )}
                </div>
                <hr className="border-gray-100" />
                <StatementSettingsPanel statement={statement} onChange={setStatement} readOnly={isFinal} />
                {(statement.kind === 'balance_sheet' || statement.kind === 'income_statement') && (
                  <FsOutlinePanel statement={statement} onChange={setStatement} source={preview.data?.source} selectedId={selectedNode} onSelect={setSelectedNode} readOnly={isFinal} />
                )}
                {canManageLibrary && (
                  <button type="button" className="text-xs text-primary-700 hover:underline" disabled={dirtyLayout}
                    title={dirtyLayout ? 'Save first' : undefined}
                    onClick={() => {
                      const n = window.prompt('Name for the firm layout template', `${detail.layout.name} layout`);
                      if (n) saveTemplate.mutate({ layoutId: detail.layout.id, name: n }, { onSuccess: () => toast.success('Saved to the firm library'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed') });
                    }}>Save this layout as a firm template…</button>
                )}
              </>
            )}
            {tab === 'style' && (
              <StylePanel style={style} readOnly={isFinal} library={library} canManageLibrary={canManageLibrary}
                onChange={(s) => { setStyle(s); setDirtyLayout(true); }}
                onApplyPreset={(s) => { setStyle(s); setDirtyLayout(true); }}
                onSaveAsPreset={() => {
                  const n = window.prompt('Name for the firm style');
                  if (n) savePreset.mutate({ name: n, style }, { onSuccess: () => toast.success('Style saved to the firm library'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed') });
                }} />
            )}
            {tab === 'front' && (
              <FrontMatterPanel value={frontMatter} library={library} readOnly={isFinal} onChange={(v) => { setFrontMatter(v); setDirtyReport(true); }} />
            )}
            {tab === 'cashflow' && (
              <CashFlowPanel source={preview.data?.source} overrides={cfData?.overrides ?? []} readOnly={isFinal}
                onSet={(o) => saveCf.mutate([o], { onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed') })} />
            )}
            {tab === 'checks' && (
              <ChecksPanel checks={checks} onFocus={(c) => {
                if (c.statementId) setStmtId(c.statementId);
                if (c.nodeId) setSelectedNode(c.nodeId);
                setTab('statements');
              }} />
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-1.5 text-sm">
            <div className="inline-flex rounded-md border border-gray-200 p-0.5">
              <button type="button" className={`rounded px-2 py-0.5 text-xs ${view === 'live' ? 'bg-gray-900 text-white' : 'text-gray-600'}`} onClick={() => setView('live')}><Eye className="h-3 w-3 inline mr-1" />Live</button>
              <button type="button" className={`rounded px-2 py-0.5 text-xs ${view === 'pdf' ? 'bg-gray-900 text-white' : 'text-gray-600'}`} onClick={() => { setView('pdf'); loadPdf(); }}><FileText className="h-3 w-3 inline mr-1" />Exact PDF</button>
            </div>
            {view === 'pdf' && <button type="button" className="text-xs text-primary-700 hover:underline" onClick={loadPdf}>Refresh</button>}
            {preview.isFetching && <span className="text-xs text-gray-400">Updating numbers…</span>}
            {errorCount > 0 && (
              <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs text-red-600" onClick={() => setTab('checks')}><TriangleAlert className="h-3.5 w-3.5" />{errorCount} issue{errorCount === 1 ? '' : 's'} to resolve</button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {view === 'pdf' ? <FsPdfProof {...pdf} /> : computed.error ? (
              <div className="p-6 text-sm text-red-700">{computed.error}</div>
            ) : preview.isError ? (
              <div className="p-6 text-sm text-red-700">Could not load the ledger balances. <button className="underline" onClick={() => preview.refetch()}>Retry</button></div>
            ) : html ? <FsLivePreview html={html} /> : <LoadingSpinner className="py-16" />}
          </div>
        </div>
      </div>

      {finalizeDlg && <FinalizeDialog checks={finalizeDlg.checks} busy={finalize.isPending} onCancel={() => setFinalizeDlg(null)} onConfirm={(reason) => doFinalize({ reason })} />}
      {versionsOpen && <VersionsDrawer reportId={id} detail={detail} onClose={() => setVersionsOpen(false)} />}
    </div>
  );
}

function StaleBadge({ reportId, versionNo }: { reportId: string; versionNo: number }) {
  const { data } = useFsImpact(reportId, versionNo, true);
  const text = data ? (data.changed ? 'Ledger changed — these numbers would differ now' : 'Ledger changed — these statements are unaffected') : 'Ledger changed since finalizing';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${data && !data.changed ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>
      <TriangleAlert className="h-3 w-3" />{text}
    </span>
  );
}

function FinalizeDialog({ checks, busy, onCancel, onConfirm }: { checks: FsCheck[]; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Validation issues">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-semibold text-gray-900">These statements have issues</h2></div>
        <div className="px-6 py-4 space-y-3 text-sm">
          <ul className="list-disc pl-5 space-y-1 text-red-700">{checks.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          <p className="text-gray-600">You can fix them first, or finalize anyway with a reason (recorded in the audit log and on the version).</p>
          <textarea className="w-full rounded-md border border-gray-300 px-2 text-sm" rows={3} placeholder="Reason for finalizing with these issues" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Go back and fix</Button>
          <Button variant="danger" disabled={reason.trim().length < 5} loading={busy} onClick={() => onConfirm(reason.trim())}>Finalize anyway</Button>
        </div>
      </div>
    </div>
  );
}

function VersionsDrawer({ reportId, detail, onClose }: { reportId: string; detail: NonNullable<ReturnType<typeof useFsReport>['data']>; onClose: () => void }) {
  const toast = useToast();
  const publish = usePublishFsVersion(reportId);
  const unpublish = useUnpublishFsVersion(reportId);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-xl p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Versions</h2>
          <button className="text-sm text-gray-500 hover:text-gray-800" onClick={onClose}>Close</button>
        </div>
        {!detail.versions.length && <p className="text-sm text-gray-500">Nothing finalized yet. Finalize to freeze a version you can download, share and publish to the client portal.</p>}
        <ul className="space-y-3">
          {detail.versions.map((v) => (
            <li key={v.id} className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Version {v.versionNo}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${v.status === 'final' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{v.status === 'final' ? 'Current' : 'Superseded'}</span>
                {v.stale && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Ledger changed</span>}
              </div>
              <div className="mt-1 text-xs text-gray-500">Finalized {new Date(v.finalizedAt).toLocaleString()} · {v.pageCount} pages{v.validationOverride ? ` · finalized with issues: ${v.overrideReason ?? ''}` : ''}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['pdf', 'docx', 'xlsx'] as const).map((f) => (
                  <button key={f} className="rounded border border-gray-200 px-2 py-0.5 text-xs hover:bg-gray-50" onClick={() => downloadFsExport(reportId, f, v.versionNo).catch((e) => toast.error(isApiError(e) ? e.message : 'Download failed'))}>{f.toUpperCase()}</button>
                ))}
                {v.status === 'final' && detail.report.status === 'final' && !v.publishedAt && (
                  <button className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" disabled={publish.isPending}
                    onClick={() => publish.mutate({ versionNo: v.versionNo, title: detail.report.name }, { onSuccess: () => toast.success('Published to the client portal'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Publish failed') })}>
                    <Globe className="h-3 w-3 inline mr-1" />Publish to portal
                  </button>
                )}
                {v.publishedAt && (
                  <button className="rounded border border-gray-200 px-2 py-0.5 text-xs hover:bg-gray-50" disabled={unpublish.isPending}
                    onClick={() => unpublish.mutate(v.versionNo, { onSuccess: () => toast.info('Removed from the client portal'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Unpublish failed') })}>
                    Remove from portal
                  </button>
                )}
              </div>
              {v.publishedAt && <div className="mt-1 text-xs text-blue-700">On the client portal since {new Date(v.publishedAt).toLocaleDateString()}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
