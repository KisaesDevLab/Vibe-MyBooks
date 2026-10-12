// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Link } from 'react-router-dom';
import type { EstimateResultDTO, EstimateReadinessDTO } from '@kis-books/shared';
import { fmtMonth } from './format';

interface Props {
  taxpayerId: string;
  taxYear: number;
  estimate: EstimateResultDTO;
  readiness: EstimateReadinessDTO | undefined;
  readinessError?: boolean;
}

interface Item { key: string; text: React.ReactNode }

/** Readiness banner: every item says what is wrong and links to where it is fixed (UI-SPEC 01). */
export function ReadinessBanner({ taxpayerId, taxYear, estimate, readiness, readinessError }: Props) {
  const items: Item[] = [];
  for (const e of readiness?.entities ?? []) {
    if (!e.inScope || !e.readiness) continue;
    const entityLink = (
      <Link className="underline" to={`/tax-estimator/entities/${e.tenantId}/${e.companyId}`}>Open entity tax setup</Link>
    );
    const name = e.companyName ?? 'Linked company';
    for (const a of e.readiness.unreconciledAccounts) {
      items.push({ key: `unrec:${e.companyId}:${a.accountId}`, text: <>{name}: <strong>{a.name}</strong> not reconciled through {fmtMonth(e.readiness.throughMonth)}. {entityLink}</> });
    }
    if (Math.abs(Number(e.readiness.suspense.balance)) > 0) {
      items.push({ key: `susp:${e.companyId}`, text: <>{name}: suspense account holds a balance ({e.readiness.suspense.transactionCount} transactions). {entityLink}</> });
    }
    if (e.readiness.unmappedAccounts.length > 0) {
      items.push({ key: `unmapped:${e.companyId}`, text: <>{name}: {e.readiness.unmappedAccounts.length} account(s) with activity have no tax treatment. {entityLink}</> });
    }
    for (const w of e.readiness.warnings) items.push({ key: `rw:${e.companyId}:${w.code}`, text: <>{name}: {w.message} {entityLink}</> });
  }
  if ((readiness?.outOfScopeLinks ?? 0) > 0) items.push({ key: 'oos', text: <>{readiness!.outOfScopeLinks} linked company(ies) are outside your access and are left out of this estimate.</> });
  const provisional = estimate.parametersUsed.filter((p) => p.status !== 'verified');
  if (provisional.length > 0) {
    items.push({ key: 'params', text: <>{provisional.length} federal parameter(s) are <strong>{provisional.some((p) => p.status === 'provisional') ? 'provisional' : 'unverified'}</strong> (not CPA-verified).</> });
  }
  // R7-11: state rules are counted from rulesUsed, separately from the federal parameters.
  const unverifiedRules = estimate.rulesUsed.filter((p) => p.status !== 'verified');
  const states = [...new Set(unverifiedRules.map((p) => p.state))];
  if (states.length > 0) {
    const n = new Set(unverifiedRules.map((p) => `${p.state}:${p.key}`)).size;
    items.push({ key: 'rules', text: <>{n} state rule(s) are <strong>{unverifiedRules.some((p) => p.status === 'provisional') ? 'provisional' : 'unverified'}</strong> ({states.join(', ')}) (not CPA-verified); the values shown use the current rule set.</> });
  }
  for (const w of estimate.warnings) {
    if (/FALLBACK|PRIOR_YEAR|TE_ENTITY|ENTITY_TYPE|TAX_METHOD|OWNERSHIP|PCT/.test(w.code)) {
      items.push({ key: `w:${w.code}`, text: <>{w.message} {w.code === 'TE_PARAMS_FALLBACK_YEAR' ? 'Values are provisional.' : null}{/PRIOR_YEAR/.test(w.code) && <> <Link className="underline" to={`/tax-estimator/taxpayers/${taxpayerId}/annual-settings?year=${taxYear}`}>Open annual settings</Link></>}</> });
    }
  }
  if (readinessError) items.push({ key: 'rerr', text: <>Books readiness could not be loaded.</> });

  if (items.length === 0) {
    return <div role="status" aria-label="Books readiness" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Books readiness: no issues found.</div>;
  }
  return (
    <div role="status" aria-label="Books readiness" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
      <div className="font-semibold">Books readiness &middot; {items.length} item{items.length === 1 ? '' : 's'}</div>
      {items.map((i) => <div key={i.key}>{i.text}</div>)}
    </div>
  );
}
