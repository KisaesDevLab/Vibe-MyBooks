// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Form-scoped Ctrl/Cmd+Enter shortcut pair shared across every
// transaction entry form. The shorter chord deliberately goes to the
// back-to-back path (Save + New) because operators keying in a stack
// of receipts hit that button far more often than the single-save
// button. Ctrl/Cmd+Shift+Enter is the single-save path.
//
// When the form only has a single submit button (edit mode, or entry
// forms that don't offer + New), pass no `onSaveAndNew` and the hook
// maps Ctrl/Cmd+Enter to `onSave` directly.

import { useRef, type KeyboardEvent } from 'react';

export interface UseFormShortcutsOptions {
  /** Primary action — "Save" / "Record" / etc. Invoked by
   *  Ctrl/Cmd+Shift+Enter when a secondary action is defined, and by
   *  plain Ctrl/Cmd+Enter when it isn't. */
  onSave: () => void;
  /** Optional rapid-entry action — "Save + New" / "Record + New".
   *  When defined, Ctrl/Cmd+Enter maps here; Ctrl/Cmd+Shift+Enter maps
   *  to onSave. */
  onSaveAndNew?: () => void;
  /** When true, shortcuts do nothing — use to skip while a mutation is
   *  already in flight or the form is otherwise disabled. */
  disabled?: boolean;
}

export interface UseFormShortcutsResult {
  formRef: React.RefObject<HTMLFormElement>;
  handleKeyDown: (e: KeyboardEvent<HTMLFormElement>) => void;
  /** The chord tooltip for the primary (Save) button. */
  saveChord: string;
  /** The chord tooltip for the secondary (Save + New) button; empty
   *  string when no secondary action is defined. */
  saveAndNewChord: string;
}

export function useFormShortcuts(options: UseFormShortcutsOptions): UseFormShortcutsResult {
  const { onSave, onSaveAndNew, disabled } = options;
  const formRef = useRef<HTMLFormElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (disabled) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || e.key !== 'Enter') return;
    e.preventDefault();
    if (onSaveAndNew) {
      if (e.shiftKey) onSave();
      else onSaveAndNew();
    } else {
      onSave();
    }
  };

  const saveChord = onSaveAndNew ? 'Ctrl/Cmd+Shift+Enter' : 'Ctrl/Cmd+Enter';
  const saveAndNewChord = onSaveAndNew ? 'Ctrl/Cmd+Enter' : '';

  return { formRef, handleKeyDown, saveChord, saveAndNewChord };
}
