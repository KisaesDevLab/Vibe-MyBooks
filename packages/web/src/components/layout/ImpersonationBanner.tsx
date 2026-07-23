// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Eye } from 'lucide-react';
import { getImpersonation, stopImpersonation } from '../../api/client';

// Persistent banner shown while a super admin is impersonating a team member
// ("View as"). Reads the impersonation flag from client.ts (set at start,
// which always reloads the app), so a plain render on mount is sufficient.
// "Return" restores the admin token and reloads back to the admin session.
export function ImpersonationBanner() {
  const imp = getImpersonation();
  if (!imp) return null;

  const returnToAdmin = () => {
    stopImpersonation();
    window.location.assign('/');
  };

  return (
    <div className="w-full bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-center gap-3 flex-wrap">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-4 w-4" />
        Viewing as <strong>{imp.targetName}</strong> — you see this user&rsquo;s access, not your own.
      </span>
      <button
        type="button"
        onClick={returnToAdmin}
        className="underline font-medium hover:text-amber-100"
      >
        Return to your account
      </button>
    </div>
  );
}
