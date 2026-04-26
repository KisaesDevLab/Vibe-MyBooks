// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { CheckCircle2, EyeOff, X } from 'lucide-react';
import type { Finding } from '@kis-books/shared';
import { Button } from '../../../../components/ui/Button';
import { useBulkTransitionFindings } from '../../../../api/hooks/useReviewChecks';

interface Props {
  selectedIds: string[];
  selectedFindings: Finding[];
  onCleared: () => void;
}

// Build plan §7.4 — multi-select toolbar above the findings
// table. Resolves require a note when any selected finding has
// severity ≥ high; ignores require a reason. The shared schema
// also enforces this server-side.
export function FindingsBulkBar({ selectedIds, selectedFindings, onCleared }: Props) {
  const bulk = useBulkTransitionFindings();
  const [note, setNote] = useState('');
  const requiresNote = selectedFindings.some(
    (f) => f.severity === 'high' || f.severity === 'critical',
  );

  if (selectedIds.length === 0) return null;

  const apply = (status: 'resolved' | 'ignored') => {
    if (requiresNote && !note.trim()) {
      alert(
        status === 'resolved'
          ? 'High/critical findings require a resolution note.'
          : 'High/critical findings require an ignore reason.',
      );
      return;
    }
    bulk.mutate(
      {
        ids: selectedIds,
        status,
        note: note || undefined,
        resolutionNote: status === 'resolved' ? note || undefined : undefined,
      },
      {
        onSettled: () => {
          setNote('');
          onCleared();
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
      <div className="text-sm text-indigo-900">
        <span className="font-medium">{selectedIds.length}</span>
        {' selected'}
        {requiresNote && (
          <span className="ml-2 text-xs text-rose-700">
            (note required for high/critical)
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={requiresNote ? 'Resolution note (required)' : 'Note (optional)'}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm w-56"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => apply('resolved')}
          disabled={bulk.isPending}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Resolve
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => apply('ignored')}
          disabled={bulk.isPending}
        >
          <EyeOff className="h-4 w-4 mr-1" />
          Ignore
        </Button>
        <Button variant="ghost" size="sm" onClick={onCleared} disabled={bulk.isPending}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
}
