// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useCreateFirm, useFirms } from '../../api/hooks/useFirms';

// 3-tier rules plan, Phase 1 — firm switcher / list. The user
// sees only firms they're a member of; super-admins see every
// firm. Click-through opens the per-firm staff/tenants/settings
// surface.
export function FirmListPage() {
  const { data, isLoading } = useFirms();
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
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New firm
        </Button>
      </div>

      {firms.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No firms yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create a firm to start managing rules and tenant assignments.
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

function CreateFirmDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateFirm();

  const handleSubmit = async () => {
    setError(null);
    try {
      await create.mutateAsync({ name: name.trim(), slug: slug.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">New firm</h2>
        <p className="text-xs text-gray-500">
          Super-admin only. The creator becomes the firm&apos;s first admin.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            maxLength={255}
            placeholder="Smith &amp; Co CPAs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-mono"
            maxLength={100}
            placeholder="smith-and-co"
          />
        </label>
        {error && <p className="text-xs text-rose-700">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={create.isPending || !name.trim() || !slug.trim()}
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
