// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Electronic reconciliation sign-off (migration 0214): the sign-off panel
// (signed stamp, sign / remove buttons, stale amber state with re-sign,
// disabled-with-hint while in progress), the report Section E, and the
// sign-off badges on the reconciliation history list.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import {
  emptyReconSignoffEntry,
  type ReconSignoffEntry,
  type ReconSignoffSummary,
  type ReconSignoffView,
} from '@kis-books/shared';
import { renderRoute } from '../../test-utils';
import { bankingMocks } from '../../test-mocks';
import { makeProof } from '../reports/reconciliation/proofFixture';

const signMutate = vi.fn();
const removeMutate = vi.fn();
let view: ReconSignoffView | null = null;
let history: Array<Record<string, unknown>> = [];

vi.mock('../../api/hooks/useBanking', () => ({
  ...bankingMocks(),
  useReconciliationSignoffs: () => ({ data: view ?? undefined, isLoading: false, isError: false }),
  useSignReconciliation: () => ({ mutate: signMutate, isPending: false, variables: undefined }),
  useRemoveReconciliationSignoff: () => ({ mutate: removeMutate, isPending: false }),
  useReconciliations: (accountId: string) => ({
    data: accountId ? { reconciliations: history } : undefined, isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useUndoReconciliation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../components/forms/AccountSelector', () => ({
  AccountSelector: ({ onChange }: { onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange('acct-1')}>Pick account</button>
  ),
}));

import { ReconSignoffPanel } from './ReconSignoffPanel';
import { ReconciliationHistoryPage } from './ReconciliationHistoryPage';
import { ReconSignOffSection } from '../reports/reconciliation/ReconProofSections';

const signed = (role: 'preparer' | 'reviewer', name: string, at = '2026-10-05T15:00:00Z'): ReconSignoffEntry => ({
  ...emptyReconSignoffEntry(role), state: 'signed', signoffId: `so-${role}`, userId: `u-${role}`, signerName: name, signedAt: at,
});
const stale = (role: 'preparer' | 'reviewer', name: string, detail = 'cleared items'): ReconSignoffEntry => ({
  ...signed(role, name), state: 'stale', invalidatedAt: '2026-10-06T10:00:00Z', invalidatedReason: 'data_changed', invalidatedDetail: detail,
});

function makeView(signoffs: ReconSignoffSummary, viewer: Partial<ReconSignoffView['viewer']> = {}): ReconSignoffView {
  return {
    signoffs,
    viewer: {
      canSignPreparer: false, preparerBlockedReason: null, canSignReviewer: false, reviewerBlockedReason: null,
      canRemovePreparer: false, canRemoveReviewer: false, ...viewer,
    },
  };
}

beforeEach(() => {
  signMutate.mockReset();
  removeMutate.mockReset();
  view = null;
  history = [];
});

describe('ReconSignoffPanel', () => {
  it('shows the preparer stamp and lets a firm reviewer sign', () => {
    view = makeView(
      { signable: true, preparer: signed('preparer', 'Kurt'), reviewer: emptyReconSignoffEntry('reviewer') },
      { canSignReviewer: true, preparerBlockedReason: 'Already signed by the preparer.' },
    );
    renderRoute(<ReconSignoffPanel reconId="rec-1" />);
    const prep = screen.getByTestId('recon-signoff-preparer');
    expect(within(prep).getByTestId('recon-signoff-preparer-stamp').textContent).toMatch(/\/s\/ Kurt, 10\/0[45]\/2026 \d{1,2}:\d\d (AM|PM) \S+/);
    const rev = screen.getByTestId('recon-signoff-reviewer');
    expect(within(rev).getByText('Not signed')).toBeTruthy();
    const btn = within(rev).getByRole('button', { name: /Sign as reviewer/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(signMutate).toHaveBeenCalledWith({ id: 'rec-1', role: 'reviewer' }, expect.any(Object));
  });

  it('disables reviewer signing with the reason (same person / not firm staff)', () => {
    view = makeView(
      { signable: true, preparer: signed('preparer', 'Kurt'), reviewer: emptyReconSignoffEntry('reviewer') },
      { canRemovePreparer: true, reviewerBlockedReason: 'The reviewer must be a different person than the preparer.' },
    );
    renderRoute(<ReconSignoffPanel reconId="rec-1" />);
    const rev = screen.getByTestId('recon-signoff-reviewer');
    expect((within(rev).getByRole('button', { name: /Sign as reviewer/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(rev).getByTestId('recon-signoff-reviewer-hint').textContent).toContain('different person');
    // The preparer can withdraw their own sign-off.
    fireEvent.click(within(screen.getByTestId('recon-signoff-preparer')).getByRole('button', { name: 'Remove my sign-off' }));
    expect(removeMutate).toHaveBeenCalledWith({ id: 'rec-1', role: 'preparer' }, expect.any(Object));
  });

  it('shows a stale sign-off in amber with a re-sign button', () => {
    view = makeView(
      { signable: true, preparer: stale('preparer', 'Kurt'), reviewer: stale('reviewer', 'Riley') },
      { canSignPreparer: true, reviewerBlockedReason: 'The preparer must sign off before the reviewer.' },
    );
    renderRoute(<ReconSignoffPanel reconId="rec-1" />);
    const p = screen.getByTestId('recon-signoff-preparer-stale');
    expect(p.className).toContain('amber');
    expect(p.textContent).toMatch(/Signed off by Kurt on .* — data changed since \(cleared items\); re-sign required/);
    expect(screen.getByTestId('recon-signoff-reviewer-stale').textContent).toContain('Signed off by Riley');
    const resign = screen.getByRole('button', { name: /Re-sign as preparer/ });
    fireEvent.click(resign);
    expect(signMutate).toHaveBeenCalledWith({ id: 'rec-1', role: 'preparer' }, expect.any(Object));
    expect((screen.getByRole('button', { name: /Re-sign as reviewer/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables both buttons with a hint on an in-progress reconciliation', () => {
    const reason = 'Only a completed reconciliation can be signed off.';
    view = makeView(
      { signable: false, preparer: emptyReconSignoffEntry('preparer'), reviewer: emptyReconSignoffEntry('reviewer') },
      { preparerBlockedReason: reason, reviewerBlockedReason: reason },
    );
    renderRoute(<ReconSignoffPanel reconId="rec-1" />);
    expect(screen.getByTestId('recon-signoff-not-complete').textContent).toContain('Complete the reconciliation');
    for (const name of [/Sign as preparer/, /Sign as reviewer/]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByTestId('recon-signoff-preparer-hint').textContent).toBe(reason);
  });
});

describe('Report Section E', () => {
  it('prints the stored stamps', () => {
    const proof = makeProof();
    proof.signOff.signoffs = { signable: true, preparer: signed('preparer', 'Kurt'), reviewer: signed('reviewer', 'Riley') };
    renderRoute(<ReconSignOffSection proof={proof} />);
    const sec = screen.getByTestId('recon-signoff');
    expect(sec.textContent).toContain('/s/ Kurt');
    expect(sec.textContent).toContain('/s/ Riley');
    expect(sec.textContent).toContain('Completed in the books by Kurt');
  });

  it('flags a stale sign-off and "Not signed"', () => {
    const proof = makeProof();
    proof.signOff.signoffs = { signable: true, preparer: stale('preparer', 'Kurt'), reviewer: emptyReconSignoffEntry('reviewer') };
    renderRoute(<ReconSignOffSection proof={proof} />);
    const sec = screen.getByTestId('recon-signoff');
    expect(sec.textContent).toContain('Stale — data changed after sign-off');
    expect(sec.textContent).toContain('Not signed');
    expect(screen.getByTestId('recon-signoff-section-stale-preparer').textContent).toContain('re-sign required');
  });
});

describe('Reconciliation history — sign-off badges', () => {
  it('shows reviewed / prepared / stale / not signed per reconciliation', () => {
    const base = {
      accountId: 'acct-1', statementEndingBalance: '100.0000', beginningBalance: '0', clearedBalance: '100', difference: '0',
      completedBy: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenantId: 't1',
    };
    history = [
      { ...base, id: 'r4', statementDate: '2026-04-30', status: 'complete', completedAt: '2026-05-02T00:00:00Z',
        signoffs: { signable: true, preparer: signed('preparer', 'Kurt'), reviewer: signed('reviewer', 'Riley') } },
      { ...base, id: 'r3', statementDate: '2026-03-31', status: 'complete', completedAt: '2026-04-02T00:00:00Z',
        signoffs: { signable: true, preparer: signed('preparer', 'Kurt'), reviewer: emptyReconSignoffEntry('reviewer') } },
      { ...base, id: 'r2', statementDate: '2026-02-28', status: 'complete', completedAt: '2026-03-02T00:00:00Z',
        signoffs: { signable: true, preparer: stale('preparer', 'Kurt'), reviewer: stale('reviewer', 'Riley') } },
      { ...base, id: 'r1', statementDate: '2026-01-31', status: 'complete', completedAt: '2026-02-02T00:00:00Z',
        signoffs: { signable: true, preparer: emptyReconSignoffEntry('preparer'), reviewer: emptyReconSignoffEntry('reviewer') } },
    ];
    renderRoute(<ReconciliationHistoryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick account' }));
    const badges = screen.getAllByTestId('recon-signoff-badge').map((b) => b.textContent);
    expect(badges).toEqual(['Prepared & reviewed', 'Prepared — awaiting review', 'Stale — re-sign required', 'Not signed']);
    const staleBadge = screen.getAllByTestId('recon-signoff-badge')[2]!;
    expect(staleBadge.className).toContain('amber');
    expect(staleBadge.getAttribute('title')).toContain('re-sign required');
  });
});
