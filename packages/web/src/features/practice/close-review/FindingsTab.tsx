// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo, useState } from 'react';
import { CLOSE_REPORTS, CLOSE_SECTIONS, closeReportFor, type Finding, type FindingStatus } from '@kis-books/shared';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import {
  useCheckRegistry,
  useFindingsInfinite,
  useReportCounts,
  type ReportCount,
} from '../../../api/hooks/useReviewChecks';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import type { ClosePeriod } from './ClosePeriodSelector';
import { RunChecksBar } from './findings/RunChecksBar';
import { FindingsTable } from './findings/FindingsTable';
import { FindingsBulkBar } from './findings/FindingsBulkBar';
import { FindingDetailDrawer } from './findings/FindingDetailDrawer';

// Close Review → Review. Double-style exception reports: the left rail lists
// every report by section with its open count for the month; the right side
// shows the selected report's rows. Views: To review / Accepted / Dismissed.
// Row actions live in the bulk bar (Accept, Dismiss, Exclude payee, Ask the
// client) and the detail drawer (payee history, fix, suppress).
interface Props {
  period: ClosePeriod;
}

type ReviewView = 'open' | 'resolved' | 'ignored';
const VIEW_LABEL: Record<ReviewView, string> = { open: 'To review', resolved: 'Accepted', ignored: 'Dismissed' };

export function FindingsTab({ period }: Props) {
  const { activeCompanyId } = useCompanyContext();
  // null = every report; otherwise one check key (one report).
  const [report, setReport] = useState<string | null>(null);
  const [view, setView] = useState<ReviewView>('open');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);

  const registryQ = useCheckRegistry();
  const countsQ = useReportCounts(activeCompanyId ?? null, period.periodStart, period.periodEnd);
  const findingsQ = useFindingsInfinite({
    status: view as FindingStatus,
    checkKey: report ?? undefined,
    companyId: activeCompanyId ?? null,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    limit: 100,
  });

  // Loaded rows only — select-all and the bulk bar operate on these.
  const rows = useMemo(
    () => findingsQ.data?.pages.flatMap((p) => p.rows) ?? [],
    [findingsQ.data],
  );
  const registry = registryQ.data?.checks ?? [];
  const selectedFindings = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );
  const counts = countsQ.data?.counts ?? [];

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  };
  const clearAll = () => setSelected(new Set());
  const reportTitle = report ? closeReportFor(report).title : 'All reports';

  return (
    <div className="flex flex-col gap-4">
      <RunChecksBar companyId={activeCompanyId ?? null} period={period} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ReportNav
          counts={counts}
          active={report}
          onSelect={(k) => { setReport(k); clearAll(); }}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">{reportTitle}</h2>
            <div role="tablist" aria-label="Review status" className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              {(Object.keys(VIEW_LABEL) as ReviewView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => { setView(v); clearAll(); }}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${view === v ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <FindingsBulkBar
            selectedIds={Array.from(selected)}
            selectedFindings={selectedFindings}
            onCleared={clearAll}
            companyId={activeCompanyId ?? null}
          />
          {findingsQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState hasFilters={view !== 'open' || !!report} />
          ) : (
            <>
              <FindingsTable
                rows={rows}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onRowClick={setActiveFinding}
                registry={registry}
              />
              <div className="flex flex-col items-center gap-1.5 py-1">
                <span className="text-xs text-gray-500">
                  Showing {rows.length} row{rows.length === 1 ? '' : 's'}{findingsQ.hasNextPage ? ' — more available' : ''}
                </span>
                {findingsQ.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => void findingsQ.fetchNextPage()}
                    disabled={findingsQ.isFetchingNextPage}
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {findingsQ.isFetchingNextPage ? 'Loading…' : `Load more (${rows.length} loaded)`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {activeFinding && (
        <FindingDetailDrawer
          finding={activeFinding}
          registry={registry}
          onClose={() => setActiveFinding(null)}
        />
      )}
    </div>
  );
}

// Left rail: sections in review order, each report with its open count.
// Reports with nothing this month are listed quietly so the reviewer can
// see the check ran and came back clean.
function ReportNav({ counts, active, onSelect }: {
  counts: ReportCount[];
  active: string | null;
  onSelect: (checkKey: string | null) => void;
}) {
  const byKey = new Map(counts.map((c) => [c.checkKey, c]));
  const totalOpen = counts.reduce((a, c) => a + c.open, 0);
  // Reports the catalog doesn't know still appear, under "Other checks".
  const known = new Set(CLOSE_REPORTS.map((r) => r.checkKey));
  const extras = counts.filter((c) => !known.has(c.checkKey)).map((c) => closeReportFor(c.checkKey));
  const all = [...CLOSE_REPORTS, ...extras];
  const item = (key: string | null, title: string, open: number) => (
    <li key={key ?? 'all'}>
      <button
        type="button"
        onClick={() => onSelect(key)}
        aria-current={active === key ? 'true' : undefined}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
          active === key ? 'bg-indigo-50 font-medium text-indigo-800' : open > 0 ? 'text-gray-800 hover:bg-gray-50' : 'text-gray-400 hover:bg-gray-50'
        }`}
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className={`shrink-0 rounded-full px-1.5 text-xs tabular-nums ${open > 0 ? 'bg-amber-100 text-amber-800' : 'text-gray-400'}`}>
          {open}
        </span>
      </button>
    </li>
  );
  return (
    <nav aria-label="Review reports" className="rounded-lg border border-gray-200 bg-white p-2 lg:self-start">
      <ul className="mb-2">{item(null, 'All reports', totalOpen)}</ul>
      {CLOSE_SECTIONS.map((sec) => {
        const reports = all.filter((r) => r.section === sec.key);
        if (reports.length === 0) return null;
        return (
          <div key={sec.key} className="mb-2">
            <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{sec.title}</div>
            <ul>{reports.map((r) => item(r.checkKey, r.title, byKey.get(r.checkKey)?.open ?? 0))}</ul>
          </div>
        );
      })}
    </nav>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="text-sm font-semibold text-gray-900">
        {hasFilters ? 'Nothing in this view' : 'Nothing to review'}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        {hasFilters
          ? 'No rows in this report and view for the selected month. Pick another report on the left, or switch between To review, Accepted and Dismissed.'
          : 'Reviewer checks (duplicate detection, large transactions, missing W-9, etc.) run only when you start them, for the selected period. Click Run checks now above.'}
      </p>
    </div>
  );
}
