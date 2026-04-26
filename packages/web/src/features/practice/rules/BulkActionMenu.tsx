// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Check, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  useDeleteConditionalRule,
  useUpdateConditionalRule,
} from '../../../api/hooks/useConditionalRules';

interface Props {
  selectedIds: string[];
  onClear: () => void;
}

// Phase 5a §5.1 — bulk enable / disable / delete. Each action
// fans out one mutation per selected id (the existing CRUD
// endpoints are single-row only). Alternatives like a bulk
// endpoint are deferred.
export function BulkActionMenu({ selectedIds, onClear }: Props) {
  const update = useUpdateConditionalRule();
  const remove = useDeleteConditionalRule();

  if (selectedIds.length === 0) return null;

  const setActive = async (active: boolean) => {
    await Promise.all(
      selectedIds.map((id) => update.mutateAsync({ id, patch: { active } })),
    );
    onClear();
  };

  const removeAll = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} rule(s)? This removes their audit history too.`)) return;
    await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
    onClear();
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
      <span className="text-xs font-medium text-indigo-700">
        {selectedIds.length} selected
      </span>
      <Button variant="secondary" onClick={() => setActive(true)}>
        <Check className="h-3.5 w-3.5 mr-1" />
        Enable
      </Button>
      <Button variant="secondary" onClick={() => setActive(false)}>
        <EyeOff className="h-3.5 w-3.5 mr-1" />
        Disable
      </Button>
      <Button variant="danger" onClick={removeAll}>
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        Delete
      </Button>
      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
