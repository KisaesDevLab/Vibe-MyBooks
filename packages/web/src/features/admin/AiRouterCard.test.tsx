// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const mutate = vi.fn();
vi.mock('../../api/hooks/useAi', () => ({
  useUpdateAiConfig: () => ({ mutate, isPending: false }),
}));

import { AiRouterCard, type RouterInfo } from './AiRouterCard';

const base: RouterInfo = {
  available: true,
  enabled: true,
  enabledSetting: true,
  statementsOnBox: false,
  features: [
    { taskClass: 'mybooks_chat', label: 'Chat assistant', routed: false },
    { taskClass: 'mybooks_statement_extract', label: 'Bank statement extraction and check reads', routed: false },
  ],
};

beforeEach(() => mutate.mockReset());

describe('AiRouterCard', () => {
  it('asks for a URL and token when the router is not connected', () => {
    renderRoute(<AiRouterCard router={{ ...base, available: false }} />);
    expect(screen.getByText(/Not connected yet/)).toBeTruthy();
    expect(screen.queryByLabelText('Use the AI Router')).toBeNull();
  });

  it('saves a router connection on another server (URL + token)', () => {
    renderRoute(<AiRouterCard router={{ ...base, available: false }} />);
    const save = screen.getByRole('button', { name: 'Save connection' }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText('Router URL'), { target: { value: 'http://192.168.1.50:8220' } });
    expect(save.disabled).toBe(true); // a token is required the first time
    fireEvent.change(screen.getByLabelText('App token'), { target: { value: 'app-tok' } });
    fireEvent.click(save);
    expect(mutate).toHaveBeenCalledWith(
      { routerUrl: 'http://192.168.1.50:8220', routerToken: 'app-tok' }, expect.anything(),
    );
  });

  it('falls back to the server settings when the saved connection is cleared', () => {
    renderRoute(<AiRouterCard router={{
      ...base, connectionSource: 'settings', url: 'http://192.168.1.50:8220',
      savedUrl: 'http://192.168.1.50:8220', hasSavedToken: true, envConfigured: true,
    }} />);
    expect(screen.getByText(/Using the connection saved here/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use server settings' }));
    expect(mutate).toHaveBeenCalledWith({ routerUrl: '', routerToken: null }, expect.anything());
  });

  it('switches one feature to the router', () => {
    renderRoute(<AiRouterCard router={base} />);
    fireEvent.click(screen.getByRole('radiogroup', { name: /Chat assistant/ }).querySelectorAll('button')[1]!);
    expect(mutate).toHaveBeenCalledWith({ routerFeatures: { mybooks_chat: 'router' } }, expect.anything());
  });

  it('asks before routing bank statements', () => {
    renderRoute(<AiRouterCard router={base} />);
    fireEvent.click(screen.getByRole('radiogroup', { name: /Bank statement/ }).querySelectorAll('button')[1]!);
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Route bank statements through the router\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Route statements' }));
    expect(mutate).toHaveBeenCalledWith({ routerFeatures: { mybooks_statement_extract: 'router' } }, expect.anything());
  });

  it('disables per-feature switches while the router is off', () => {
    renderRoute(<AiRouterCard router={{ ...base, enabled: false }} />);
    const btn = screen.getByRole('radiogroup', { name: /Chat assistant/ }).querySelectorAll('button')[1] as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
