// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo } from 'react';
import { useRegisterCompanyFlags } from '../../../api/hooks/useTaxEstimatorRegister';
import { useTaxEstimatorVisibility } from '../../../hooks/useTaxEstimatorVisibility';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Ids of the active company's transactions flagged non-recurring for the Tax Estimator,
 * for the register's "NR" badge. Empty (and no request) unless the caller can use the
 * Tax Estimator here; empty when the company is not linked to a taxpayer or on any error.
 */
export function useRegisterNonRecurringIds(): ReadonlySet<string> {
  const { ready, showGroup } = useTaxEstimatorVisibility();
  const q = useRegisterCompanyFlags(ready && showGroup);
  return useMemo(() => (q.data?.linked ? new Set(q.data.transactionIds) : EMPTY), [q.data]);
}
