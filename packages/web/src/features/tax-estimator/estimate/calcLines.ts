// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The Calculation table's line builder lives in @kis-books/shared (tax-estimator/calc-lines.ts)
// so the screen and the estimate PDF's "Detailed calculation" page print the same lines.
export { buildCalcSections, calcEntityTypeLabel, type CalcLine, type CalcSection, type TraceScope } from '@kis-books/shared';
