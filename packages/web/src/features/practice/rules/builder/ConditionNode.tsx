// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import type { ConditionAST, GroupCondition, LeafCondition } from '@kis-books/shared';
import { LeafConditionEditor } from './LeafConditionEditor';

interface Props {
  node: ConditionAST;
  onChange: (next: ConditionAST) => void;
  onRemove?: () => void;
  depth?: number;
  isRoot?: boolean;
}

// Phase 5a §5.2 — recursive condition tree. Each group node
// renders an AND/OR toggle, an "Add condition" / "Add group"
// button row, and recursively renders its children. Leaf nodes
// delegate to LeafConditionEditor.
export function ConditionNode({ node, onChange, onRemove, depth = 0, isRoot }: Props) {
  if (node.type === 'leaf') {
    return (
      <LeafConditionEditor
        node={node}
        onChange={onChange}
        onRemove={onRemove ?? (() => {})}
      />
    );
  }
  return (
    <GroupNode
      node={node}
      onChange={onChange as (next: ConditionAST) => void}
      onRemove={onRemove}
      depth={depth}
      isRoot={isRoot ?? false}
    />
  );
}

function GroupNode({
  node,
  onChange,
  onRemove,
  depth,
  isRoot,
}: {
  node: GroupCondition;
  onChange: (next: ConditionAST) => void;
  onRemove?: () => void;
  depth: number;
  isRoot: boolean;
}) {
  const updateChild = (idx: number, next: ConditionAST) => {
    const children = [...node.children];
    children[idx] = next;
    onChange({ ...node, children });
  };

  const removeChild = (idx: number) => {
    const children = node.children.filter((_, i) => i !== idx);
    onChange({ ...node, children });
  };

  const addLeaf = () => {
    const leaf: LeafCondition = { type: 'leaf', field: 'descriptor', operator: 'contains', value: '' };
    onChange({ ...node, children: [...node.children, leaf] });
  };

  const addGroup = () => {
    const group: GroupCondition = {
      type: 'group',
      op: 'AND',
      children: [{ type: 'leaf', field: 'descriptor', operator: 'contains', value: '' }],
    };
    onChange({ ...node, children: [...node.children, group] });
  };

  const toggleOp = () => {
    onChange({ ...node, op: node.op === 'AND' ? 'OR' : 'AND' });
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-3 flex flex-col gap-2',
        isRoot ? 'border-gray-300 bg-gray-50' : 'border-indigo-200 bg-indigo-50/40',
      )}
      style={{ marginLeft: isRoot ? 0 : 0 }}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleOp}
          aria-label="Toggle group operator"
          className="inline-flex items-center rounded-full bg-white border border-gray-300 px-2.5 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          {node.op}
        </button>
        {!isRoot && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove group"
            className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {node.children.map((child, i) => (
          <ConditionNode
            key={i}
            node={child}
            onChange={(next) => updateChild(i, next)}
            onRemove={() => removeChild(i)}
            depth={depth + 1}
          />
        ))}
        {node.children.length === 0 && (
          <p className="text-xs italic text-gray-500 px-1">
            Empty group — always evaluates to false. Add a condition or remove the group.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addLeaf}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3 w-3" /> Add condition
        </button>
        <button
          type="button"
          onClick={addGroup}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3 w-3" /> Add group
        </button>
      </div>
    </div>
  );
}
