// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { MAX_SCENARIOS_PER_YEAR, type ScenarioDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

interface Props {
  scenarios: ScenarioDTO[];
  selectedId: string | undefined;
  canWrite: boolean;
  busy?: boolean;
  error?: string;
  onSelect: (id: string) => void;
  onClone: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/** Scenario pills (Base + clones) with Clone / Rename and Delete (never Base). */
export function ScenarioTabs({ scenarios, selectedId, canWrite, busy, error, onSelect, onClone, onRename, onDelete }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = scenarios.find((s) => s.id === selectedId);
  const atCap = scenarios.length >= MAX_SCENARIOS_PER_YEAR;

  return (
    <div className="space-y-2" aria-label="Scenarios">
      <div role="tablist" aria-label="Scenario" className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === selectedId}
            className={`rounded-full border px-3 py-1 text-sm ${s.id === selectedId ? 'border-primary-600 bg-primary-50 text-primary-800 font-medium' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            onClick={() => { setRenaming(false); setCloning(false); onSelect(s.id); }}>
            {s.name}{s.isBase && <span className="ml-1 text-xs text-gray-500">(base)</span>}
          </button>
        ))}
        {canWrite && selected && (
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={atCap || busy} title={atCap ? `At most ${MAX_SCENARIOS_PER_YEAR} scenarios per year` : undefined}
              onClick={() => { setName(`Copy of ${selected.name}`); setRenaming(false); setCloning(true); }}>Clone</Button>
            {/* QA D21: Base keeps its name. */}
            {!selected.isBase && <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setName(selected.name); setCloning(false); setRenaming(true); }}>Rename</Button>}
            {!selected.isBase && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</Button>}
          </div>
        )}
      </div>
      {renaming && selected && (
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onRename(selected.id, name.trim()); setRenaming(false); } }}>
          <Input label="Scenario name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" type="submit" disabled={!name.trim()}>Save name</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(false)}>Cancel</Button>
        </form>
      )}
      {cloning && selected && (
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onClone(selected.id, name.trim()); setCloning(false); } }}>
          <Input label="Name the copy" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" type="submit" disabled={!name.trim()}>Create copy</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setCloning(false)}>Cancel</Button>
        </form>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <ConfirmDialog open={confirmDelete} variant="danger" confirmLabel="Delete" title="Delete this scenario?"
        message="Its adjustments and state rows are deleted with it. The Base scenario is never deleted."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); if (selected) onDelete(selected.id); }} />
    </div>
  );
}
