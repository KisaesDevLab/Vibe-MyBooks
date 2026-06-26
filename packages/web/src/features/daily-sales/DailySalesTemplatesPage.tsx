// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DAILY_SALES_SECTIONS, type DailySalesTemplateLineInput } from '@kis-books/shared';
import {
  useDailySalesTemplates, useDailySalesTemplate, useCreateDailySalesTemplate,
  useReplaceTemplateLines, useDeleteDailySalesTemplate,
} from '../../api/hooks/useDailySales';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Plus, Trash2, Save } from 'lucide-react';

type EditLine = DailySalesTemplateLineInput & { _key: string };
let keyCounter = 0;
const newKey = () => `k${keyCounter++}`;

export function DailySalesTemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading } = useDailySalesTemplates();
  const templates = data?.templates ?? [];

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPreset, setNewPreset] = useState<'custom' | 'restaurant' | 'retail'>('restaurant');

  const { data: tplData } = useDailySalesTemplate(selectedId);
  const createTpl = useCreateDailySalesTemplate();
  const saveLines = useReplaceTemplateLines();
  const delTpl = useDeleteDailySalesTemplate();

  const [lines, setLines] = useState<EditLine[]>([]);
  useEffect(() => {
    if (tplData?.template) {
      setLines(tplData.template.lines.filter((l) => l.isActive).map((l) => ({
        _key: newKey(), id: l.id, section: l.section as EditLine['section'], label: l.label,
        accountId: l.accountId, normalSide: l.normalSide, sortOrder: l.sortOrder,
        isRequired: l.isRequired, allowTag: l.allowTag, isActive: true,
      })));
    } else { setLines([]); }
  }, [tplData]);

  const onCreate = async () => {
    if (!newName.trim()) { toast.error('Name the template.'); return; }
    try {
      const res = await createTpl.mutateAsync({ name: newName.trim(), presetType: newPreset });
      toast.success('Template created.');
      setShowNew(false); setNewName(''); setSelectedId(res.template.id);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not create template.'); }
  };

  const addLine = (section: EditLine['section']) =>
    setLines((prev) => [...prev, { _key: newKey(), section, label: '', accountId: null, normalSide: section === 'payment' || section === 'payout' || section === 'discount' ? 'debit' : 'credit', sortOrder: prev.length, isRequired: false, allowTag: false, isActive: true }]);
  const patch = (key: string, p: Partial<EditLine>) => setLines((prev) => prev.map((l) => l._key === key ? { ...l, ...p } : l));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l._key !== key));

  const onSave = async () => {
    const bad = lines.find((l) => !l.label.trim());
    if (bad) { toast.error('Every line needs a label.'); return; }
    try {
      await saveLines.mutateAsync({ id: selectedId!, lines: lines.map((l, i) => ({
        id: l.id, section: l.section, label: l.label.trim(), accountId: l.accountId ?? null,
        normalSide: l.normalSide, sortOrder: i, isRequired: l.isRequired, allowTag: l.allowTag, isActive: true,
      })) });
      toast.success('Template saved.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save template.'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Sales Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Map your POS X/Z report lines to GL accounts once; reuse them every day.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/daily-sales')}>Back to entries</Button>
          <Button onClick={() => setShowNew((s) => !s)}><Plus className="h-4 w-4 mr-1" /> New template</Button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-[16rem]"><Input label="Template name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Main St — Daily Sales" /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start from</label>
            <select className="rounded-md border-gray-300 text-sm" value={newPreset} onChange={(e) => setNewPreset(e.target.value as typeof newPreset)}>
              <option value="restaurant">Restaurant preset</option>
              <option value="retail">Retail preset</option>
              <option value="custom">Blank (custom)</option>
            </select>
          </div>
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
              <span className="block text-xs text-gray-400 capitalize">{t.presetType}</span>
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
                  <Button variant="secondary" size="sm" onClick={async () => { if (confirm('Deactivate this template?')) { await delTpl.mutateAsync(selectedId); setSelectedId(undefined); } }}>Deactivate</Button>
                  <Button size="sm" onClick={onSave} loading={saveLines.isPending}><Save className="h-4 w-4 mr-1" /> Save template</Button>
                </div>
              </div>

              {DAILY_SALES_SECTIONS.map((sec) => (
                <div key={sec.key} className="bg-white rounded-lg border">
                  <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{sec.label}</span>
                    <Button size="sm" variant="secondary" onClick={() => addLine(sec.key)}><Plus className="h-3 w-3 mr-1" /> Add line</Button>
                  </div>
                  <div className="divide-y">
                    {lines.filter((l) => l.section === sec.key).map((l) => (
                      <div key={l._key} className="px-4 py-3 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4"><Input value={l.label} placeholder="Line label" onChange={(e) => patch(l._key, { label: e.target.value })} /></div>
                        <div className="col-span-4"><AccountSelector value={l.accountId ?? ''} onChange={(v) => patch(l._key, { accountId: v })} compact /></div>
                        <div className="col-span-2">
                          <select className="w-full rounded-md border-gray-300 text-sm" value={l.normalSide} onChange={(e) => patch(l._key, { normalSide: e.target.value as 'debit' | 'credit' })}>
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                        </div>
                        <div className="col-span-1 text-center"><input type="checkbox" title="Required" checked={l.isRequired} onChange={(e) => patch(l._key, { isRequired: e.target.checked })} /></div>
                        <div className="col-span-1 text-right"><button onClick={() => remove(l._key)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
                      </div>
                    ))}
                    {lines.filter((l) => l.section === sec.key).length === 0 && <div className="px-4 py-3 text-xs text-gray-400">No lines.</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
