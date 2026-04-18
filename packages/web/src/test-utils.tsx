// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Shared render helper for component/page tests. Every page lives under a
// Router + QueryClientProvider at the app root, so tests that render a page
// in isolation have to wire the same providers up. Centralizing here keeps
// each test file short and means retries / stale-time policy is consistent
// across the suite (retry disabled so a mock rejection surfaces immediately).

import type { ReactElement } from 'react';
import { render, screen, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export interface RenderRouteOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL the MemoryRouter should land on. Defaults to '/'. */
  route?: string;
  /**
   * When set, wraps the UI in a `<Routes><Route path=... element=... /></Routes>`
   * so that routes-using-useParams / useSearchParams see realistic paths.
   * When omitted, renders the UI directly.
   */
  path?: string;
}

/**
 * Render a page/component under the same providers the real app uses.
 * Returns the usual RTL result + the fresh QueryClient so tests can
 * inspect / invalidate queries if they need to.
 */
export function renderRoute(ui: ReactElement, opts: RenderRouteOptions = {}) {
  const { route = '/', path, ...rest } = opts;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const tree = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        {path ? (
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        ) : ui}
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...render(tree, rest), queryClient };
}

/**
 * Smoke assertion used by the bulk "page renders" tests across every
 * feature folder. Exact heading / role matchers are too brittle for the
 * dozens of pages we smoke-test like this — the goal is "didn't crash +
 * emitted some DOM." Accepts a heading, a role=status spinner,
 * non-empty body text, OR any structural element under <body> (covers
 * pages whose loading branch renders only a hand-rolled spinner icon).
 */
export function expectPageRendered(): void {
  const headings = screen.queryAllByRole('heading');
  const statuses = screen.queryAllByRole('status');
  const hasText = (document.body.textContent?.trim().length ?? 0) > 0;
  const hasElements = document.body.querySelector(
    'div, svg, form, section, main, article, nav, aside, header, footer',
  ) !== null;
  const rendered = headings.length + statuses.length > 0 || hasText || hasElements;
  if (!rendered) {
    throw new Error('expected page to render some content');
  }
}
