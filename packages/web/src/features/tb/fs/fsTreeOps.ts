// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Pure, immutable operations on a statement's node tree (the outline
// editor's drag-and-drop, add, remove, edit). Kept free of React so they
// are unit-tested directly.

import type { FsNode, FsScheduleLine, FsStatementConfig } from '@kis-books/shared';

export type DropPosition = 'before' | 'after' | 'inside';

export function newNodeId(prefix = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function findNode(nodes: FsNode[], id: string): FsNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'section') {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function findParentId(nodes: FsNode[], id: string, parent: string | null = null): string | null | undefined {
  for (const n of nodes) {
    if (n.id === id) return parent;
    if (n.type === 'section') {
      const hit = findParentId(n.children, id, n.id);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

export function isDescendant(nodes: FsNode[], ancestorId: string, id: string): boolean {
  const a = findNode(nodes, ancestorId);
  if (!a || a.type !== 'section') return false;
  return findNode(a.children, id) !== null;
}

export function removeNode(nodes: FsNode[], id: string): { nodes: FsNode[]; removed: FsNode | null } {
  let removed: FsNode | null = null;
  const walk = (list: FsNode[]): FsNode[] => {
    const out: FsNode[] = [];
    for (const n of list) {
      if (n.id === id) { removed = n; continue; }
      out.push(n.type === 'section' ? { ...n, children: walk(n.children) } : n);
    }
    return out;
  };
  const next = walk(nodes);
  return { nodes: next, removed };
}

export function insertNode(nodes: FsNode[], node: FsNode, targetId: string | null, position: DropPosition): FsNode[] {
  if (targetId === null) return position === 'before' ? [node, ...nodes] : [...nodes, node];
  const walk = (list: FsNode[]): FsNode[] => {
    const out: FsNode[] = [];
    for (const n of list) {
      if (n.id === targetId) {
        if (position === 'before') out.push(node, n);
        else if (position === 'after') out.push(n, node);
        else if (n.type === 'section') out.push({ ...n, children: [...n.children, node] });
        else out.push(n, node);
        continue;
      }
      out.push(n.type === 'section' ? { ...n, children: walk(n.children) } : n);
    }
    return out;
  };
  return walk(nodes);
}

export function moveNode(nodes: FsNode[], id: string, targetId: string, position: DropPosition): FsNode[] {
  if (id === targetId || isDescendant(nodes, id, targetId)) return nodes;
  const { nodes: without, removed } = removeNode(nodes, id);
  if (!removed) return nodes;
  return insertNode(without, removed, targetId, position);
}

export function updateNode(nodes: FsNode[], id: string, patch: (n: FsNode) => FsNode): FsNode[] {
  return nodes.map((n) => {
    if (n.id === id) return patch(n);
    if (n.type === 'section') return { ...n, children: updateNode(n.children, id, patch) };
    return n;
  });
}

export function allNodes(nodes: FsNode[], depth = 0): Array<{ node: FsNode; depth: number }> {
  const out: Array<{ node: FsNode; depth: number }> = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.type === 'section') out.push(...allNodes(n.children, depth + 1));
  }
  return out;
}

// Delete a node and scrub references to it (total terms, rounding plugs).
export function deleteNodeFromStatement(st: FsStatementConfig, id: string): FsStatementConfig {
  const { nodes } = removeNode(st.body, id);
  const gone = new Set<string>();
  const collect = (n: FsNode) => { gone.add(n.id); if (n.type === 'section') n.children.forEach(collect); };
  const target = findNode(st.body, id);
  if (target) collect(target);
  const scrub = (list: FsNode[]): FsNode[] => list.map((n) => {
    if (n.type === 'total') return { ...n, terms: n.terms.filter((t) => !gone.has(t.nodeId)) };
    if (n.type === 'section') return { ...n, children: scrub(n.children) };
    return n;
  });
  const plugs = st.plugs ? Object.fromEntries(Object.entries(st.plugs).filter(([k, v]) => !gone.has(k) && !gone.has(v))) : undefined;
  return { ...st, body: scrub(nodes), ...(plugs ? { plugs } : {}) };
}

// ── Schedule lines (reorder / combine / split / pull out) ─────────────

// Current line list for a leadsheet: explicit lines first, then every
// remaining account (ordered by number) as its own line.
export function effectiveScheduleLines(
  lines: FsScheduleLine[] | undefined,
  accountIds: string[],
  accountOrder: (a: string, b: string) => number,
): FsScheduleLine[] {
  const used = new Set<string>();
  const out: FsScheduleLine[] = [];
  for (const l of lines ?? []) {
    const refs = l.accountRefs.filter((r) => r.systemTag || (r.accountId && accountIds.includes(r.accountId) && !used.has(r.accountId)));
    refs.forEach((r) => r.accountId && used.add(r.accountId));
    if (refs.length) out.push({ ...l, accountRefs: refs });
  }
  for (const id of [...accountIds].filter((a) => !used.has(a)).sort(accountOrder)) {
    out.push({ id: `acct_${id.slice(0, 8)}`, accountRefs: [{ accountId: id }] });
  }
  return out;
}

export function moveLine(lines: FsScheduleLine[], index: number, delta: -1 | 1): FsScheduleLine[] {
  const j = index + delta;
  if (j < 0 || j >= lines.length) return lines;
  const out = [...lines];
  [out[index], out[j]] = [out[j]!, out[index]!];
  return out;
}

export function combineLines(lines: FsScheduleLine[], indexes: number[], caption: string): FsScheduleLine[] {
  const pick = new Set(indexes);
  const first = Math.min(...indexes);
  const merged: FsScheduleLine = {
    id: newNodeId('line'),
    caption,
    accountRefs: lines.filter((_, i) => pick.has(i)).flatMap((l) => l.accountRefs),
  };
  const out: FsScheduleLine[] = [];
  lines.forEach((l, i) => {
    if (i === first) out.push(merged);
    if (!pick.has(i)) out.push(l);
  });
  return out;
}

export function splitLine(lines: FsScheduleLine[], index: number): FsScheduleLine[] {
  const l = lines[index];
  if (!l || l.accountRefs.length < 2) return lines;
  const parts = l.accountRefs.map((r) => ({ id: newNodeId('line'), accountRefs: [r] }));
  return [...lines.slice(0, index), ...parts, ...lines.slice(index + 1)];
}
