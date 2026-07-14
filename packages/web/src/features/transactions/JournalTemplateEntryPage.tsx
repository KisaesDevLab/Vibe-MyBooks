// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Fill-in-the-amounts entry screen for Journal Entry Templates — the
// JE analog of the Daily Sales entry page. Lines are grouped into
// Debit and Credit sections (each labeled, each line carrying a Dr/Cr
// chip), amounts are typed per use, required lines are enforced, and
// the live footer shows debits/credits/difference. Posting goes
// through the normal journal-entry path (balance + lock-date checks
// unchanged).

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useJeTemplates, useJeTemplate } from '../../api/hooks/useJeTemplates';
import { useCreateTransaction } from '../../api/hooks/useTransactions';
import { todayLocalISO } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { useToast } from '../../components/ui/Toaster';
import { Check, AlertTriangle, Send } from 'lucide-react';

const usd = (n: number) => `$${n.toFixed(2)}`;

function SideChip({ side }: { side: 'debit' | 'credit' }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
      side === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
    }`}>
      {side === 'debit' ? 'Dr' : 'Cr'}
    </span>
  );
}

export function JournalTemplateEntryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [templateId, setTemplateId] = useState(searchParams.get('template') ?? '');
  const [txnDate, setTxnDate] = useState(todayLocalISO());
  const [memo, setMemo] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: tplList } = useJeTemplates();
  const { data: tplData } = useJeTemplate(templateId || undefined);
  const createTxn = useCreateTransaction();

  const template = tplData?.template;
  // Seed the memo from the template once per template switch.
  useEffect(() => {
    if (template?.memo) setMemo(template.memo);
  }, [template?.id, template?.memo]);

  const lines = useMemo(
    () => (template?.lines ?? []).filter((l) => l.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [template],
  );
  const debitLines = lines.filter((l) => l.normalSide === 'debit');
  const creditLines = lines.filter((l) => l.normalSide === 'credit');

  const totals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    const unmapped: string[] = [];
    for (const l of lines) {
      const amt = parseFloat(values[l.id] || '0');
      if (!amt) continue;
      if (!l.accountId) { unmapped.push(l.label); continue; }
      if (l.normalSide === 'debit') debits += amt; else credits += amt;
    }
    return { debits, credits, difference: debits - credits, unmapped };
  }, [lines, values]);
  const balanced = Math.abs(totals.difference) < 0.005 && (totals.debits > 0 || totals.credits > 0);

  const missingRequired = lines.filter((l) => l.isRequired && !(parseFloat(values[l.id] || '0') > 0));

  const onPost = () => {
    if (totals.unmapped.length) {
      toast.error(`Map an account for: ${totals.unmapped.join(', ')} (edit the template).`);
      return;
    }
    if (missingRequired.length) {
      toast.error(`Amounts required on: ${missingRequired.map((l) => l.label).join(', ')}.`);
      return;
    }
    createTxn.mutate(
      {
        txnType: 'journal_entry',
        txnDate,
        memo,
        basis: 'both',
        lines: lines
          .filter((l) => l.accountId && parseFloat(values[l.id] || '0') > 0)
          .map((l) => {
            const amt = parseFloat(values[l.id]!).toFixed(4);
            return {
              accountId: l.accountId!,
              debit: l.normalSide === 'debit' ? amt : '0',
              credit: l.normalSide === 'credit' ? amt : '0',
              description: l.label,
              tagId: template?.defaultTagId ?? null,
            };
          }),
      } as Record<string, unknown> & { txnType: 'journal_entry' },
      {
        onSuccess: (res: { transaction: { id: string } }) => {
          toast.success('Journal entry posted.');
          navigate(`/transactions/${res.transaction.id}`);
        },
        onError: (err: Error) => toast.error(err.message || 'Could not post the entry.'),
      },
    );
  };

  const section = (title: string, side: 'debit' | 'credit', secLines: typeof lines) => (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <SideChip side={side} />
        <span className="text-xs text-gray-400">
          {side === 'debit' ? 'increases expenses/assets' : 'increases liabilities/income'}
        </span>
      </div>
      {secLines.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400">No {side} lines on this template.</div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {secLines.map((l) => (
            <div key={l.id} className="flex items-end gap-2">
              <div className="flex-1">
                <MoneyInput
                  label={`${l.label}${l.isRequired ? ' *' : ''}${l.accountId ? '' : ' ⚠ unmapped'}`}
                  value={values[l.id] ?? ''}
                  onChange={(v) => setValues((prev) => ({ ...prev, [l.id]: v }))}
                />
              </div>
              <div className="pb-2"><SideChip side={l.normalSide} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Enter Journal from Template</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/transactions/journal-templates')}>
          Manage templates
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-[16rem]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
          <select
            className="w-full rounded-md border-gray-300 text-sm"
            value={templateId}
            onChange={(e) => { setTemplateId(e.target.value); setValues({}); setMemo(''); }}
          >
            <option value="">Select a template…</option>
            {(tplList?.templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
        <div className="min-w-[16rem] flex-1">
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>

      {!template && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-sm text-gray-500">
          Select a template to fill in this period's amounts.
        </div>
      )}

      {template && (
        <>
          <div className="space-y-4">
            {section('Debit lines', 'debit', debitLines)}
            {section('Credit lines', 'credit', creditLines)}
          </div>

          <div className={`mt-4 rounded-lg border p-4 text-sm ${balanced ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex flex-wrap gap-x-8 gap-y-1">
              <span>Debits: <strong>{usd(totals.debits)}</strong></span>
              <span>Credits: <strong>{usd(totals.credits)}</strong></span>
              <span>Difference: <strong>{usd(Math.abs(totals.difference))}</strong></span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {balanced ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              {balanced
                ? <span className="text-green-800">Balanced — ready to post.</span>
                : <span className="text-amber-800">Debits must equal credits before posting.</span>}
            </div>
            {missingRequired.length > 0 && (
              <div className="mt-2 text-amber-800">
                Required: {missingRequired.map((l) => l.label).join(', ')}
              </div>
            )}
            {totals.unmapped.length > 0 && (
              <div className="mt-2 text-red-600">
                Unmapped lines (set the account in the template): {totals.unmapped.join(', ')}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={onPost} loading={createTxn.isPending} disabled={!balanced || missingRequired.length > 0 || totals.unmapped.length > 0}>
              <Send className="h-4 w-4 mr-1" /> Post journal entry
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
