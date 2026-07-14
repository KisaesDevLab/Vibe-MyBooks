// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Journal Entry Templates — the JE analog of the Daily Sales template
// builder: reusable line skeletons (label, account, debit/credit side,
// required flag). "Use" pre-fills the Journal Entry form via
// /transactions/new/journal-entry?template=<id>; posting stays on the
// normal ledger path.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { JeTemplateLineInput } from '@kis-books/shared';
import {
  useJeTemplates, useJeTemplate, useCreateJeTemplate,
  useReplaceJeTemplateLines, useDeleteJeTemplate,
} from '../../api/hooks/useJeTemplates';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Plus, Trash2, Save, Play, GripVertical } from 'lucide-react';

type EditLine = JeTemplateLineInput & { _key: string };
let keyCounter = 0;
const newKey = () => `k${keyCounter++}`;

export function JournalTemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading } = useJeTemplates();
  const templates = data?.templates ?? [];

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: tplData } = useJeTemplate(selectedId);
  const createTpl = useCreateJeTemplate();
  const saveLines = useReplaceJeTemplateLines();
  const delTpl = useDeleteJeTemplate();

  const [lines, setLines] = useState<EditLine[]>([]);
  useEffect(() => {
    if (tplData?.template) {
      setLines(tplData.template.lines.filter((l) => l.isActive).map((l) => ({
        _key: newKey(), id: l.id, label: l.label, accountId: l.accountId,
        normalSide: l.normalSide, sortOrder: l.sortOrder,
        isRequired: l.isRequired, isActive: true,
      })));
    } else { setLines([]); }
  }, [tplData]);

  const onCreate = async () => {
    if (!newName.trim()) { toast.error('Name the template.'); return; }
    try {
      const res = await createTpl.mutateAsync({ name: newName.trim() });
      toast.success('Template created — now add its lines.');
      setShowNew(false); setNewName(''); setSelectedId(res.template.id);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not create template.'); }
  };

  const addLine = () =>
    setLines((prev) => [...prev, {
      _key: newKey(), label: '', accountId: null,
      // Alternate the default side so a two-line template starts balanced.
      normalSide: prev.length % 2 === 0 ? 'debit' : 'credit',
      sortOrder: prev.length, isRequired: false, isActive: true,
    }]);
  const patch = (key: string, p: Partial<EditLine>) => setLines((prev) => prev.map((l) => l._key === key ? { ...l, ...p } : l));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l._key !== key));

  // Drag-and-drop reordering — same hand-rolled HTML5 pattern as the
  // report-builder LayoutEditor (no dnd dependency). Only the grip is
  // draggable so text selection inside the row's inputs stays normal;
  // hovering another row while dragging swaps positions live.
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const onRowDragOver = (e: React.DragEvent, overKey: string) => {
    e.preventDefault();
    if (!draggingKey || draggingKey === overKey) return;
    setLines((prev) => {
      const fromIdx = prev.findIndex((l) => l._key === draggingKey);
      const toIdx = prev.findIndex((l) => l._key === overKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [row] = next.splice(fromIdx, 1);
      if (row) next.splice(toIdx, 0, row);
      return next;
    });
  };

  const onSave = async () => {
    const bad = lines.find((l) => !l.label.trim());
    if (bad) { toast.error('Every line needs a label.'); return; }
    try {
      await saveLines.mutateAsync({ id: selectedId!, lines: lines.map((l, i) => ({
        id: l.id, label: l.label.trim(), accountId: l.accountId ?? null,
        normalSide: l.normalSide, sortOrder: i, isRequired: l.isRequired, isActive: true,
      })) });
      toast.success('Template saved.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save template.'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Entry Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Define a recurring entry's lines once — accounts, debit/credit sides, and which amounts are required — then fill in the numbers each time.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/transactions/journal-templates/enter')}>
            <Play className="h-4 w-4 mr-1" /> Enter journal
          </Button>
          <Button onClick={() => setShowNew((s) => !s)}><Plus className="h-4 w-4 mr-1" /> New template</Button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-[16rem]"><Input label="Template name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Monthly payroll accrual" /></div>
          <Button onClick={onCreate} loading={createTpl.isPending}>Create</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Template list */}
        <div className="lg:col-span-1 bg-white rounded-lg border divide-y">
          {isLoading && <div className="p-6 flex justify-center"><LoadingSpinner /></div>}
          {!isLoading && templates.length === 0 && <div className="p-4 text-sm text-gray-500">No templates yet.</div>}
          {templates.map((t) => (
            <button key={t.id} onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${selectedId === t.id ? 'bg-primary-50 font-medium' : ''}`}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Builder */}
        <div className="lg:col-span-3">
          {!selectedId && <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-sm text-gray-500">Select a template to edit, or create a new one.</div>}
          {selectedId && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">{tplData?.template.name}</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm"
                    onClick={() => navigate(`/transactions/journal-templates/enter?template=${selectedId}`)}>
                    <Play className="h-4 w-4 mr-1" /> Use template
                  </Button>
                  <Button variant="secondary" size="sm" onClick={async () => { if (confirm('Deactivate this template?')) { await delTpl.mutateAsync(selectedId); setSelectedId(undefined); } }}>Deactivate</Button>
                  <Button size="sm" onClick={onSave} loading={saveLines.isPending}><Save className="h-4 w-4 mr-1" /> Save template</Button>
                </div>
              </div>

              <div className="bg-white rounded-lg border">
                <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Lines</span>
                  <Button size="sm" variant="secondary" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add line</Button>
                </div>
                <div className="px-4 py-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-400 border-b">
                  <div className="w-4" />
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-4">Description</div>
                    <div className="col-span-4">Account</div>
                    <div className="col-span-2">Side</div>
                    <div className="col-span-1 text-center">Required</div>
                    <div className="col-span-1" />
                  </div>
                </div>
                <div className="divide-y">
                  {lines.map((l) => (
                    <div
                      key={l._key}
                      onDragOver={(e) => onRowDragOver(e, l._key)}
                      className={`px-4 py-3 flex items-center gap-2 ${draggingKey === l._key ? 'opacity-50 bg-primary-50/40' : ''}`}
                    >
                      <div
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', l._key); e.dataTransfer.effectAllowed = 'move'; setDraggingKey(l._key); }}
                        onDragEnd={() => setDraggingKey(null)}
                        className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0"
                        title="Drag to reorder"
                        aria-label={`Reorder ${l.label || 'line'}`}
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4"><Input value={l.label} placeholder="Line description" onChange={(e) => patch(l._key, { label: e.target.value })} /></div>
                        <div className="col-span-4"><AccountSelector value={l.accountId ?? ''} onChange={(v) => patch(l._key, { accountId: v })} compact /></div>
                        <div className="col-span-2">
                          <select className="w-full rounded-md border-gray-300 text-sm" value={l.normalSide} onChange={(e) => patch(l._key, { normalSide: e.target.value as 'debit' | 'credit' })} aria-label={`Side for ${l.label || 'line'}`}>
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                        </div>
                        <div className="col-span-1 text-center"><input type="checkbox" title="Required" checked={l.isRequired} onChange={(e) => patch(l._key, { isRequired: e.target.checked })} /></div>
                        <div className="col-span-1 text-right"><button onClick={() => remove(l._key)} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${l.label || 'line'}`}><Trash2 className="h-4 w-4" /></button></div>
                      </div>
                    </div>
                  ))}
                  {lines.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">No lines yet — add the entry's debit and credit lines.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
