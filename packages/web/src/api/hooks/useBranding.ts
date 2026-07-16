// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMe } from './useAuth';

export const DEFAULT_APP_NAME = 'Vibe MyBooks';

/**
 * The white-label app name, resolved for BOTH authenticated and pre-login
 * surfaces. Authenticated screens get it from /auth/me (already loaded); pre-
 * login screens (login, first-run wizard, public pages) fall back to the
 * unauthenticated /api/setup/status, which exposes just the name. This is the
 * single source every "Vibe MyBooks" display should read instead of hardcoding.
 */
export function useBranding(): { appName: string; isCustomName: boolean } {
  const { data: me } = useMe();
  const authedName = me?.branding?.appName;

  const { data: publicName } = useQuery({
    queryKey: ['branding-public'],
    queryFn: async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/setup/status`);
        if (!res.ok) return DEFAULT_APP_NAME;
        const body = await res.json();
        return (typeof body?.appName === 'string' && body.appName) || DEFAULT_APP_NAME;
      } catch {
        return DEFAULT_APP_NAME;
      }
    },
    // Only needed before /auth/me has the name; once authed we use that.
    enabled: !authedName,
    staleTime: 5 * 60 * 1000,
  });

  const appName = authedName || publicName || DEFAULT_APP_NAME;
  return {
    appName,
    isCustomName: me?.branding?.isCustomName ?? (appName !== DEFAULT_APP_NAME),
  };
}

/** Keep the browser tab title in sync with the white-label app name. Mount once
 *  near the app root (works pre- and post-login). */
export function useDocumentTitleBranding(): void {
  const { appName } = useBranding();
  useEffect(() => {
    document.title = appName;
  }, [appName]);
}
