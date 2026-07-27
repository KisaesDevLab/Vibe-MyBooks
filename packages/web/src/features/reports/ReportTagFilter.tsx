// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
//
// ADR 0XX §5.4/§5.5 — multi-select tag filter control for report filter
// bars. `value` is a comma-separated tag-id list ("" = no filter) so the
// report pages' sessionStorage keys, query params and query keys are
// untouched by the single→multi upgrade. Picking a tag from the dropdown
// appends it; each selected tag renders as a chip whose X removes it.
// Keeps the visible chips + clear affordance in one place so every
// report gets identical UX.

import { useTags } from '../../api/hooks/useTags';
import { X } from 'lucide-react';

interface ReportTagFilterProps {
  value: string;
  onChange: (tagIds: string) => void;
}

export function ReportTagFilter({ value, onChange }: ReportTagFilterProps) {
  const { data } = useTags({ isActive: true });
  const tags = data?.tags ?? [];
  const selectedIds = value ? value.split(',').filter(Boolean) : [];
  const selected = selectedIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);
  const available = tags.filter((t) => !selectedIds.includes(t.id));

  const addTag = (id: string) => {
    if (!id || selectedIds.includes(id)) return;
    onChange([...selectedIds, id].join(','));
  };
  const removeTag = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id).join(','));
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* The select is a pure "add" affordance: it always snaps back to
          the placeholder (value="") after a pick so the chips row is the
          single source of truth for what's selected. */}
      <select
        value=""
        onChange={(e) => addTag(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white"
        aria-label="Tag filter"
      >
        <option value="">{selected.length === 0 ? 'All Tags' : 'Add tag…'}</option>
        {available.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {selected.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => removeTag(t.id)}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs hover:bg-primary-100"
          title={`Remove tag filter: ${t.name}`}
        >
          Tag: {t.name}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
