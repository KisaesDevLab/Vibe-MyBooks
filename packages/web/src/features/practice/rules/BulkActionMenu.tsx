// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
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
  const [busy, setBusy] = useState(false);

  if (selectedIds.length === 0) return null;

  const setActive = async (active: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.all(
        selectedIds.map((id) => update.mutateAsync({ id, patch: { active } })),
      );
      // Selection stays — enable/disable is in-place, and keeping the rows
      // checked lets the user follow up (e.g. re-enable or delete) without
      // re-selecting.
    } catch {
      window.alert('Some rules could not be updated — check the list and retry.');
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    if (busy) return;
    if (!window.confirm(`Delete ${selectedIds.length} rule(s)? This removes their audit history too.`)) return;
    setBusy(true);
    try {
      await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
      onClear();
    } catch {
      window.alert('Some rules could not be deleted — check the list and retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
      <span className="text-xs font-medium text-indigo-700">
        {selectedIds.length} selected
      </span>
      <Button variant="secondary" onClick={() => setActive(true)} disabled={busy}>
        <Check className="h-3.5 w-3.5 mr-1" />
        Enable
      </Button>
      <Button variant="secondary" onClick={() => setActive(false)} disabled={busy}>
        <EyeOff className="h-3.5 w-3.5 mr-1" />
        Disable
      </Button>
      <Button variant="danger" onClick={removeAll} disabled={busy}>
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        Delete
      </Button>
      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
