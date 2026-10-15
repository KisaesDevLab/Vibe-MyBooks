// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// The Calculation table's line builder lives in @kis-books/shared (tax-estimator/calc-lines.ts)
// so the screen and the estimate PDF's "Detailed calculation" page print the same lines.
export { buildCalcSections, calcEntityTypeLabel, type CalcLine, type CalcSection, type TraceScope } from '@kis-books/shared';
