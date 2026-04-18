// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Vitest setup: pulls in jest-dom's custom matchers so tests can use
// toBeInTheDocument / toHaveClass / etc., and cleans up any rendered
// React trees between tests so one test's DOM state can't leak into
// the next one.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia, which recharts / some layout code
// reach for. Stub it out so component tests don't crash at import time.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

// ResizeObserver isn't implemented in jsdom either; recharts' ResponsiveContainer
// uses it at render time. A no-op stub keeps the tests functional.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
