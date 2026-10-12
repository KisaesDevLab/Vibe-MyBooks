// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { FederalResult } from '@kis-books/shared';
import { dollars, num } from './format';

interface Props {
  persons: FederalResult['persons'];
  /** Return-level Form 8959 tax (FederalResult.additionalMedicareTax); the engine does not split it per person. */
  additionalMedicareTax: string;
}

/**
 * UI-SPEC §01 "Income by source … plus per-person SE tax tiles". Every figure is
 * read straight from the engine's PersonResult — no tax math here.
 */
export function SeTaxTiles({ persons, additionalMedicareTax }: Props) {
  return (
    <section aria-label="Self-employment tax by person" className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">Self-employment tax by person</h2>
      {persons.length === 0 ? (
        <p className="text-sm text-gray-500">No people are recorded for this taxpayer, so there is no self-employment tax to show.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {persons.map((p) => {
            const hasSe = num(p.seIncome) !== 0;
            return (
              <div key={p.personId} role="group" aria-label={`${p.displayName} self-employment tax`} className="rounded-lg bg-gray-50 px-3 py-2.5 space-y-1">
                <div className="text-xs text-gray-600">{p.displayName} &middot; SE tax</div>
                <div className="text-lg font-semibold tabular-nums text-gray-900">{dollars(p.seTax)}</div>
                {hasSe ? (
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-xs text-gray-600">
                    <dt>SE income</dt><dd className="tabular-nums text-right">{dollars(p.seIncome)}</dd>
                    <dt>½ SE tax deduction</dt><dd className="tabular-nums text-right">{dollars(p.halfSeTax)}</dd>
                  </dl>
                ) : (
                  <p className="text-xs text-gray-600">
                    No self-employment income{num(p.totalWages) > 0 ? ` · wages ${dollars(p.totalWages)}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {num(additionalMedicareTax) > 0 && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-gray-100 pt-2 text-sm">
          <dt className="text-gray-600">Additional Medicare tax (household, Form 8959)</dt>
          <dd className="tabular-nums">{dollars(additionalMedicareTax)}</dd>
        </dl>
      )}
    </section>
  );
}
