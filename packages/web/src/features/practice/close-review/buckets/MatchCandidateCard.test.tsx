// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { MatchCandidate } from '@kis-books/shared';
import { renderRoute } from '../../../../test-utils';

// Stable spy refs so vi.mock factories (which hoist) can reference
// them and tests can assert on them.
const { applyFn, notAMatchFn } = vi.hoisted(() => ({
  applyFn: vi.fn(),
  notAMatchFn: vi.fn(),
}));

vi.mock('../../../../api/hooks/useMatchActions', () => ({
  useApplyMatch: () => ({ mutate: applyFn, isPending: false }),
  useNotAMatch: () => ({ mutate: notAMatchFn, isPending: false }),
  useRematch: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { MatchCandidateCard } from './MatchCandidateCard';

const baseCandidate: MatchCandidate = {
  kind: 'invoice',
  targetId: 'inv-1',
  amount: '500.0000',
  date: '2026-04-15',
  contactName: 'Acme Corp',
  score: 0.92,
  amountScore: 1,
  dateScore: 1,
  nameScore: 0.6,
  reason: 'Invoice INV-1001 for Acme Corp',
};

describe('MatchCandidateCard', () => {
  it('renders the kind label and reason', () => {
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={0}
        candidate={baseCandidate}
        feedAmount={-500}
      />,
    );
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByText(/INV-1001/)).toBeInTheDocument();
    expect(screen.getByText('92% match')).toBeInTheDocument();
  });

  it('shows partial-payment indicator when feed amount < candidate amount', () => {
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={0}
        candidate={baseCandidate}
        feedAmount={-300}
      />,
    );
    expect(screen.getByText('Partial payment')).toBeInTheDocument();
    expect(screen.getByText(/Remainder/)).toBeInTheDocument();
  });

  it('does not show partial-payment indicator at exact match', () => {
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={0}
        candidate={baseCandidate}
        feedAmount={-500}
      />,
    );
    expect(screen.queryByText('Partial payment')).toBeNull();
  });

  it('shows duplicate-warning banner when prop set', () => {
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={1}
        candidate={baseCandidate}
        feedAmount={-500}
        duplicateWarning
      />,
    );
    expect(screen.getByText(/close matches/)).toBeInTheDocument();
  });

  it('Apply match button fires useApplyMatch with stateId + index', () => {
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={2}
        candidate={baseCandidate}
        feedAmount={-500}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Apply match/ }));
    expect(applyFn).toHaveBeenCalledWith({ stateId: 'state-1', candidateIndex: 2 });
  });

  it('Not a match button fires useNotAMatch', () => {
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={2}
        candidate={baseCandidate}
        feedAmount={-500}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Not a match/ }));
    expect(notAMatchFn).toHaveBeenCalledWith({ stateId: 'state-1', candidateIndex: 2 });
  });

  it('renders different kind labels', () => {
    const billCandidate: MatchCandidate = { ...baseCandidate, kind: 'bill', reason: 'Bill 99' };
    renderRoute(
      <MatchCandidateCard
        stateId="state-1"
        candidateIndex={0}
        candidate={billCandidate}
        feedAmount={500}
      />,
    );
    expect(screen.getByText('Bill')).toBeInTheDocument();
  });
});
