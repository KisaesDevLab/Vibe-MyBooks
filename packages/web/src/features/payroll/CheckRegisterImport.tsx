// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Standalone check-register import (e.g. Payroll Relief Checks.csv): every
// row posts as a check — CR the bank, DR an offset account. Each side is
// either one account chosen here or the account number the file gives.

import { useEffect, useState } from 'react';
import type { PayrollCheckAccountCode } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { useTags } from '../../api/hooks/useTags';
import { useCheckRegister, usePostCheckRegister } from '../../api/hooks/usePayrollImport';

type Source = 'file' | 'account';

interface Props {
  sessionId: string;
  onComplete: () => void;
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function CodeList({ codes, column }: { codes: PayrollCheckAccountCode[]; column: string }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {codes.map((c) => (
        <li key={c.code || '(blank)'} className={c.accountId ? 'text-gray-700' : 'text-red-700'}>
          <span className="font-mono">{c.code || '(blank)'}</span>
          {' → '}
          {c.accountId ? c.accountName : `no matching account — add account ${c.code || ''} or choose one account`}
          <span className="text-gray-400"> · {c.checkCount} {c.checkCount === 1 ? 'check' : 'checks'}</span>
        </li>
      ))}
      {codes.length === 0 && <li className="text-gray-500">The file has no {column} column values.</li>}
    </ul>
  );
}

function SideChooser({
  title, help, source, setSource, accountId, setAccountId, codes, fileColumn, accountLabel,
}: {
  title: string;
  help: string;
  source: Source;
  setSource: (s: Source) => void;
  accountId: string;
  setAccountId: (id: string) => void;
  codes: PayrollCheckAccountCode[];
  fileColumn: string;
  accountLabel: string;
}) {
  const name = title.replace(/\s+/g, '-').toLowerCase();
  return (
    <fieldset className="rounded-lg border border-gray-200 p-4">
      <legend className="px-1 text-sm font-medium text-gray-900">{title}</legend>
      <p className="text-xs text-gray-500 mb-3">{help}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} checked={source === 'account'} onChange={() => setSource('account')} />
        {accountLabel}
      </label>
      {source === 'account' && (
        <div className="mt-2 ml-6 max-w-sm">
          <AccountSelector value={accountId} onChange={setAccountId} />
        </div>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="radio" name={name} checked={source === 'file'} onChange={() => setSource('file')} />
        Use the file&apos;s &ldquo;{fileColumn}&rdquo; column
      </label>
      {source === 'file' && <div className="ml-6"><CodeList codes={codes} column={fileColumn} /></div>}
    </fieldset>
  );
}

export function CheckRegisterImport({ sessionId, onComplete }: Props) {
  const { data, isLoading, isError, refetch } = useCheckRegister(sessionId);
  const postMutation = usePostCheckRegister();
  const { data: tagsData } = useTags({ isActive: true });
  const hasTags = (tagsData?.tags?.length ?? 0) > 0;

  const [cashSource, setCashSource] = useState<Source>('file');
  const [cashAccountId, setCashAccountId] = useState('');
  const [offsetSource, setOffsetSource] = useState<Source>('account');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Default the bank side to the file's Cash Account when every check's
  // number matches an account; otherwise make the user pick one.
  useEffect(() => {
    if (!data) return;
    const allMatch = data.cashCodes.length > 0 && data.cashCodes.every((c) => c.accountId);
    setCashSource(allMatch ? 'file' : 'account');
    if (data.cashCodes.length === 1 && data.cashCodes[0]!.accountId) setCashAccountId(data.cashCodes[0]!.accountId);
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-gray-600">Loading checks...</p>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-red-700">Couldn&apos;t load the checks in this file.</p>
        <Button variant="secondary" className="mt-3" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const pending = data.checks.filter((c) => !c.posted);
  const total = pending.reduce((s, c) => s + Number(c.amount), 0);
  const unresolved = (source: Source, codes: PayrollCheckAccountCode[]) =>
    source === 'file' && codes.some((c) => !c.accountId);
  const offsetByCode = new Map(data.offsetCodes.map((c) => [c.code, c.accountName]));

  const blocker =
    pending.length === 0 ? 'Every check in this file has already been posted.'
    : cashSource === 'account' && !cashAccountId ? 'Choose the bank account the checks were paid from.'
    : offsetSource === 'account' && !offsetAccountId ? 'Choose the account the checks post to.'
    : unresolved(cashSource, data.cashCodes) ? 'Some Cash Account numbers in the file have no matching account.'
    : unresolved(offsetSource, data.offsetCodes) ? 'Some Account numbers in the file have no matching account.'
    : cashSource === 'account' && offsetSource === 'account' && cashAccountId === offsetAccountId
      ? 'The bank account and the posting account must be different.'
    : null;

  const handlePost = async () => {
    await postMutation.mutateAsync({
      sessionId,
      cashSource,
      cashAccountId: cashSource === 'account' ? cashAccountId : undefined,
      offsetSource,
      offsetAccountId: offsetSource === 'account' ? offsetAccountId : undefined,
      tagId,
    });
    onComplete();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Check register</h3>
        <p className="text-sm text-gray-600">
          {pending.length} {pending.length === 1 ? 'check' : 'checks'} totaling {money(total)} will post as checks:
          credit the bank account, debit the posting account. Only the amount paid is needed — no gross or withholding detail.
          {data.skippedZeroCount > 0 && ` ${data.skippedZeroCount} $0 (voided) ${data.skippedZeroCount === 1 ? 'row was' : 'rows were'} skipped.`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SideChooser
          title="Paid from"
          help="The bank account the checks and EFTs came out of."
          source={cashSource}
          setSource={setCashSource}
          accountId={cashAccountId}
          setAccountId={setCashAccountId}
          codes={data.cashCodes}
          fileColumn="Cash Account"
          accountLabel="One bank account for every check"
        />
        <SideChooser
          title="Post to"
          help="The other side of each check — e.g. Payroll Clearing, or the tax liability accounts the file names."
          source={offsetSource}
          setSource={setOffsetSource}
          accountId={offsetAccountId}
          setAccountId={setOffsetAccountId}
          codes={data.offsetCodes}
          fileColumn="Account"
          accountLabel="One account for every check (e.g. a clearing account)"
        />
      </div>

      {hasTags && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-4">
          <label className="text-sm font-medium text-gray-700">Tag</label>
          <LineTagPicker value={tagId} onChange={(id) => setTagId(id)} ariaLabel="Tag for every check" className="w-56" />
          <p className="text-xs text-gray-500">Applied to both lines of every check.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Check #</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Payee</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Posts to</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.checks.map((c) => (
              <tr key={c.id} className={c.posted ? 'text-gray-400' : ''}>
                <td className="px-4 py-2 font-mono">{c.checkNumber || '—'}</td>
                <td className="px-4 py-2">{c.checkDate}</td>
                <td className="px-4 py-2">{c.payeeName}{c.posted && ' (posted)'}</td>
                <td className="px-4 py-2 text-gray-600">
                  {offsetSource === 'file'
                    ? `${c.offsetAccountCode ?? ''} ${offsetByCode.get(c.offsetAccountCode ?? '') ?? ''}`.trim() || '—'
                    : 'Selected account'}
                </td>
                <td className="px-4 py-2 text-right font-mono">{money(Number(c.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {blocker && <p className="text-sm text-amber-700">{blocker}</p>}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={() => window.history.back()}>Back</Button>
        <div className="flex gap-3">
          {!confirming ? (
            <Button onClick={() => setConfirming(true)} disabled={!!blocker}>
              Post {pending.length} {pending.length === 1 ? 'check' : 'checks'}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button onClick={handlePost} loading={postMutation.isPending} disabled={!!blocker}>Confirm Post</Button>
            </>
          )}
        </div>
      </div>

      {postMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(postMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
