// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Trial Balance → Financial Statements: the company's report-ready
// statement sets (drafts + finals), and the "New statements" wizard
// (period, basis, columns, layout source with leadsheet binding, style).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookMarked, CheckCircle2, FilePlus2, Globe, RotateCw, Trash2, TriangleAlert } from 'lucide-react';
import type { FsColumnMode, FsFramework } from '@kis-books/shared';
import {
  useArchiveFsReport, useCreateFsReport, useFsBindPreview, useFsLayouts, useFsLibrary, useFsReports, useRollForwardFsReport,
} from '../../../api/hooks/useFinancialStatements';
import { useTbProfile } from '../../../api/hooks/useTb';
import { isApiError } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Pagination } from '../../../components/ui/Pagination';
import { useToast } from '../../../components/ui/Toaster';

export const FRAMEWORK_LABEL: Record<FsFramework, string> = {
  gaap: 'GAAP',
  cash: 'Cash basis',
  tax: 'Income tax basis',
};

const PAGE = 25;

export function FsReportListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, refetch } = useFsReports({ limit: PAGE, offset });
  const [creating, setCreating] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const archive = useArchiveFsReport();
  const roll = useRollForwardFsReport();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Financial Statements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Report-ready statements built on your leadsheets — balance sheet, income statement, equity, cash flows and supporting schedules.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/tb/financial-statements/library">
            <Button variant="secondary"><BookMarked className="h-4 w-4 mr-1.5 inline" />Firm library</Button>
          </Link>
          <Button onClick={() => setCreating(true)}><FilePlus2 className="h-4 w-4 mr-1.5 inline" />New statements</Button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-16" /> : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load financial statements. <button className="underline" onClick={() => refetch()}>Retry</button>
        </div>
      ) : !data?.reports.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-700 font-medium">No financial statements yet</p>
          <p className="text-sm text-gray-500 mt-1">Start from the built-in layout or one of your firm&apos;s templates.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}>New statements</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Period end</th>
                <th className="px-4 py-2 font-medium">Basis</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/tb/financial-statements/${r.id}`)}>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-gray-700">{r.periodEnd}</td>
                  <td className="px-4 py-2 text-gray-700">{FRAMEWORK_LABEL[r.framework]}{r.framework !== 'cash' ? ` · ${r.bookBasis}` : ''}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.status === 'final' && r.currentVersion ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><CheckCircle2 className="h-3 w-3" />Final v{r.currentVersion.versionNo}</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Draft</span>
                      )}
                      {r.status === 'final' && r.currentVersion?.stale && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title="The ledger changed after these statements were finalized"><TriangleAlert className="h-3 w-3" />Ledger changed</span>
                      )}
                      {r.currentVersion?.publishedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"><Globe className="h-3 w-3" />On portal</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-800" title="Roll forward to next year"
                      onClick={() => roll.mutate(r.id, {
                        onSuccess: (res) => navigate(`/tb/financial-statements/${res.report.id}`),
                        onError: (e) => toast.error(isApiError(e) ? e.message : 'Roll forward failed'),
                      })}
                    ><RotateCw className="h-4 w-4" /></button>
                    <button className="p-1.5 text-gray-500 hover:text-red-600" title="Archive" onClick={() => setArchiveId(r.id)}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100">
            <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
          </div>
        </div>
      )}

      {creating && <NewStatementsDialog onClose={() => setCreating(false)} onCreated={(id) => navigate(`/tb/financial-statements/${id}`)} />}
      <ConfirmDialog
        open={!!archiveId}
        title="Archive these statements?"
        message="Finalized versions and portal copies are kept; the set disappears from this list."
        confirmLabel="Archive"
        variant="danger"
        onCancel={() => setArchiveId(null)}
        onConfirm={() => {
          if (archiveId) archive.mutate(archiveId, { onError: (e) => toast.error(isApiError(e) ? e.message : 'Archive failed') });
          setArchiveId(null);
        }}
      />
    </div>
  );
}

type Source = { kind: 'default' } | { kind: 'company_layout'; id: string } | { kind: 'template'; id: string };

function NewStatementsDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const { data: profile } = useTbProfile();
  const { data: library } = useFsLibrary();
  const { data: layouts } = useFsLayouts();
  const create = useCreateFsReport();
  const bind = useFsBindPreview();
  const defaultEnd = profile?.fiscal.priorFiscalYearEnd ?? `${new Date().getFullYear() - 1}-12-31`;
  const [name, setName] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [framework, setFramework] = useState<FsFramework>('gaap');
  const [bookBasis, setBookBasis] = useState<'accrual' | 'cash'>(profile?.fiscal.accountingMethod === 'cash' ? 'cash' : 'accrual');
  const [mode, setMode] = useState<FsColumnMode>('cy_py');
  const [pct, setPct] = useState(false);
  const [varAmt, setVarAmt] = useState(false);
  const [varPct, setVarPct] = useState(false);
  const [source, setSource] = useState<Source>({ kind: 'default' });
  const [presetId, setPresetId] = useState<string>('');
  const [resolutions, setResolutions] = useState<Record<string, string | null>>({});
  const end = periodEnd || defaultEnd;
  const effMode: FsColumnMode = framework === 'tax' && mode === 'month_ytd' ? 'single' : mode;

  const pickSource = (s: Source) => {
    setSource(s);
    setResolutions({});
    if (s.kind === 'template' || s.kind === 'default') bind.mutate(s.kind === 'template' ? s.id : null);
    else bind.reset();
  };

  const submit = () => {
    create.mutate({
      name: name.trim() || `Financial Statements ${end.slice(0, 4)}`,
      settings: {
        periodEnd: end, framework, bookBasis: framework === 'cash' ? 'cash' : bookBasis,
        columns: { mode: effMode, pctOfRevenue: pct, varianceAmt: effMode === 'cy_py' && varAmt, variancePct: effMode === 'cy_py' && varPct },
        tagId: null,
      },
      layoutSource: source.kind === 'company_layout'
        ? { kind: 'company_layout', companyLayoutId: source.id }
        : source.kind === 'template'
          ? { kind: 'template', templateId: source.id, resolutions }
          : { kind: 'default' },
      stylePresetId: presetId || null,
    }, {
      onSuccess: (res) => onCreated(res.report.id),
      onError: (e) => toast.error(isApiError(e) ? e.message : 'Could not create the statements'),
    });
  };

  const unresolved = bind.data?.unresolved ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New financial statements">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New financial statements</h2>
        </div>
        <div className="px-6 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-gray-700 font-medium">Name</span>
              <input className="mt-1 w-full rounded-md border border-gray-300 px-2 text-sm" placeholder={`Financial Statements ${end.slice(0, 4)}`} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-gray-700 font-medium">Period end</span>
              <input type="date" className="mt-1 w-full rounded-md border border-gray-300 px-2 text-sm" value={end} onChange={(e) => setPeriodEnd(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-gray-700 font-medium">Reporting basis</span>
              <select className="mt-1 w-full rounded-md border border-gray-300 px-2 text-sm" value={framework} onChange={(e) => setFramework(e.target.value as FsFramework)}>
                <option value="gaap">GAAP (book)</option>
                <option value="cash">Cash basis</option>
                <option value="tax">Income tax basis (uses the Tax column)</option>
              </select>
            </label>
            {framework !== 'cash' && (
              <label className="block">
                <span className="text-gray-700 font-medium">Book basis</span>
                <select className="mt-1 w-full rounded-md border border-gray-300 px-2 text-sm" value={bookBasis} onChange={(e) => setBookBasis(e.target.value as 'accrual' | 'cash')}>
                  <option value="accrual">Accrual</option>
                  <option value="cash">Cash</option>
                </select>
              </label>
            )}
          </div>

          <fieldset>
            <legend className="text-gray-700 font-medium">Columns</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {([['single', 'This period only'], ['cy_py', 'This year vs prior year'], ['month_ytd', 'Month + year to date']] as const).map(([v, l]) => (
                <label key={v} className={`inline-flex items-center gap-1.5 ${framework === 'tax' && v === 'month_ytd' ? 'opacity-40' : ''}`}>
                  <input type="radio" name="mode" checked={effMode === v} disabled={framework === 'tax' && v === 'month_ytd'} onChange={() => setMode(v)} />{l}
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-gray-600">
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={pct} onChange={(e) => setPct(e.target.checked)} />% of revenue</label>
              {effMode === 'cy_py' && <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={varAmt} onChange={(e) => setVarAmt(e.target.checked)} />$ change</label>}
              {effMode === 'cy_py' && <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={varPct} onChange={(e) => setVarPct(e.target.checked)} />% change</label>}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-gray-700 font-medium">Layout</legend>
            <div className="mt-1 space-y-1">
              <label className="flex items-center gap-2"><input type="radio" checked={source.kind === 'default'} onChange={() => pickSource({ kind: 'default' })} />Built-in layout (from your leadsheets)</label>
              {(layouts?.layouts ?? []).map((l) => (
                <label key={l.id} className="flex items-center gap-2"><input type="radio" checked={source.kind === 'company_layout' && source.id === l.id} onChange={() => pickSource({ kind: 'company_layout', id: l.id })} />This client&apos;s layout: {l.name}</label>
              ))}
              {(library?.templates ?? []).map((t) => (
                <label key={t.id} className="flex items-center gap-2"><input type="radio" checked={source.kind === 'template' && source.id === t.id} onChange={() => pickSource({ kind: 'template', id: t.id })} />Firm template: {t.name}</label>
              ))}
            </div>
            {source.kind !== 'company_layout' && unresolved.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-amber-800 font-medium">Match these template lines to this client&apos;s leadsheets</p>
                <div className="mt-2 space-y-1.5">
                  {unresolved.map((u) => (
                    <div key={u.nodeId} className="flex items-center gap-2">
                      <span className="w-48 truncate text-gray-800">{u.caption}{u.leadsheetCode ? ` (${u.leadsheetCode})` : ''}</span>
                      <select className="flex-1 rounded-md border border-gray-300 px-2 text-sm" value={resolutions[u.nodeId] === null ? '__drop' : resolutions[u.nodeId] ?? ''}
                        onChange={(e) => setResolutions((r) => {
                          const next = { ...r };
                          if (e.target.value === '') delete next[u.nodeId];
                          else next[u.nodeId] = e.target.value === '__drop' ? null : e.target.value;
                          return next;
                        })}>
                        <option value="">Leave unlinked (shows a warning)</option>
                        <option value="__drop">Remove this line</option>
                        {(bind.data?.groupings ?? []).map((g) => <option key={g.id} value={g.id}>{g.code ? `${g.code} — ` : ''}{g.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {source.kind !== 'company_layout' && (
            <label className="block">
              <span className="text-gray-700 font-medium">Style</span>
              <select className="mt-1 w-full rounded-md border border-gray-300 px-2 text-sm" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                <option value="">Firm default</option>
                {(library?.presets ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending}>Create</Button>
        </div>
      </div>
    </div>
  );
}
