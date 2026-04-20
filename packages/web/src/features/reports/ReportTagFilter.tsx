// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// ADR 0XX §5.4 — single-select tag filter control for report filter bars.
// Keeps the visible "filtered by tag: X" chip + clear affordance in one
// place so every report gets identical UX.

import { useTags } from '../../api/hooks/useTags';
import { X } from 'lucide-react';

interface ReportTagFilterProps {
  value: string;
  onChange: (tagId: string) => void;
}

export function ReportTagFilter({ value, onChange }: ReportTagFilterProps) {
  const { data } = useTags({ isActive: true });
  const tags = data?.tags ?? [];
  const selected = tags.find((t) => t.id === value) || null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white"
        aria-label="Tag filter"
      >
        <option value="">All Tags</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {selected && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs hover:bg-primary-100"
          title="Clear tag filter"
        >
          Tag: {selected.name}
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
