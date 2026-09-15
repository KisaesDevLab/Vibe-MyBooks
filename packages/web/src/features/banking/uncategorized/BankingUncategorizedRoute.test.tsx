// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Who lands where at /banking/uncategorized. The server's /mode answer is
// the tie-breaker between the sidebar's "any firm" and the API's "the firm
// managing THIS tenant".

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderRoute } from '../../../test-utils';

const state: {
  me: unknown; firms: unknown; flag: boolean | undefined;
  mode: { data?: unknown; isLoading: boolean; isError: boolean };
} = { me: undefined, firms: { firms: [] }, flag: true, mode: { data: undefined, isLoading: false, isError: false } };

vi.mock('../../../api/hooks/useAuth', () => ({ useMe: () => ({ data: state.me, isLoading: false }) }));
vi.mock('../../../api/hooks/useFirms', () => ({ useFirms: () => ({ data: state.firms, isLoading: false }) }));
vi.mock('../../../api/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => state.flag }));
vi.mock('../../../api/hooks/useUncategorized', () => ({ useUncategorizedMode: () => state.mode }));
vi.mock('./TeamUncategorizedPage', () => ({ TeamUncategorizedPage: () => <p>team page</p> }));

const { BankingUncategorizedRoute } = await import('./BankingUncategorizedRoute');

function app() {
  return renderRoute(
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route path="/practice/uncategorized" element={<p>practice page</p>} />
      <Route path="/banking/uncategorized" element={<BankingUncategorizedRoute />} />
    </Routes>,
    { route: '/banking/uncategorized' },
  );
}
const user = (role: string, extra: Record<string, unknown> = {}) => ({ user: { id: 'u1', role, userType: 'staff', isSuperAdmin: false, ...extra } });
const suggest = { mode: 'suggest', managedByFirm: true, firmName: 'Firm', canReview: false };
const review = { mode: 'review', managedByFirm: true, firmName: 'Firm', canReview: true };

beforeEach(() => {
  state.me = user('accountant'); state.firms = { firms: [] }; state.flag = true;
  state.mode = { data: suggest, isLoading: false, isError: false };
});

describe('BankingUncategorizedRoute', () => {
  it('client user_type goes home', () => { state.me = user('owner', { userType: 'client' }); app(); expect(screen.getByText('home')).toBeInTheDocument(); });
  it('readonly goes home', () => { state.me = user('readonly'); app(); expect(screen.getByText('home')).toBeInTheDocument(); });
  it('flag off goes home', () => { state.flag = false; app(); expect(screen.getByText('home')).toBeInTheDocument(); });
  it('a /mode error (no banking permission, flag off server-side) goes home', () => {
    state.mode = { data: undefined, isLoading: false, isError: true }; app(); expect(screen.getByText('home')).toBeInTheDocument();
  });
  it('a non-firm accountant in suggest mode gets the team page', () => { app(); expect(screen.getByText('team page')).toBeInTheDocument(); });
  it('a firm member the server calls a reviewer is sent to Practice', () => {
    state.firms = { firms: [{ id: 'f1' }] }; state.mode = { data: review, isLoading: false, isError: false };
    app(); expect(screen.getByText('practice page')).toBeInTheDocument();
  });
  it('a super admin on a box with no firms is still sent to Practice when reviewer', () => {
    state.me = user('owner', { isSuperAdmin: true }); state.mode = { data: review, isLoading: false, isError: false };
    app(); expect(screen.getByText('practice page')).toBeInTheDocument();
  });
  it('a member of ANOTHER firm (server says suggest) stays on the team page', () => {
    state.firms = { firms: [{ id: 'other' }] }; app(); expect(screen.getByText('team page')).toBeInTheDocument();
  });
  it('an owner of self-managed books (review, not a firm member) stays on the team page', () => {
    state.me = user('owner'); state.mode = { data: { ...review, managedByFirm: false }, isLoading: false, isError: false };
    app(); expect(screen.getByText('team page')).toBeInTheDocument();
  });
});
