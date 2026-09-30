// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { buildDefaultLayout, type FsNode } from '@kis-books/shared';
import {
  allNodes, combineLines, deleteNodeFromStatement, effectiveScheduleLines, findNode, findParentId, moveLine, moveNode, splitLine,
} from './fsTreeOps';

const bs = () => buildDefaultLayout('corporation').statements.find((s) => s.kind === 'balance_sheet')!;
const is = () => buildDefaultLayout('corporation').statements.find((s) => s.kind === 'income_statement')!;
const ids = (nodes: FsNode[]) => allNodes(nodes).map((x) => x.node.id);

describe('fsTreeOps', () => {
  it('moves a leadsheet into another section', () => {
    const st = bs();
    const next = moveNode(st.body, 'bs_inventory', 'bs_ppe', 'inside');
    expect(findParentId(next, 'bs_inventory')).toBe('bs_ppe');
    expect(ids(next).filter((i) => i === 'bs_inventory')).toHaveLength(1);
  });

  it('reorders before / after', () => {
    const next = moveNode(bs().body, 'bs_ar', 'bs_cash', 'before');
    const cur = (findNode(next, 'bs_current_assets') as Extract<FsNode, { type: 'section' }>).children.map((c) => c.id);
    expect(cur).toEqual(['bs_ar', 'bs_cash', 'bs_inventory']);
  });

  it('refuses to drop a section into its own subtree', () => {
    const body = bs().body;
    expect(moveNode(body, 'bs_assets', 'bs_cash', 'after')).toBe(body);
  });

  it('delete scrubs total terms that referenced the node', () => {
    const st = deleteNodeFromStatement(is(), 'is_cogs');
    const gp = findNode(st.body, 'is_gross_profit') as Extract<FsNode, { type: 'total' }>;
    expect(gp.terms.map((t) => t.nodeId)).toEqual(['is_revenue']);
  });

  it('schedule lines: explicit first, remaining accounts by order; combine / split / move', () => {
    const order = (a: string, b: string) => a.localeCompare(b);
    let lines = effectiveScheduleLines(undefined, ['c', 'a', 'b'], order);
    expect(lines.map((l) => l.accountRefs[0]!.accountId)).toEqual(['a', 'b', 'c']);
    lines = combineLines(lines, [0, 2], 'A and C');
    expect(lines.map((l) => l.caption ?? l.accountRefs[0]!.accountId)).toEqual(['A and C', 'b']);
    expect(lines[0]!.accountRefs.map((r) => r.accountId)).toEqual(['a', 'c']);
    lines = moveLine(lines, 1, -1);
    expect(lines[0]!.accountRefs[0]!.accountId).toBe('b');
    lines = splitLine(lines, 1);
    expect(lines).toHaveLength(3);
    // Explicit lines survive only for accounts still in the leadsheet.
    const again = effectiveScheduleLines([{ id: 'x', caption: 'X', accountRefs: [{ accountId: 'gone' }] }], ['a'], order);
    expect(again.map((l) => l.accountRefs[0]!.accountId)).toEqual(['a']);
  });
});
