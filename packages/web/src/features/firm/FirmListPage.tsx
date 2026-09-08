// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useFirms } from '../../api/hooks/useFirms';
import { CreateFirmDialog } from './CreateFirmDialog';
import { useMe } from '../../api/hooks/useAuth';

// 3-tier rules plan, Phase 1 — firm switcher / list. The user
// sees only firms they're a member of; super-admins see every
// firm. Click-through opens the per-firm staff/tenants/settings
// surface. Firm creation is super-admin only (POST /firms), so the
// button is gated the same way instead of letting the server 403.
export function FirmListPage() {
  const { data, isLoading } = useFirms();
  const { data: meData } = useMe();
  const isSuperAdmin = !!meData?.user?.isSuperAdmin;
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const firms = data?.firms ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Firms</h1>
          <p className="text-sm text-gray-500">
            Manage CPA-firm settings, staff, and tenant assignments.
          </p>
        </div>
        {isSuperAdmin && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New firm
          </Button>
        )}
      </div>

      {firms.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No firms yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isSuperAdmin
              ? 'Create a firm to start managing rules and tenant assignments.'
              : 'You are not a member of any firm yet. Ask a system administrator to add you.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {firms.map((firm) => (
            <Link
              key={firm.id}
              to={`/firm/${firm.id}/staff`}
              className="rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <div>
                    <div className="font-medium text-gray-900">{firm.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{firm.slug}</div>
                  </div>
                </div>
                {!firm.isActive && (
                  <span className="text-[11px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                    Inactive
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {createOpen && <CreateFirmDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
