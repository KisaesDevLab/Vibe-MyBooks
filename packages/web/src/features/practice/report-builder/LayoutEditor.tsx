// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Plus,
  LineChart as ChartIcon,
  BarChart2,
  TextCursor,
  Sparkles,
  Image as ImageIcon,
  AlignJustify,
} from 'lucide-react';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 16.4 — drag-drop layout
// editor for report templates. Native HTML5 drag-and-drop (no
// dnd-kit dependency) — keeps bundle small and the operations are
// simple enough that the basic spec is fine here.
//
// Block palette mirrors the build-plan list (16.4):
//   • KPI card / KPI row
//   • Report embed
//   • Chart
//   • Visual data block (top customers / top vendors / aging)
//   • Tag-segment block
//   • Text block
//   • AI summary block
//   • Image block
//   • Page break

interface Block {
  id: string;
  type: string;
  // Type-specific config — kept loose because each block has a
  // different shape; the runtime renderer interprets it.
  [key: string]: unknown;
}

const PALETTE: Array<{
  type: string;
  label: string;
  icon: typeof ChartIcon;
  defaults: Omit<Block, 'id'>;
}> = [
  { type: 'kpi-row', label: 'KPI row', icon: BarChart2, defaults: { type: 'kpi-row', kpis: [] } },
  { type: 'chart', label: 'Chart', icon: ChartIcon, defaults: { type: 'chart', report: 'pl_vs_prior_year' } },
  { type: 'block', label: 'Data block', icon: AlignJustify, defaults: { type: 'block', name: 'top_customers', topN: 10 } },
  { type: 'tag-segment', label: 'Tag segment', icon: AlignJustify, defaults: { type: 'tag-segment', tags: [] } },
  { type: 'report', label: 'Report embed', icon: AlignJustify, defaults: { type: 'report', key: 'profit_loss' } },
  { type: 'text', label: 'Text', icon: TextCursor, defaults: { type: 'text', placeholder: 'Notes…' } },
  { type: 'ai_summary', label: 'AI summary', icon: Sparkles, defaults: { type: 'ai_summary', tone: 'executive', length: 'short' } },
  { type: 'image', label: 'Image', icon: ImageIcon, defaults: { type: 'image', src: '' } },
  { type: 'page-break', label: 'Page break', icon: AlignJustify, defaults: { type: 'page-break' } },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

interface CatalogEntry {
  key: string;
  name: string;
  category: string;
  format: string;
  source: 'stock' | 'custom';
}

export function LayoutEditor({
  templateId,
  onClose,
  onSaved,
}: {
  templateId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [dirty, setDirty] = useState(false);

  // Wrap state setters that mutate blocks so `dirty` flips automatically.
  const setBlocksDirty = (updater: (prev: Block[]) => Block[]) => {
    setBlocks((prev) => {
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  };

  useEffect(() => {
    Promise.all([
      api<{ templates: Array<{ id: string; name: string; layoutJsonb: unknown[] }> }>(
        '/practice/reports/templates',
      ),
      api<{ kpis: CatalogEntry[] }>('/practice/reports/kpis').catch(() => ({ kpis: [] })),
    ])
      .then(([t, k]) => {
        const tpl = t.templates.find((tt) => tt.id === templateId);
        if (!tpl) {
          setError('Template not found.');
          return;
        }
        setName(tpl.name);
        const incoming = Array.isArray(tpl.layoutJsonb) ? tpl.layoutJsonb : [];
        // Preserve persisted block ids (added in this revision) when present;
        // otherwise mint fresh ephemeral ids. Stable ids let text_overrides
        // and notes survive reorders without index drift.
        setBlocks(
          incoming.map((b) => {
            const obj = b as Record<string, unknown>;
            const persistedId = typeof obj['id'] === 'string' ? (obj['id'] as string) : null;
            return { ...(b as object), id: persistedId ?? uid() } as Block;
          }),
        );
        setCatalog(k.kpis ?? []);
      })
      .catch(() => setError('Failed to load template.'))
      .finally(() => setLoading(false));
  }, [templateId]);

  // Warn before navigating away with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleClose = () => {
    if (dirty && !confirm('You have unsaved layout changes. Discard them?')) return;
    onClose();
  };

  const add = (def: (typeof PALETTE)[number]) => {
    const block: Block = { ...def.defaults, id: uid() } as Block;
    setBlocksDirty((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const remove = (id: string) =>
    setBlocksDirty((prev) => prev.filter((b) => b.id !== id));

  const move = (id: string, delta: -1 | 1) =>
    setBlocksDirty((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      const block = next[idx]!;
      next.splice(idx, 1);
      next.splice(target, 0, block);
      return next;
    });

  const update = (id: string, patch: Partial<Block>) =>
    setBlocksDirty((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setBlocksDirty((prev) => {
      const fromIdx = prev.findIndex((b) => b.id === draggingId);
      const toIdx = prev.findIndex((b) => b.id === overId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [block] = next.splice(fromIdx, 1);
      if (block) next.splice(toIdx, 0, block);
      return next;
    });
  };
  const onDragEnd = () => setDraggingId(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Persist block ids so renderers + override maps survive a reorder.
      // (Earlier revisions stripped these — we now keep them.)
      await api(`/practice/reports/templates/${templateId}`, {
        method: 'PUT',
        body: JSON.stringify({ layout: blocks }),
      });
      setDirty(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <header className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Editing layout</p>
          <h2 className="text-base font-semibold text-gray-900">{name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-700">{error}</span>}
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Close
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save layout *' : 'Save layout'}
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Palette */}
        <aside className="col-span-3 border-r border-gray-200 overflow-y-auto p-3 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Blocks</p>
          <div className="space-y-1">
            {PALETTE.map((p) => (
              <button
                key={p.type}
                onClick={() => add(p)}
                className="w-full flex items-center gap-2 text-left bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <p.icon className="h-4 w-4 text-gray-500" />
                {p.label}
                <Plus className="h-3.5 w-3.5 ml-auto text-gray-400" />
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="col-span-6 overflow-y-auto p-4 bg-white">
          {loading ? (
            <p className="text-sm text-gray-500 py-12 text-center">Loading…</p>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center border border-dashed border-gray-300 rounded-md">
              Drop blocks here from the palette to start the layout.
            </p>
          ) : (
            <div className="space-y-2">
              {blocks.map((b, idx) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => onDragStart(b.id)}
                  onDragOver={(e) => onDragOver(e, b.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => setSelectedId(b.id)}
                  className={`group flex items-start gap-2 bg-white border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedId === b.id
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${draggingId === b.id ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{b.type}</p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            move(b.id, -1);
                          }}
                          disabled={idx === 0}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            move(b.id, 1);
                          }}
                          disabled={idx === blocks.length - 1}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(b.id);
                            if (selectedId === b.id) setSelectedId(null);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                      <BlockSummary block={b} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Inspector */}
        <aside className="col-span-3 border-l border-gray-200 overflow-y-auto p-4 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Block settings
          </p>
          {!selected ? (
            <p className="text-xs text-gray-500">Select a block to configure it.</p>
          ) : (
            <BlockInspector
              block={selected}
              catalog={catalog}
              onChange={(patch) => update(selected.id, patch)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function BlockSummary({ block }: { block: Block }) {
  if (block.type === 'kpi-row') {
    const kpis = (block['kpis'] as string[]) ?? [];
    return <>KPIs: {kpis.length === 0 ? '— pick at least one' : kpis.join(', ')}</>;
  }
  if (block.type === 'chart') return <>Report: {String(block['report'] ?? '—')}</>;
  if (block.type === 'block') return <>{String(block['name'] ?? '—')} (top {String(block['topN'] ?? '—')})</>;
  if (block.type === 'tag-segment') {
    const tags = (block['tags'] as string[]) ?? [];
    return <>{tags.length} tag{tags.length === 1 ? '' : 's'}</>;
  }
  if (block.type === 'report') return <>Embed: {String(block['key'] ?? '—')}</>;
  if (block.type === 'text') return <>{String(block['placeholder'] ?? '—').slice(0, 60)}</>;
  if (block.type === 'ai_summary')
    return <>Tone: {String(block['tone'] ?? '—')} · {String(block['length'] ?? '—')}</>;
  if (block.type === 'image') return <>{String(block['src'] ?? 'no image')}</>;
  return null;
}

function BlockInspector({
  block,
  catalog,
  onChange,
}: {
  block: Block;
  catalog: CatalogEntry[];
  onChange: (patch: Partial<Block>) => void;
}) {
  if (block.type === 'kpi-row') {
    const selected = (block['kpis'] as string[]) ?? [];
    const selectedSet = new Set(selected);
    const stock = catalog.filter((k) => k.source === 'stock');
    const custom = catalog.filter((k) => k.source === 'custom');
    const toggle = (key: string, on: boolean) => {
      const next = on ? [...selected, key] : selected.filter((k) => k !== key);
      onChange({ kpis: next });
    };
    const reorder = (key: string, delta: -1 | 1) => {
      const idx = selected.indexOf(key);
      if (idx < 0) return;
      const target = idx + delta;
      if (target < 0 || target >= selected.length) return;
      const next = [...selected];
      next.splice(idx, 1);
      next.splice(target, 0, key);
      onChange({ kpis: next });
    };
    return (
      <div className="space-y-3">
        {selected.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Selected (drag to reorder)
            </p>
            <div className="space-y-1">
              {selected.map((k, i) => {
                const def = catalog.find((c) => c.key === k);
                const orphan = !def;
                return (
                  <div
                    key={k}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      orphan
                        ? 'bg-amber-50 border border-amber-200 text-amber-900'
                        : 'bg-white border border-gray-200'
                    }`}
                    title={orphan ? 'KPI not in catalog — will render as —' : ''}
                  >
                    <span className="flex-1 truncate">
                      {def?.name ?? k}
                      {orphan && ' · missing'}
                    </span>
                    <button
                      onClick={() => reorder(k, -1)}
                      disabled={i === 0}
                      className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => reorder(k, 1)}
                      disabled={i === selected.length - 1}
                      className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => toggle(k, false)}
                      className="p-0.5 hover:bg-red-50 text-red-600 rounded"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Stock</p>
          <div className="space-y-0.5">
            {stock.map((k) => (
              <label key={k.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.has(k.key)}
                  onChange={(e) => toggle(k.key, e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 truncate">{k.name}</span>
              </label>
            ))}
          </div>
        </div>
        {custom.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Custom</p>
            <div className="space-y-0.5">
              {custom.map((k) => (
                <label key={k.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(k.key)}
                    onChange={(e) => toggle(k.key, e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="flex-1 truncate">{k.name}</span>
                  <code className="text-[10px] text-gray-500">{k.key}</code>
                </label>
              ))}
            </div>
          </div>
        )}
        {catalog.length === 0 && (
          <p className="text-[11px] text-amber-700">
            KPI catalog not loaded — values will render as —. Try reopening the editor.
          </p>
        )}
      </div>
    );
  }
  if (block.type === 'chart') {
    return (
      <div className="space-y-2">
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Source report</span>
          <select
            value={String(block['report'] ?? '')}
            onChange={(e) => onChange({ report: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="pl_vs_prior_year">P&amp;L vs. prior year</option>
            <option value="revenue_trend_12m">Revenue trend (12 months)</option>
            <option value="expense_trend_12m">Expense trend (12 months)</option>
            <option value="cash_balance_trend">Cash balance trend</option>
          </select>
        </label>
      </div>
    );
  }
  if (block.type === 'block') {
    return (
      <div className="space-y-2">
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Block</span>
          <select
            value={String(block['name'] ?? '')}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="top_customers">Top customers</option>
            <option value="top_vendors">Top vendors</option>
            <option value="ar_aging">A/R aging</option>
            <option value="ap_aging">A/P aging</option>
            <option value="pl_bar">P&amp;L bar chart</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Top N</span>
          <input
            type="number"
            min={1}
            max={50}
            value={Number(block['topN'] ?? 10)}
            onChange={(e) => onChange({ topN: parseInt(e.target.value, 10) })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </label>
      </div>
    );
  }
  if (block.type === 'tag-segment') {
    const tags = (block['tags'] as string[]) ?? [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-700">Tag IDs (one per line):</p>
        <textarea
          value={tags.join('\n')}
          onChange={(e) =>
            onChange({ tags: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
          }
          rows={5}
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs font-mono"
        />
      </div>
    );
  }
  if (block.type === 'report') {
    return (
      <div className="space-y-2">
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Report key</span>
          <select
            value={String(block['key'] ?? '')}
            onChange={(e) => onChange({ key: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="profit_loss">Profit &amp; Loss</option>
            <option value="balance_sheet">Balance Sheet</option>
            <option value="cash_flow">Cash Flow</option>
            <option value="general_ledger">General Ledger</option>
            <option value="ar_aging">A/R Aging</option>
            <option value="ap_aging">A/P Aging</option>
          </select>
        </label>
      </div>
    );
  }
  if (block.type === 'text') {
    return (
      <div className="space-y-2">
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Placeholder text</span>
          <textarea
            value={String(block['placeholder'] ?? '')}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </label>
      </div>
    );
  }
  if (block.type === 'ai_summary') {
    return (
      <div className="space-y-2">
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Tone</span>
          <select
            value={String(block['tone'] ?? 'executive')}
            onChange={(e) => onChange({ tone: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="executive">Executive</option>
            <option value="conversational">Conversational</option>
            <option value="formal">Formal</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="block text-gray-800 mb-1">Length</span>
          <select
            value={String(block['length'] ?? 'short')}
            onChange={(e) => onChange({ length: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
      </div>
    );
  }
  if (block.type === 'image') {
    return (
      <label className="block text-xs">
        <span className="block text-gray-800 mb-1">Image URL</span>
        <input
          type="text"
          value={String(block['src'] ?? '')}
          onChange={(e) => onChange({ src: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
        />
      </label>
    );
  }
  if (block.type === 'page-break') {
    return <p className="text-xs text-gray-500">No settings — splits into a new page in the PDF.</p>;
  }
  return null;
}

export default LayoutEditor;
