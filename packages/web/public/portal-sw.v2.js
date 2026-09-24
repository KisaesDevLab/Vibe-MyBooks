// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 18.1 — service worker for
// the portal PWA.
//
// Strategy: NETWORK-FIRST for navigations and /api/*, cache-first only
// for content-hashed /assets/*. The page itself must never be served
// from the cache while the network is up: it was, until 2026-09-24, and
// the result was that a returning client kept running whatever build
// they first visited. Every portal change shipped since their first
// visit was invisible to them until they hard-refreshed, which is the
// one thing that bypasses a service worker. Hashed asset filenames are
// immutable, so those stay cache-first and still make the portal work
// offline once visited.

// The FILENAME is versioned (portal-sw.v2.js), not just this constant.
// Cloudflare had cached the original /portal-sw.js under the blanket .js
// "immutable, max-age=1y" rule, so every browser update check was answered
// from the edge with the OLD worker — including the checks a hard refresh
// triggers. The worker could never replace itself, and clients were stuck
// hard-refreshing forever. A name the edge has never seen is a guaranteed
// miss; nginx serves portal-sw*.js no-cache so it stays that way. Rename
// the file again if this worker's strategy ever has to change under a CDN
// that has already cached it.
//
// Bumping the cache name is what evicts a stale shell: activate deletes
// every cache that is not the current one.
const SHELL_CACHE = 'kisbooks-portal-shell-v2';

// Paths are relative to where the worker is served, not the origin root:
// on an appliance subpath install the SPA lives at /mybooks/ and these
// become /mybooks/portal/ etc. With absolute '/portal/' the matches below
// never fired on those installs and the worker did nothing at all.
const BASE = new URL('./', self.location).pathname;
const SHELL_ASSETS = [`${BASE}portal/`, `${BASE}portal/login`, `${BASE}portal-manifest.json`];

const isApi = (p) => p.startsWith(`${BASE}api/`);
const isHashedAsset = (p) => p.startsWith(`${BASE}assets/`);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    // Any tab still showing the build this worker just replaced is reloaded
    // into the new one. Without it the person sits on the old page until
    // they happen to navigate — which is how "I still have to hard refresh"
    // survived the first fix.
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      try { await client.navigate(client.url); } catch { /* not navigable */ }
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Network-first for API calls.
  if (isApi(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((m) => m || new Response('', { status: 504 })),
      ),
    );
    return;
  }

  // Network-first for the page itself, so a deploy is visible on the next
  // load rather than after a hard refresh. The cached copy is the offline
  // fallback, and is refreshed on every successful load.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Never write a URL carrying a query string into the cache: the
          // sign-in and invitation links land on /portal/auth/verify?token=…
          // inside this scope, and caching that keys a live bearer token
          // into Cache Storage on disk, where any script on the origin can
          // enumerate it. Only successful same-origin shells are kept.
          const cacheable = !url.search && res.ok && res.type === 'basic';
          if (cacheable) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request)
            .then((m) => m || caches.match(`${BASE}portal/`))
            .then((m) => m || new Response('', { status: 504 })),
        ),
    );
    return;
  }

  // Cache-first for build assets. Their filenames carry a content hash, so
  // a cached one can never be the wrong version of itself.
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
            return res;
          }),
      ),
    );
  }
});

// 18.3 — receipt upload background sync. The page enqueues an
// outbound POST in IndexedDB and registers a sync tag; this handler
// drains the queue when connectivity returns.
self.addEventListener('sync', (event) => {
  if (event.tag === 'portal-receipt-sync') {
    event.waitUntil(drainReceiptQueue());
  }
});

// 18.3 — drain the IndexedDB receipt queue. Mirrors the page-side
// drainQueue() helper so a sync event can clear the queue even when
// no portal tab is open (e.g. user closed the tab while offline).
async function drainReceiptQueue() {
  const DB_NAME = 'kisbooks-portal-receipts';
  const STORE = 'receipts';
  const open = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      // No upgrade path here — the page creates the store on first use.
    });

  let db;
  try {
    db = await open();
  } catch {
    return; // no DB yet
  }
  if (!db.objectStoreNames.contains(STORE)) {
    db.close();
    return;
  }

  const items = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

  for (const item of items) {
    if (item.attempts >= 5) continue;
    try {
      const form = new FormData();
      form.append('file', item.blob, item.filename);
      form.append('companyId', item.companyId);
      const res = await fetch('/api/portal/receipts/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('http ' + res.status);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(item.id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const get = store.get(item.id);
        get.onsuccess = () => {
          const cur = get.result;
          if (cur) {
            cur.attempts = (cur.attempts || 0) + 1;
            store.put(cur);
          }
        };
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }
  }
  db.close();
}
