// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { EstimateResultDTO } from '@kis-books/shared';
import type { TraceScope } from './calcLines';

export interface TraceItem { id: string; label: string; amount: string; formula?: string; source: string; marginalRate?: string }

/** Trace rows for a drill-down scope (rows come straight from the engine; nothing is derived here). */
export function traceRowsFor(r: EstimateResultDTO, scope: TraceScope): TraceItem[] {
  if (scope.kind === 'federal') {
    return r.federal.trace
      .filter((t) => scope.steps.includes(t.step) && (!scope.idPrefix || t.id.startsWith(scope.idPrefix)))
      .map((t) => ({ id: t.id, label: t.label, amount: t.amount, formula: t.formula, source: t.source, marginalRate: t.marginalRate }));
  }
  if (scope.kind === 'state') {
    return (r.state?.trace ?? [])
      .filter((t) => !scope.state || t.state === scope.state)
      .map((t) => ({ id: t.id, label: t.label, amount: t.amount, formula: t.formula, source: t.source }));
  }
  const est = scope.jurisdiction === 'federal' ? r.federalEstimates : r.stateEstimates.find((e) => e.jurisdiction === scope.jurisdiction);
  return (est?.trace ?? []).map((t) => ({ id: t.id, label: t.label, amount: t.amount, formula: t.formula, source: t.source }));
}
