// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { apiClient } from '../../api/client';

// Cloudflare Turnstile widget shared by LoginPage / RegisterPage /
// ForgotPasswordPage. See Build Plans/CLOUDFLARE_TUNNEL_PLAN.md Phase 4.
//
// The widget renders only when the server exposes a site key via
// /api/v1/auth/methods. On LAN-only installs and during dev the site
// key comes back null and the widget short-circuits to immediately
// resolve `onToken('')` — callers can POST with an empty token and the
// server's requireTurnstile() middleware skips verification too, so the
// two ends stay in lock-step without extra feature flags.

export interface TurnstileWidgetProps {
  /** Called whenever the widget hands back a fresh token. Empty string means Turnstile is disabled server-side. */
  onToken: (token: string) => void;
  /** Cloudflare action ID (e.g. "login", "register"). Surfaces in CF analytics. */
  action?: string;
  /** Shown above the widget when it's visible. */
  label?: string;
  className?: string;
}

interface AuthMethodsResponse {
  turnstileSiteKey: string | null;
  [key: string]: unknown;
}

/**
 * Fetches `/api/v1/auth/methods` once on mount to discover the site
 * key. The request is in-memory-cached across remounts so the three
 * auth pages don't each trigger a round-trip. Refetching isn't needed
 * — the site key changes only when an admin rotates it, and any user
 * logging in after that naturally gets the fresh value via a full page
 * load.
 */
let cachedSiteKey: { value: string | null; loaded: boolean } = { value: null, loaded: false };

async function loadSiteKey(): Promise<string | null> {
  if (cachedSiteKey.loaded) return cachedSiteKey.value;
  try {
    const res = await apiClient<AuthMethodsResponse>('/auth/methods');
    cachedSiteKey = { value: res.turnstileSiteKey ?? null, loaded: true };
  } catch {
    // Endpoint unreachable — behave as if disabled. Better than blocking
    // login behind a bot widget that can't load.
    cachedSiteKey = { value: null, loaded: true };
  }
  return cachedSiteKey.value;
}

export function TurnstileWidget({ onToken, action, label, className }: TurnstileWidgetProps) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const widgetRef = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSiteKey().then((key) => {
      if (cancelled) return;
      setSiteKey(key);
      setLoaded(true);
      // Disabled server-side → emit an empty token so the submit
      // button's "no token yet" guard releases.
      if (!key) onToken('');
    });
    return () => { cancelled = true; };
    // onToken intentionally not in deps — re-running this on every parent
    // render would refire the disabled-server emit and thrash the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;
  if (!siteKey) return null;

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <Turnstile
        ref={widgetRef}
        siteKey={siteKey}
        options={{ action, theme: 'light', size: 'normal' }}
        onSuccess={(token) => onToken(token)}
        onExpire={() => {
          onToken('');
          widgetRef.current?.reset();
        }}
        onError={() => onToken('')}
      />
    </div>
  );
}
