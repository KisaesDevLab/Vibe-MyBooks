// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "New firm" dialog — super-admin only (POST /firms). Shared by the Firms
// page and Admin → Firms.

import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useCreateFirm } from '../../api/hooks/useFirms';

export function CreateFirmDialog({ onClose }: { onClose: () => void }) {
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
