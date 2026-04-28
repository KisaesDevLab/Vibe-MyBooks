// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo, useState } from 'react';
import type { Finding, FindingSeverity, FindingStatus } from '@kis-books/shared';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import {
  useCheckRegistry,
  useFindings,
  useFindingsSummary,
} from '../../../api/hooks/useReviewChecks';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { RunChecksBar } from './findings/RunChecksBar';
import { FindingsSummary } from './findings/FindingsSummary';
import { FindingsFilterBar } from './findings/FindingsFilterBar';
import { FindingsTable } from './findings/FindingsTable';
import { FindingsBulkBar } from './findings/FindingsBulkBar';
import { FindingDetailDrawer } from './findings/FindingDetailDrawer';

// Phase 7 — full Close-Review > Findings dashboard. Composition:
//   - "Run checks now" + last-run telemetry (RunChecksBar)
//   - Severity + status summary tiles, click to filter
//   - Filter bar (status / severity / check)
//   - Bulk bar (visible only when selection > 0)
//   - Findings table with row click → drawer
//   - Drawer with state-transition actions, history, "ignore similar"
// Defaults to status='open' so the first thing the bookkeeper
// sees is what still needs their attention.
export function FindingsTab() {
  const { activeCompanyId } = useCompanyContext();
  const [statusFilter, setStatusFilter] = useState<FindingStatus | null>('open');
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | null>(null);
  const [checkFilter, setCheckFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);

  const registryQ = useCheckRegistry();
  const summaryQ = useFindingsSummary(activeCompanyId ?? null);
  const findingsQ = useFindings({
    status: statusFilter ?? undefined,
    severity: severityFilter ?? undefined,
    checkKey: checkFilter ?? undefined,
    companyId: activeCompanyId ?? null,
    limit: 100,
  });

  const rows = findingsQ.data?.rows ?? [];
  const registry = registryQ.data?.checks ?? [];
  const selectedFindings = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );

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
  const clearFilters = () => {
    setStatusFilter(null);
    setSeverityFilter(null);
    setCheckFilter(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <RunChecksBar companyId={activeCompanyId ?? null} />
      <FindingsSummary
        summary={summaryQ.data}
        activeStatus={statusFilter}
        activeSeverity={severityFilter}
        onStatusClick={(s) => {
          setStatusFilter(s);
          clearAll();
        }}
        onSeverityClick={(s) => {
          setSeverityFilter(s);
          clearAll();
        }}
      />
      <FindingsFilterBar
        status={statusFilter}
        severity={severityFilter}
        checkKey={checkFilter}
        registry={registry}
        onStatus={(s) => {
          setStatusFilter(s);
          clearAll();
        }}
        onSeverity={(s) => {
          setSeverityFilter(s);
          clearAll();
        }}
        onCheckKey={(k) => {
          setCheckFilter(k);
          clearAll();
        }}
        onClearAll={() => {
          clearFilters();
          clearAll();
        }}
      />
      <FindingsBulkBar
        selectedIds={Array.from(selected)}
        selectedFindings={selectedFindings}
        onCleared={clearAll}
      />
      {findingsQ.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={!!(statusFilter || severityFilter || checkFilter)} />
      ) : (
        <FindingsTable
          rows={rows}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={setActiveFinding}
          registry={registry}
        />
      )}
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

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="text-sm font-semibold text-gray-900">
        {hasFilters ? 'No findings match these filters' : 'No findings yet'}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        {hasFilters
          ? 'Try clearing a filter, or run checks now to surface fresh anomalies.'
          : 'Reviewer checks (duplicate detection, materiality, missing W-9, etc.) run automatically every 24 hours per company. You can also run them on demand above.'}
      </p>
    </div>
  );
}
