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
  it('explains how to set up the router when it is not configured', () => {
    renderRoute(<AiRouterCard router={{ ...base, available: false }} />);
    expect(screen.getByText(/vibe enable/)).toBeTruthy();
    expect(screen.queryByLabelText('Use the AI Router')).toBeNull();
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
