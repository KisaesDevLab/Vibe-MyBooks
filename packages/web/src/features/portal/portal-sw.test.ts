// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The portal service worker decides whether a client ever sees a new build.
// Until 2026-09-24 it was cache-first for the page, so a returning client
// kept running whatever build they first visited and only a hard refresh
// escaped it. These cases pin the strategy: the page comes from the network
// while the network is up, the cache is only the offline fallback, hashed
// assets stay cache-first, and activate evicts a previous shell cache.
//
// The worker is a plain script in public/ (not a module), so it is executed
// here against fake service-worker globals.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SW_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/portal-sw.v2.js'),
  'utf8',
);

type Listener = (event: Record<string, unknown>) => void;

interface Harness {
  listeners: Record<string, Listener>;
  cacheNames: string[];
  deleted: string[];
  put: ReturnType<typeof vi.fn>;
  matches: Map<string, string>;
  fetchMock: ReturnType<typeof vi.fn>;
  navigated: string[];
}

/** Run the worker source with fake globals and return what it registered. */
function loadWorker(opts: { base?: string; offline?: boolean; cached?: Record<string, string> } = {}): Harness {
  const base = opts.base ?? '/';
  const listeners: Record<string, Listener> = {};
  const deleted: string[] = [];
  const cacheNames = ['kisbooks-portal-shell-v1', 'kisbooks-portal-shell-v2'];
  const put = vi.fn();
  const matches = new Map(Object.entries(opts.cached ?? {}));

  const fetchMock = vi.fn((req: { url: string }) =>
    opts.offline
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ body: `network:${req.url}`, clone: () => ({ body: 'copy' }) }),
  );

  const cache = { addAll: () => Promise.resolve(), put };
  const caches = {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve(cacheNames),
    delete: (k: string) => { deleted.push(k); return Promise.resolve(true); },
    match: (req: { url: string } | string) => {
      // The real Cache API resolves a string request against the worker's
      // own URL, so '/portal/' and the absolute form are the same entry.
      const url = typeof req === 'string'
        ? new URL(req, `https://books.example.com${base}portal-sw.v2.js`).href
        : req.url;
      const hit = matches.get(url);
      return Promise.resolve(hit ? { body: hit } : undefined);
    },
  };

  const navigated: string[] = [];
  const self = {
    // Real WorkerLocation stringifies to its href — new URL('./', location)
    // relies on that, so the fake has to as well.
    location: {
      href: `https://books.example.com${base}portal-sw.v2.js`,
      toString() { return this.href; },
    },
    addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => [
        { url: 'https://books.example.com/portal/dashboard', navigate: async (u: string) => { navigated.push(u); } },
      ]),
    },
    registration: { scope: `https://books.example.com${base}portal/` },
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('self', 'caches', 'fetch', 'URL', 'Response', 'indexedDB', 'FormData', SW_SOURCE)(
    self, caches, fetchMock, URL,
    class { constructor(public body: unknown, public init: { status?: number } = {}) {} },
    undefined, undefined,
  );

  return { listeners, cacheNames, deleted, put, matches, fetchMock, navigated };
}

/** Dispatch a fetch event and resolve whatever the worker responded with. */
async function respondTo(
  h: Harness,
  url: string,
  init: { mode?: string; method?: string } = {},
): Promise<{ body?: string; init?: { status?: number } } | undefined> {
  let responded: Promise<unknown> | undefined;
  const request = { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors', clone: () => ({}) };
  h.listeners['fetch']!({ request, respondWith: (p: Promise<unknown>) => { responded = Promise.resolve(p); } });
  return responded as Promise<{ body?: string }> | undefined;
}

const ORIGIN = 'https://books.example.com';

beforeEach(() => vi.clearAllMocks());

describe('portal service worker', () => {
  it('serves the page from the network, not the cache', async () => {
    const h = loadWorker({ cached: { [`${ORIGIN}/portal/`]: 'stale build' } });
    const res = await respondTo(h, `${ORIGIN}/portal/`, { mode: 'navigate' });
    expect(res?.body).toBe(`network:${ORIGIN}/portal/`);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cached page when the network is down', async () => {
    const h = loadWorker({ offline: true, cached: { [`${ORIGIN}/portal/`]: 'offline build' } });
    const res = await respondTo(h, `${ORIGIN}/portal/`, { mode: 'navigate' });
    expect(res?.body).toBe('offline build');
  });

  it('falls back to the portal root for a deep link it has never cached', async () => {
    const h = loadWorker({ offline: true, cached: { [`${ORIGIN}/portal/`]: 'offline build' } });
    const res = await respondTo(h, `${ORIGIN}/portal/categorize`, { mode: 'navigate' });
    expect(res?.body).toBe('offline build');
  });

  it('keeps hashed assets cache-first — the filename carries the version', async () => {
    const h = loadWorker({ cached: { [`${ORIGIN}/assets/index-abc123.js`]: 'cached asset' } });
    const res = await respondTo(h, `${ORIGIN}/assets/index-abc123.js`);
    expect(res?.body).toBe('cached asset');
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('goes to the network for API calls', async () => {
    const h = loadWorker({ cached: { [`${ORIGIN}/api/portal/me`]: 'stale me' } });
    const res = await respondTo(h, `${ORIGIN}/api/portal/me`);
    expect(res?.body).toBe(`network:${ORIGIN}/api/portal/me`);
  });

  it('evicts a previous shell cache when it activates', async () => {
    const h = loadWorker();
    const waits: Array<Promise<unknown>> = [];
    h.listeners['activate']!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(h.deleted).toEqual(['kisbooks-portal-shell-v1']);
  });

  it('reloads tabs still showing the build it replaced', async () => {
    const h = loadWorker();
    const waits: Array<Promise<unknown>> = [];
    h.listeners['activate']!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    // Otherwise the person sits on the old page until they navigate — which
    // is how "I still have to hard refresh" survived the first fix.
    expect(h.navigated).toEqual(['https://books.example.com/portal/dashboard']);
  });

  it('matches its own subpath on an appliance install', async () => {
    const h = loadWorker({ base: '/mybooks/', cached: { [`${ORIGIN}/mybooks/assets/x-1.js`]: 'cached asset' } });
    const res = await respondTo(h, `${ORIGIN}/mybooks/assets/x-1.js`);
    expect(res?.body).toBe('cached asset');
  });
});
