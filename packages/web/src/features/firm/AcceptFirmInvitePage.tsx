// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Landing page for the emailed accept link. Lives inside ProtectedRoute:
// a logged-out staffer is bounced to /login and returned here afterwards
// (utils/postLoginRedirect). The token is read from the path and sent in
// a POST body — it never appears in an API URL.

import { useParams } from 'react-router-dom';
import { FirmInviteAcceptCard } from './FirmInviteAcceptCard';

export function AcceptFirmInvitePage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Client invitation</h1>
        <p className="text-sm text-gray-500">A client has asked you to manage their books.</p>
      </header>
      {token && /^[a-f0-9]{64}$/.test(token) ? (
        <FirmInviteAcceptCard lookup={{ token }} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-gray-700">
          This link is malformed. Open the link from the email again, or enter the code under Firm → Join a client.
        </div>
      )}
    </div>
  );
}
