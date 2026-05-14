// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

// Lightweight toast/snackbar primitive. Built in-tree to avoid adding a
// new dependency for a single feature surface (AI error UX). If we ever
// need positioning richness (stacking modes, swipe-to-dismiss, etc.)
// swap to sonner — the `useToast()` API is intentionally a subset of
// theirs so the call sites won't need to change.

export type ToastVariant = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  /** Optional small secondary line — used by the AI hooks to surface the
   *  server-supplied error code (e.g. "ai_disabled_globally") under the
   *  human-readable message without making the message itself noisy. */
  detail?: string;
  /** Auto-dismiss delay in ms. Defaults to 6s for errors, 3s for others.
   *  Pass 0 to require manual dismissal. */
  durationMs: number;
}

interface ToastApi {
  error: (message: string, opts?: { detail?: string; durationMs?: number }) => void;
  success: (message: string, opts?: { detail?: string; durationMs?: number }) => void;
  info: (message: string, opts?: { detail?: string; durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Clear all pending dismissal timers when the provider unmounts. Stops
  // a Node warning during HMR and avoids "setState on unmounted" reports.
  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, opts?: { detail?: string; durationMs?: number }) => {
      const id = nextId++;
      const durationMs = opts?.durationMs ?? (variant === 'error' ? 6000 : 3000);
      const next: Toast = { id, variant, message, detail: opts?.detail, durationMs };
      setToasts((prev) => [...prev, next]);
      if (durationMs > 0) {
        const handle = setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      error: (m, o) => push('error', m, o),
      success: (m, o) => push('success', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss],
  );

  // Render through a portal so the toaster can sit above any page-level
  // modal overlay without inheriting transformed parent contexts. The
  // target is the document body, which is always present in the DOM at
  // the point this effect runs.
  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(<Viewport toasts={toasts} onDismiss={dismiss} />, document.body)
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Surface a clear actionable message in dev rather than letting
    // undefined.error crash an unrelated component.
    throw new Error('useToast() called outside <ToastProvider>. Wrap the app in <ToastProvider> in main/App.');
  }
  return ctx;
}

interface ViewportProps { toasts: Toast[]; onDismiss: (id: number) => void }

function Viewport({ toasts, onDismiss }: ViewportProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      // role=region + aria-live=polite so screen readers announce new
      // toasts without aggressively interrupting the user.
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-96 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const variantStyles: Record<ToastVariant, { border: string; bg: string; icon: string }> = {
  error: { border: 'border-red-300', bg: 'bg-red-50', icon: 'text-red-600' },
  success: { border: 'border-green-300', bg: 'bg-green-50', icon: 'text-green-600' },
  info: { border: 'border-blue-300', bg: 'bg-blue-50', icon: 'text-blue-600' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const s = variantStyles[toast.variant];
  const Icon = toast.variant === 'error' ? AlertCircle : toast.variant === 'success' ? CheckCircle : Info;
  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={clsx(
        'pointer-events-auto rounded-lg border shadow-md px-3 py-2.5 flex items-start gap-2.5',
        s.border,
        s.bg,
      )}
    >
      <Icon className={clsx('h-4 w-4 mt-0.5 flex-shrink-0', s.icon)} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-snug">{toast.message}</p>
        {toast.detail && (
          <p className="text-xs text-gray-500 mt-0.5 font-mono break-all">{toast.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
