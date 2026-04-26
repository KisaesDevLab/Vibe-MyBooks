// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { ACTION_TYPES, ACTION_TYPES_DEFERRED, type Action, type ActionType } from '@kis-books/shared';
import { AccountSelector } from '../../../../components/forms/AccountSelector';
import { ContactSelector } from '../../../../components/forms/ContactSelector';
import { SplitActionEditor } from './SplitActionEditor';

interface Props {
  action: Action;
  onChange: (next: Action) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// Phase 5a §5.3 — single action editor. The action-type
// dropdown determines what configuration form renders below it.
// Deferred action types (set_class, set_location) are filtered
// out of the dropdown so authors can't pick them.
export function ActionNode({ action, onChange, onRemove, onMoveUp, onMoveDown }: Props) {
  const availableTypes = ACTION_TYPES.filter(
    (t) => !(ACTION_TYPES_DEFERRED as readonly string[]).includes(t),
  );

  const handleTypeChange = (nextType: ActionType) => {
    onChange(defaultActionForType(nextType));
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={action.type}
          onChange={(e) => handleTypeChange(e.target.value as ActionType)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Action type"
        >
          {availableTypes.map((t) => (
            <option key={t} value={t}>{prettyType(t)}</option>
          ))}
        </select>
        <div className="flex-1" />
        {(onMoveUp || onMoveDown) && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              aria-label="Move up"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              aria-label="Move down"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove action"
          className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ActionPayload action={action} onChange={onChange} />
    </div>
  );
}

function ActionPayload({ action, onChange }: { action: Action; onChange: (next: Action) => void }) {
  switch (action.type) {
    case 'set_account':
      return (
        <AccountSelector
          value={action.accountId}
          onChange={(id) => onChange({ ...action, accountId: id })}
          compact
        />
      );
    case 'set_vendor':
      return (
        <ContactSelector
          value={action.vendorId}
          onChange={(id) => onChange({ ...action, vendorId: id })}
          compact
        />
      );
    case 'set_tag':
      // Tags don't have a dedicated picker that fits this form
      // shape; render a free-text uuid input for now. The
      // visual builder is the priority — proper tag picker
      // integration can come later.
      return (
        <input
          type="text"
          value={action.tagId}
          onChange={(e) => onChange({ ...action, tagId: e.target.value })}
          placeholder="Tag uuid"
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm w-full"
        />
      );
    case 'set_memo':
      return (
        <input
          type="text"
          value={action.memo}
          onChange={(e) => onChange({ ...action, memo: e.target.value })}
          placeholder="Memo text"
          maxLength={500}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm w-full"
        />
      );
    case 'split_by_percentage':
    case 'split_by_fixed':
      return <SplitActionEditor action={action} onChange={onChange} />;
    case 'mark_for_review':
      return <p className="text-xs text-gray-500 italic">Item lands in Needs Review bucket.</p>;
    case 'skip_ai':
      return <p className="text-xs text-gray-500 italic">AI categorizer is skipped for this item.</p>;
    case 'set_class':
    case 'set_location':
      return (
        <p className="text-xs text-amber-700 italic">
          Class/location tracking ships in a later phase.
        </p>
      );
    default:
      return null;
  }
}

function defaultActionForType(t: ActionType): Action {
  switch (t) {
    case 'set_account':         return { type: 'set_account', accountId: '' };
    case 'set_vendor':          return { type: 'set_vendor', vendorId: '' };
    case 'set_tag':             return { type: 'set_tag', tagId: '' };
    case 'set_memo':            return { type: 'set_memo', memo: '' };
    case 'set_class':           return { type: 'set_class', classId: '' };
    case 'set_location':        return { type: 'set_location', locationId: '' };
    case 'split_by_percentage': return { type: 'split_by_percentage', splits: [{ accountId: '', percent: 50 }, { accountId: '', percent: 50 }] };
    case 'split_by_fixed':      return { type: 'split_by_fixed', splits: [{ accountId: '', amount: '0.0000' }, { accountId: '', amount: '0.0000' }] };
    case 'mark_for_review':     return { type: 'mark_for_review' };
    case 'skip_ai':             return { type: 'skip_ai' };
  }
}

function prettyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
