// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { AiCheckAvailabilityDTO, AiCheckDTO, AiCheckRunDTO } from '@kis-books/shared';

const h = vi.hoisted(() => ({
  runs: [] as unknown[],
  start: vi.fn(),
  cancel: vi.fn(),
  apply: vi.fn(),
}));

vi.mock('../../../api/hooks/useTaxParamAiChecks', () => ({
  isActiveRun: (r: { status: string } | null | undefined) => !!r && (r.status === 'queued' || r.status === 'running'),
  useAiCheckRuns: () => ({ data: h.runs }),
  useStartAiCheckRun: () => ({ mutate: h.start, isPending: false }),
  useCancelAiCheckRun: () => ({ mutate: h.cancel, isPending: false }),
  useApplyAiCheck: () => ({ mutate: h.apply, isPending: false, isError: false, reset: vi.fn() }),
}));

import { AiCheckCell, AiCheckDrawer, AiCheckRunBar } from './AiCheck';

const avail = (over: Partial<AiCheckAvailabilityDTO> = {}): AiCheckAvailabilityDTO => ({
  available: true, reason: null, model: 'claude-sonnet-5-5', maxSearchesPerCheck: 5, concurrency: 2, ...over,
});

const check = (over: Partial<AiCheckDTO> = {}): AiCheckDTO => ({
  id: '11111111-1111-4111-8111-111111111111', targetKind: 'federal_param', key: 'se.ss_wage_base', jurisdiction: 'US', taxYear: 2026,
  storedValue: 176100, verdict: 'differs', foundValue: 184500, quote: 'the contribution and benefit base is $184,500',
  sourceUrl: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf', sourceTitle: 'Rev. Proc. 2025-32', sourceDate: 'Oct 2025', sourceTaxYear: 2026,
  rationale: 'Section 4 states it.', confidence: 'high', model: 'claude-sonnet-5-5', usage: null, error: null,
  details: { notes: ["Model said 'matches'; the server comparison says 'differs'."] }, runId: null,
  createdAt: '2026-10-13T12:00:00.000Z', createdBy: null, appliedAt: null, appliedBy: null, stale: false, ...over,
});

const run = (over: Partial<AiCheckRunDTO> = {}): AiCheckRunDTO => ({
  id: 'r1', taxYear: 2026, scope: 'federal', state: null, key: null, status: 'running', total: 10, done: 3,
  counts: { matches: 2, differs: 1, unconfirmed: 0, error: 0 }, cancelRequested: false, error: null, createdBy: null,
  createdAt: '2026-10-13T12:00:00.000Z', startedAt: null, finishedAt: null, ...over,
});

beforeEach(() => { vi.clearAllMocks(); h.runs = []; });

describe('AiCheckCell', () => {
  it('starts a single-row check', () => {
    renderRoute(<AiCheckCell year={2026} scope={{ kind: 'federal' }} rowKey="se.ss_wage_base" check={undefined} availability={avail()} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI check se.ss_wage_base' }));
    expect(h.start).toHaveBeenCalledWith({ scope: 'single', year: 2026, key: 'se.ss_wage_base' }, expect.anything());
  });

  it('passes the state for a state rule and shows the latest verdict, stale flag and opens the drawer', () => {
    const onOpen = vi.fn();
    renderRoute(<AiCheckCell year={2026} scope={{ kind: 'state', state: 'MO' }} rowKey="required_threshold" check={check({ key: 'required_threshold', stale: true })} availability={avail()} onOpen={onOpen} />);
    expect(screen.getByText('AI: differs')).toBeInTheDocument();
    expect(screen.getByText(/stale/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AI check result for required_threshold' }));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'AI check required_threshold' }));
    expect(h.start).toHaveBeenCalledWith({ scope: 'single', year: 2026, key: 'required_threshold', state: 'MO' }, expect.anything());
  });

  it('is disabled with the reason when no Anthropic key is configured', () => {
    renderRoute(<AiCheckCell year={2026} scope={{ kind: 'federal' }} rowKey="se.ss_wage_base" check={undefined}
      availability={avail({ available: false, reason: 'No Anthropic API key is saved in Admin → AI.' })} onOpen={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'AI check se.ss_wage_base' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringMatching(/No Anthropic API key/));
  });
});

describe('AiCheckRunBar', () => {
  it('confirms before starting a check-all', () => {
    renderRoute(<AiCheckRunBar year={2026} scope={{ kind: 'federal' }} unverifiedCount={7} availability={avail()} />);
    fireEvent.click(screen.getByRole('button', { name: /AI check unverified in federal 2026 \(7\)/ }));
    const dlg = screen.getByRole('dialog', { name: 'Start AI check' });
    expect(within(dlg).getByText(/nothing is changed or marked verified/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Start AI check' }));
    expect(h.start).toHaveBeenCalledWith({ scope: 'federal', year: 2026 }, expect.anything());
  });

  it('shows progress for an active run and cancels it', () => {
    h.runs = [run()];
    renderRoute(<AiCheckRunBar year={2026} scope={{ kind: 'federal' }} unverifiedCount={7} availability={avail()} />);
    expect(screen.getByText('AI check 3/10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /AI check unverified/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.cancel).toHaveBeenCalledWith('r1');
  });

  it('ignores another state\'s run and summarizes the last finished one', () => {
    h.runs = [run({ scope: 'state', state: 'AR' }), run({ id: 'r2', scope: 'state', state: 'MO', status: 'completed', done: 10, finishedAt: '2026-10-13T13:00:00.000Z' })];
    renderRoute(<AiCheckRunBar year={2026} scope={{ kind: 'state', state: 'MO' }} unverifiedCount={3} availability={avail()} />);
    expect(screen.queryByText(/AI check 3\/10/)).toBeNull();
    expect(screen.getByText(/Last AI check .*completed · 2 match · 1 differ/)).toBeInTheDocument();
  });
});

describe('AiCheckDrawer', () => {
  const renderValue = (v: unknown) => <span>{JSON.stringify(v)}</span>;

  it('shows the quote, source link and server notes, and applies with the citation box on by default', () => {
    renderRoute(<AiCheckDrawer check={check()} label="Social Security wage base" currentValue={176100} renderValue={renderValue} onClose={vi.fn()} />);
    expect(screen.getByText('the contribution and benefit base is $184,500')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /rp-25-32\.pdf/ });
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/the server comparison says 'differs'/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply AI value' }));
    const dlg = screen.getByRole('dialog', { name: 'Apply AI value' });
    expect(within(dlg).getByText('176100')).toBeInTheDocument();
    expect(within(dlg).getByText('184500')).toBeInTheDocument();
    expect(within(dlg).getByText(/stays/)).toBeInTheDocument();
    const box = within(dlg).getByRole('checkbox');
    expect(box).toBeChecked();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Apply' }));
    expect(h.apply).toHaveBeenCalledWith({ id: check().id, expectedValue: 176100, updateCitation: true }, expect.anything());
    fireEvent.click(box);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Apply' }));
    expect(h.apply).toHaveBeenLastCalledWith({ id: check().id, expectedValue: 176100, updateCitation: false }, expect.anything());
  });

  it('offers no Apply for a stale, applied or matching result', () => {
    const { unmount } = renderRoute(<AiCheckDrawer check={check({ stale: true })} label="x" currentValue={180000} renderValue={renderValue} onClose={vi.fn()} />);
    expect(screen.getByText(/Run the check again before applying/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply AI value' })).toBeNull();
    unmount();
    const r2 = renderRoute(<AiCheckDrawer check={check({ appliedAt: '2026-10-13T13:00:00.000Z' })} label="x" currentValue={184500} renderValue={renderValue} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Apply AI value' })).toBeNull();
    r2.unmount();
    renderRoute(<AiCheckDrawer check={check({ verdict: 'matches', foundValue: 176100 })} label="x" currentValue={176100} renderValue={renderValue} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Apply AI value' })).toBeNull();
  });
});
