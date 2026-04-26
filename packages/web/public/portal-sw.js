// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 18.1 — service worker for
// the portal PWA. Strategy: cache-first for the static shell,
// network-first for /api/*. Offline queue for receipt uploads
// piggybacks on Background Sync where available.

const SHELL_CACHE = 'kisbooks-portal-shell-v1';
const SHELL_ASSETS = ['/', '/portal/', '/portal/login', '/portal-manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Network-first for API calls.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((m) => m || new Response('', { status: 504 })),
      ),
    );
    return;
  }

  // Cache-first for portal shell.
  if (url.pathname.startsWith('/portal/') || url.pathname.startsWith('/assets/')) {
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
