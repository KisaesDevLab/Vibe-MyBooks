// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 18.3 — IndexedDB-backed
// receipt upload queue. Used by PortalCapturePage when the network
// is unavailable; drained by the service worker via Background Sync
// (where supported) or manually on next page load.
//
// Schema: one object store `receipts` keyed by an autoincrementing
// id with shape { id, blob, filename, mimeType, companyId, queuedAt }.

const DB_NAME = 'kisbooks-portal-receipts';
const DB_VERSION = 1;
const STORE = 'receipts';
const MAX_QUEUE = 50;
const WARN_AT = 40;

export interface QueuedReceipt {
  id?: number;
  blob: Blob;
  filename: string;
  mimeType: string;
  companyId: string;
  queuedAt: number;
  attempts: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueReceipt(item: Omit<QueuedReceipt, 'id' | 'attempts'>): Promise<{
  id: number;
  total: number;
  warning: boolean;
}> {
  const db = await open();
  const total = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (total >= MAX_QUEUE) {
    db.close();
    throw new Error(`Offline queue full (${MAX_QUEUE} items). Wait for connectivity to drain.`);
  }
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({ ...item, attempts: 0 });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
  db.close();
  // Try background-sync registration. Falls through silently on
  // browsers without SyncManager.
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      // @ts-expect-error — SyncManager isn't in the lib.dom type set yet.
      await reg.sync.register('portal-receipt-sync');
    }
  } catch {
    // ignore — page-side drainQueue() is the fallback
  }
  return { id, total: total + 1, warning: total + 1 >= WARN_AT };
}

export async function listQueue(): Promise<QueuedReceipt[]> {
  const db = await open();
  const items = await new Promise<QueuedReceipt[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedReceipt[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function removeQueued(id: number): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function bumpAttempts(id: number): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const get = store.get(id);
    get.onsuccess = () => {
      const cur = get.result as QueuedReceipt | undefined;
      if (!cur) {
        resolve();
        return;
      }
      cur.attempts += 1;
      store.put(cur);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// Drain — called when the page comes online or on capture-page mount.
// Returns counts so the UI can render a "synced N receipts" toast.
export async function drainQueue(): Promise<{ uploaded: number; failed: number; remaining: number }> {
  const items = await listQueue();
  let uploaded = 0;
  let failed = 0;
  for (const item of items) {
    if (item.attempts >= 5) continue; // give up after 5 tries; surface in queue UI
    try {
      const form = new FormData();
      form.append('file', item.blob, item.filename);
      form.append('companyId', item.companyId);
      const res = await fetch('/api/portal/receipts/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (item.id !== undefined) await removeQueued(item.id);
      uploaded++;
    } catch {
      if (item.id !== undefined) await bumpAttempts(item.id);
      failed++;
    }
  }
  const remaining = (await listQueue()).length;
  return { uploaded, failed, remaining };
}
