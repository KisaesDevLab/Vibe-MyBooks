// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DAILY_SALES_SECTIONS } from '@kis-books/shared';
import {
  useDailySalesTemplates, useDailySalesTemplate, useDailySalesEntry,
  useCreateDailySalesDraft, useUpdateDailySalesDraft, usePostDailySalesEntry, useVoidDailySalesEntry,
  type DailySalesTemplate, type DailySalesTemplateLine,
} from '../../api/hooks/useDailySales';
import { Button } from '../../components/ui/Button';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Check, AlertTriangle, Save, Send, Ban } from 'lucide-react';

function compute(lines: DailySalesTemplateLine[], values: Record<string, string>) {
  let debits = 0, credits = 0, sales = 0, tax = 0, payments = 0;
  const unmapped: string[] = [];
  for (const l of lines) {
    if (!l.isActive) continue;
    const amt = parseFloat(values[l.id] || '0');
    if (!amt) continue;
    if (!l.accountId) { unmapped.push(l.label); continue; }
    if (l.normalSide === 'debit') debits += amt; else credits += amt;
    if (l.section === 'sales') sales += amt; else if (l.section === 'tax') tax += amt; else if (l.section === 'payment') payments += amt;
  }
  return { debits, credits, overShort: debits - credits, sales, tax, payments, unmapped };
}
const usd = (n: number) => `$${n.toFixed(2)}`;

function todayISO(): string {
  // Local date as YYYY-MM-DD without pulling a date lib.
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function DailySalesEntryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!id;

  const { data: tplList } = useDailySalesTemplates();
  const { data: entryData, isLoading: entryLoading } = useDailySalesEntry(id);
  const [templateId, setTemplateId] = useState('');
  const [businessDate, setBusinessDate] = useState(todayISO());
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const { data: selectedTplData } = useDailySalesTemplate(!isEdit && templateId ? templateId : undefined);

  const createDraft = useCreateDailySalesDraft();
  const updateDraft = useUpdateDailySalesDraft();
  const postEntry = usePostDailySalesEntry();
  const voidEntry = useVoidDailySalesEntry();

  // Hydrate from an existing entry.
  useEffect(() => {
    if (entryData?.entry) {
      const e = entryData.entry;
      setTemplateId(e.templateId);
      setBusinessDate(e.businessDate);
      setNotes(e.notes ?? '');
      const v: Record<string, string> = {};
      for (const val of e.values) v[val.templateLineId] = val.amount;
      setValues(v);
    }
  }, [entryData]);

  const template: DailySalesTemplate | undefined = isEdit ? entryData?.entry.template : selectedTplData?.template;
  const status = entryData?.entry.status ?? 'draft';
  const readOnly = isEdit && status !== 'draft';
  const lines = useMemo(() => (template?.lines ?? []).filter((l) => l.isActive), [template]);
  const c = useMemo(() => compute(lines, values), [lines, values]);
  const balanced = Math.abs(c.overShort) < 0.005;

  const valuesPayload = () => lines
    .filter((l) => parseFloat(values[l.id] || '0') !== 0)
    .map((l) => ({ templateLineId: l.id, amount: values[l.id]! }));

  const persistDraft = async (): Promise<string> => {
    if (isEdit) {
      await updateDraft.mutateAsync({ id: id!, input: { businessDate, notes, values: valuesPayload() } });
      return id!;
    }
    const res = await createDraft.mutateAsync({ templateId, businessDate, notes, values: valuesPayload() });
    return res.entry.id;
  };

  const onSaveDraft = async () => {
    try { const newId = await persistDraft(); toast.success('Draft saved.'); if (!isEdit) navigate(`/daily-sales/entries/${newId}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save draft.'); }
  };

  const onPost = async () => {
    if (c.unmapped.length) { toast.error(`Map an account for: ${c.unmapped.join(', ')}`); return; }
    try {
      const eid = await persistDraft();
      await postEntry.mutateAsync(eid);
      toast.success(`Posted${Math.abs(c.overShort) >= 0.005 ? ` (Cash Over/Short ${usd(c.overShort)})` : ''}.`);
      navigate('/daily-sales');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not post entry.'); }
  };

  const onVoid = async () => {
    try { await voidEntry.mutateAsync(id!); toast.success('Entry voided.'); navigate('/daily-sales'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not void entry.'); }
  };

  if (isEdit && entryLoading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

  const busy = createDraft.isPending || updateDraft.isPending || postEntry.isPending;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{readOnly ? 'Daily Sales Entry' : 'Enter Daily Sales'}</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/daily-sales')}>Back</Button>
      </div>

      {/* Template + date */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-[16rem]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
          {isEdit ? (
            <div className="text-sm text-gray-900 py-2">{template?.name ?? '—'}</div>
          ) : (
            <select className="w-full rounded-md border-gray-300 text-sm" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues({}); }}>
              <option value="">Select a template…</option>
              {(tplList?.templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business date</label>
          <input type="date" className="rounded-md border-gray-300 text-sm" value={businessDate} disabled={readOnly} onChange={(e) => setBusinessDate(e.target.value)} />
        </div>
        {readOnly && (
          <span className={`text-xs px-2 py-1 rounded-full ${status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{status}</span>
        )}
      </div>

      {!template && !isEdit && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-sm text-gray-500">
          Select a template to enter today’s totals.
        </div>
      )}

      {template && (
        <>
          {/* Sections */}
          <div className="space-y-4">
            {DAILY_SALES_SECTIONS.map((sec) => {
              const secLines = lines.filter((l) => l.section === sec.key);
              if (secLines.length === 0) return null;
              return (
                <div key={sec.key} className="bg-white rounded-lg border">
                  <div className="px-4 py-2 border-b bg-gray-50 text-sm font-medium text-gray-700">{sec.label}</div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {secLines.map((l) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <div className="flex-1">
                          <MoneyInput
                            label={l.label + (l.accountId ? '' : ' ⚠ unmapped')}
                            value={values[l.id] ?? ''}
                            onChange={(v) => setValues((prev) => ({ ...prev, [l.id]: v }))}
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live balance / over-short */}
          <div className={`mt-4 rounded-lg border p-4 text-sm ${balanced ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex flex-wrap gap-x-8 gap-y-1">
              <span>Sales: <strong>{usd(c.sales)}</strong></span>
              <span>Tax: <strong>{usd(c.tax)}</strong></span>
              <span>Payments: <strong>{usd(c.payments)}</strong></span>
              <span>Debits: <strong>{usd(c.debits)}</strong></span>
              <span>Credits: <strong>{usd(c.credits)}</strong></span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {balanced ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              {balanced
                ? <span className="text-green-800">Balances — no over/short.</span>
                : <span className="text-amber-800">Off by <strong>{usd(Math.abs(c.overShort))}</strong> → posts to <strong>Cash Over/Short</strong> ({c.overShort > 0 ? 'overage' : 'shortage'}).</span>}
            </div>
            {c.unmapped.length > 0 && (
              <div className="mt-2 text-red-600">Unmapped lines (map an account in the template before posting): {c.unmapped.join(', ')}</div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2">
            {readOnly ? (
              <>
                {entryData?.entry.transactionId && (
                  <Button variant="secondary" onClick={() => navigate(`/transactions/${entryData.entry.transactionId}`)}>View journal entry</Button>
                )}
                {status === 'posted' && (
                  <Button variant="secondary" onClick={onVoid} loading={voidEntry.isPending}><Ban className="h-4 w-4 mr-1" /> Void</Button>
                )}
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={onSaveDraft} loading={busy} disabled={!templateId}><Save className="h-4 w-4 mr-1" /> Save draft</Button>
                <Button onClick={onPost} loading={busy} disabled={!templateId || c.unmapped.length > 0 || (c.debits === 0 && c.credits === 0)}>
                  <Send className="h-4 w-4 mr-1" /> Post entry
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
