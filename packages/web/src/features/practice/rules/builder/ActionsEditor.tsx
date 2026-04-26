// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Plus } from 'lucide-react';
import {
  MAX_BRANCH_DEPTH,
  type Action,
  type ActionBranch,
  type ActionsField,
  type ConditionAST,
} from '@kis-books/shared';
import { ActionNode } from './ActionNode';
import { ConditionNode } from './ConditionNode';

interface ActionsEditorProps {
  value: ActionsField;
  onChange: (next: ActionsField) => void;
  /** Branching depth at this position. Root = 0; descending into
   *  a `then` body adds 1. Used to enforce MAX_BRANCH_DEPTH. */
  depth?: number;
}

// Phase 5a §5.3 + §5.4 — top-level actions dispatcher. The
// value is either a flat Action[] OR an ActionBranch tree. The
// editor surfaces both modes with a "Convert to flat list" /
// "Convert to if/then" toggle.
//
// BranchEditor + ActionsEditor are mutually recursive (a branch's
// `then` body is itself an ActionsField). Co-located in one file
// to avoid an ESM circular-import dance.
export function ActionsEditor({ value, onChange, depth = 0 }: ActionsEditorProps) {
  const isBranch = !Array.isArray(value);

  const convertToBranch = () => {
    const flat = Array.isArray(value) ? value : [];
    const branch: ActionBranch = {
      if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: '' },
      then: flat.length > 0 ? flat : [{ type: 'set_account', accountId: '' }],
    };
    onChange(branch);
  };

  const convertToFlat = () => {
    const flat = !Array.isArray(value) ? extractFlatThen(value) : value;
    onChange(flat);
  };

  if (isBranch) {
    return (
      <BranchEditor
        node={value}
        onChange={onChange}
        depth={depth}
        onCollapseToFlat={convertToFlat}
      />
    );
  }

  return (
    <FlatActionsEditor value={value} onChange={onChange} onConvertToBranch={convertToBranch} />
  );
}

function FlatActionsEditor({
  value,
  onChange,
  onConvertToBranch,
}: {
  value: Action[];
  onChange: (next: Action[]) => void;
  onConvertToBranch: () => void;
}) {
  const updateAction = (i: number, next: Action) => {
    onChange(value.map((a, idx) => (idx === i ? next : a)));
  };
  const removeAction = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const addAction = () => {
    onChange([...value, { type: 'set_account', accountId: '' }]);
  };
  const moveAction = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Actions
        </span>
        <button
          type="button"
          onClick={onConvertToBranch}
          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          Convert to if / then / else
        </button>
      </div>
      {value.length === 0 && (
        <p className="text-xs italic text-gray-500">
          No actions configured. The rule will fire but do nothing.
        </p>
      )}
      {value.map((action, i) => (
        <ActionNode
          key={i}
          action={action}
          onChange={(next) => updateAction(i, next)}
          onRemove={() => removeAction(i)}
          onMoveUp={i > 0 ? () => moveAction(i, -1) : undefined}
          onMoveDown={i < value.length - 1 ? () => moveAction(i, 1) : undefined}
        />
      ))}
      <button
        type="button"
        onClick={addAction}
        className="inline-flex w-fit items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Plus className="h-3 w-3" /> Add action
      </button>
    </div>
  );
}

interface BranchEditorProps {
  node: ActionBranch;
  onChange: (next: ActionsField) => void;
  depth: number;
  onCollapseToFlat: () => void;
}

function BranchEditor({ node, onChange, depth, onCollapseToFlat }: BranchEditorProps) {
  const remainingDepth = MAX_BRANCH_DEPTH - depth;

  const updateIf = (next: ConditionAST) => onChange({ ...node, if: next });
  const updateThen = (next: ActionsField) => onChange({ ...node, then: next });
  const updateElif = (i: number, next: { if: ConditionAST; then: ActionsField }) => {
    const elif = (node.elif ?? []).map((e, idx) => (idx === i ? next : e));
    onChange({ ...node, elif });
  };
  const removeElif = (i: number) => {
    const elif = (node.elif ?? []).filter((_, idx) => idx !== i);
    onChange({ ...node, elif: elif.length > 0 ? elif : undefined });
  };
  const addElif = () => {
    const elif = node.elif ?? [];
    if (elif.length >= MAX_BRANCH_DEPTH - 1) return;
    onChange({
      ...node,
      elif: [
        ...elif,
        {
          if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: '' },
          then: [{ type: 'set_account', accountId: '' }],
        },
      ],
    });
  };
  const addElse = () => {
    if (node.else) return;
    onChange({ ...node, else: [{ type: 'set_account', accountId: '' }] });
  };
  const removeElse = () => {
    const next = { ...node };
    delete next.else;
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          If / then / else (depth {depth} of {MAX_BRANCH_DEPTH})
        </span>
        <button
          type="button"
          onClick={onCollapseToFlat}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Convert to flat list
        </button>
      </div>
      {remainingDepth <= 1 && (
        <p className="text-xs text-rose-700">
          Branching depth limit reached — further nesting will be rejected on save.
        </p>
      )}

      <BranchSection label="If">
        <ConditionNode node={node.if} onChange={updateIf} isRoot />
      </BranchSection>
      <BranchSection label="Then" indent>
        <ActionsEditor value={node.then} onChange={updateThen} depth={depth + 1} />
      </BranchSection>

      {(node.elif ?? []).map((branch, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <BranchLabel>Else if</BranchLabel>
            <button
              type="button"
              onClick={() => removeElif(i)}
              className="text-xs text-gray-500 hover:text-rose-700"
            >
              Remove
            </button>
          </div>
          <ConditionNode
            node={branch.if}
            onChange={(next) => updateElif(i, { ...branch, if: next })}
            isRoot
          />
          <BranchSection label="Then" indent>
            <ActionsEditor
              value={branch.then}
              onChange={(next) => updateElif(i, { ...branch, then: next })}
              depth={depth + 1}
            />
          </BranchSection>
        </div>
      ))}

      {node.else && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <BranchLabel>Else</BranchLabel>
            <button
              type="button"
              onClick={removeElse}
              className="text-xs text-gray-500 hover:text-rose-700"
            >
              Remove else
            </button>
          </div>
          <BranchSection label="" indent>
            <ActionsEditor
              value={node.else}
              onChange={(next) => onChange({ ...node, else: next })}
              depth={depth + 1}
            />
          </BranchSection>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addElif}
          disabled={(node.elif?.length ?? 0) >= MAX_BRANCH_DEPTH - 1}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
        >
          <Plus className="h-3 w-3" /> Else if
        </button>
        <button
          type="button"
          onClick={addElse}
          disabled={!!node.else}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
        >
          <Plus className="h-3 w-3" /> Else
        </button>
      </div>
    </div>
  );
}

function BranchSection({
  label,
  indent,
  children,
}: {
  label: string;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <BranchLabel>{label}</BranchLabel>}
      <div className={indent ? 'pl-3 border-l-2 border-amber-300' : undefined}>{children}</div>
    </div>
  );
}

function BranchLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
      {children}
    </span>
  );
}

// Walks a branching tree to produce a best-effort flat action
// list when the user asks to "convert to flat list." Takes only
// the `then` body of the top-level if (else / elif are dropped).
function extractFlatThen(branch: ActionBranch): Action[] {
  if (Array.isArray(branch.then)) return branch.then;
  return extractFlatThen(branch.then);
}
